import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  AlertComponent,
  BadgeComponent,
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardHeaderComponent,
  SpinnerComponent,
} from '@coreui/angular';
import { CycleOpsService } from '../../../../../core/services/cycle-ops.service';
import { EmergencyService } from '../../../../../core/services/emergency.service';
import { WalletsService } from '../../../../../core/services/wallets.service';
import {
  CycleMarketSession,
  CycleMarketSessionResponseDto,
} from '../../../../../core/models/api.types';
import { CycleStatus, marketSessionStatusBadgeColor } from '../../../../../core/models/enums';
import { createPollSubscription } from '../../../../../core/utils/polling.util';
import {
  formatMarketMakingApiError,
  formatMarketMakingStartConfirm,
  formatMarketMakingStartToast,
  formatMarketMakingStopConfirm,
  isMarketSessionRunning,
  marketStartButtonLabel,
  MARKET_MAKING_POLL_INTERVAL_MS,
  resolveMarketSessionStatus,
  resolveMarketTradesExecuted,
  resolveMarketTradesPerMinute,
} from '../../../../../core/utils/market-making.util';
import { ToastService } from '../../../../../shared/services/toast.service';

@Component({
  selector: 'app-cycle-market-making-panel',
  templateUrl: './cycle-market-making-panel.component.html',
  styleUrls: ['./cycle-market-making-panel.component.scss'],
  imports: [
    CardComponent,
    CardBodyComponent,
    CardHeaderComponent,
    ButtonDirective,
    BadgeComponent,
    AlertComponent,
    SpinnerComponent,
    RouterLink,
    DatePipe,
    CurrencyPipe,
  ],
})
export class CycleMarketMakingPanelComponent {
  private readonly ops = inject(CycleOpsService);
  private readonly wallets = inject(WalletsService);
  private readonly emergency = inject(EmergencyService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  cycleId = input.required<string>();
  cycleStatus = input.required<CycleStatus | string>();
  tokenId = input<string | null | undefined>(null);
  fallbackMarketSession = input<CycleMarketSession | null | undefined>(null);
  canResumeAborted = input(false);
  /** Overview card vs full Ops panel */
  compact = input(false);
  active = input(true);
  refreshToken = input(0);

  cycleRefresh = output<void>();

  marketDetail = signal<CycleMarketSessionResponseDto | null>(null);
  opsLoading = signal(false);
  balanceSyncing = signal(false);

  readonly marketStatusBadgeColor = marketSessionStatusBadgeColor;
  readonly isHalted = this.emergency.haltStatus;

  private marketPollSub?: Subscription;
  private loadedForCycleId = '';

  constructor() {
    effect(() => {
      const id = this.cycleId();
      if (id && id !== this.loadedForCycleId) {
        this.loadedForCycleId = id;
        this.resetState();
      }
    });

    effect(() => {
      if (this.active() && this.cycleId()) {
        this.refreshSession({ silent404: true });
      }
    });

    effect(() => {
      const token = this.refreshToken();
      if (token > 0 && this.cycleId()) {
        this.refreshSession({ silent404: true });
      }
    });

    this.destroyRef.onDestroy(() => this.stopMarketPolling());
  }

  sessionStatus(): string | null {
    return resolveMarketSessionStatus(this.marketDetail(), this.fallbackMarketSession());
  }

  tradesExecuted(): number {
    return resolveMarketTradesExecuted(this.marketDetail(), this.fallbackMarketSession());
  }

  tradesPerMinute(): number | null {
    return resolveMarketTradesPerMinute(this.marketDetail());
  }

  isRunning(): boolean {
    return isMarketSessionRunning(this.sessionStatus());
  }

  startLabel(): 'Start' | 'Restart' {
    return marketStartButtonLabel(this.sessionStatus());
  }

  /** Only block double-submit — validation is left to the API. */
  isBusy(): boolean {
    return this.opsLoading() || this.balanceSyncing();
  }

  refreshSession(options?: { silent404?: boolean }): void {
    const cycleId = this.cycleId();
    if (!cycleId) {
      return;
    }

    this.ops.getCycleMarketSession(cycleId).subscribe({
      next: (detail) => {
        this.marketDetail.set(detail);
        this.syncMarketPolling();
      },
      error: (err) => {
        if (err?.status === 404) {
          this.marketDetail.set(null);
          this.stopMarketPolling();
          if (!options?.silent404) {
            return;
          }
          return;
        }
        this.toast.error(formatMarketMakingApiError(err));
      },
    });
  }

  syncBalancesThenStart(): void {
    this.startMarket({ syncBalancesFirst: true });
  }

  startMarket(options?: { syncBalancesFirst?: boolean }): void {
    if (this.isBusy()) {
      return;
    }

    const priorTrades = this.tradesExecuted();
    const isRestart = this.startLabel() === 'Restart';
    if (!confirm(formatMarketMakingStartConfirm(isRestart, priorTrades))) {
      return;
    }

    const runStart = (): void => {
      this.opsLoading.set(true);
      this.ops.startCycleMarket(this.cycleId()).subscribe({
        next: (session) => {
          this.opsLoading.set(false);
          this.marketDetail.set(session);
          this.syncMarketPolling();
          this.toast.success(formatMarketMakingStartToast(isRestart, priorTrades));
          this.cycleRefresh.emit();
        },
        error: (err) => {
          this.opsLoading.set(false);
          this.toast.error(formatMarketMakingApiError(err));
        },
      });
    };

    if (options?.syncBalancesFirst) {
      this.balanceSyncing.set(true);
      this.wallets.syncCycleMarketBalances(this.cycleId()).subscribe({
        next: () => {
          this.balanceSyncing.set(false);
          runStart();
        },
        error: (err) => {
          this.balanceSyncing.set(false);
          this.toast.error(formatMarketMakingApiError(err));
        },
      });
      return;
    }

    runStart();
  }

  stopMarket(): void {
    if (this.isBusy()) {
      return;
    }
    if (!confirm(formatMarketMakingStopConfirm())) {
      return;
    }

    this.opsLoading.set(true);
    this.ops.stopCycleMarket(this.cycleId()).subscribe({
      next: (session) => {
        this.opsLoading.set(false);
        this.marketDetail.set(session);
        this.stopMarketPolling();
        this.toast.success('Market session stopped');
        this.cycleRefresh.emit();
      },
      error: (err) => {
        this.opsLoading.set(false);
        this.toast.error(formatMarketMakingApiError(err));
      },
    });
  }

  syncBalances(): void {
    const cycleId = this.cycleId();
    if (!cycleId) {
      return;
    }

    this.balanceSyncing.set(true);
    this.wallets.syncCycleMarketBalances(cycleId).subscribe({
      next: (res) => {
        this.balanceSyncing.set(false);
        if (res.failedSyncCount > 0) {
          this.toast.warning(
            `Synced with ${res.failedSyncCount} wallet failure${res.failedSyncCount === 1 ? '' : 's'}`,
          );
        } else {
          this.toast.success('Market balances synced from chain');
        }
      },
      error: (err) => {
        this.balanceSyncing.set(false);
        this.toast.error(formatMarketMakingApiError(err));
      },
    });
  }

  private syncMarketPolling(): void {
    if (this.isRunning()) {
      this.startMarketPolling();
    } else {
      this.stopMarketPolling();
    }
  }

  private startMarketPolling(): void {
    if (this.marketPollSub) {
      return;
    }

    this.marketPollSub = createPollSubscription(
      () => this.ops.getCycleMarketSession(this.cycleId()),
      {
        intervalMs: MARKET_MAKING_POLL_INTERVAL_MS,
        stopWhen: (session) => session.status !== 'RUNNING',
      },
      (session) => {
        this.marketDetail.set(session);
        if (session.status !== 'RUNNING') {
          this.stopMarketPolling();
          this.cycleRefresh.emit();
        }
      },
      () => this.stopMarketPolling(),
    );
  }

  private stopMarketPolling(): void {
    this.marketPollSub?.unsubscribe();
    this.marketPollSub = undefined;
  }

  private resetState(): void {
    this.marketDetail.set(null);
    this.opsLoading.set(false);
    this.balanceSyncing.set(false);
    this.stopMarketPolling();
  }
}
