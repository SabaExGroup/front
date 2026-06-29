import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AlertComponent,
  BadgeComponent,
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardHeaderComponent,
  ColComponent,
  FormLabelDirective,
  FormSelectDirective,
  RowComponent,
  SpinnerComponent,
  TableDirective,
} from '@coreui/angular';
import { TokenOwnerPoolService } from '../../core/services/token-owner-pool.service';
import { SettingsService } from '../../core/services/settings.service';
import { WalletsService } from '../../core/services/wallets.service';
import { ToastService } from '../../shared/services/toast.service';
import {
  PrefundTokenOwnerResponse,
  SettingsResponseDto,
  TokenOwnerPoolWallet,
  WalletDetailResponseDto,
} from '../../core/models/api.types';
import { NETWORKS, Network } from '../../core/models/enums';
import { extractErrorMessage, getHttpStatus } from '../../core/utils/error.util';
import {
  computeOwnerFundingStatus,
  formatPrefundToast,
  isTokenOwnerReuseDisabledMessage,
  ownerFundingStatusBadgeColor,
  ownerFundingStatusLabel,
  readOwnerLaunchFundingUsd,
  readTokenOwnerReuseEnabled,
  shortAddress,
  walletExplorerUrl,
  TokenOwnerFundingStatus,
} from '../../core/utils/token-owner-pool.util';

@Component({
  selector: 'app-token-owner-pool-page',
  templateUrl: './token-owner-pool.component.html',
  styleUrls: ['./token-owner-pool.component.scss'],
  imports: [
    RowComponent,
    ColComponent,
    CardComponent,
    CardBodyComponent,
    CardHeaderComponent,
    ButtonDirective,
    FormsModule,
    FormLabelDirective,
    FormSelectDirective,
    SpinnerComponent,
    AlertComponent,
    BadgeComponent,
    TableDirective,
    RouterLink,
    DatePipe,
    CurrencyPipe,
    DecimalPipe,
  ],
})
export class TokenOwnerPoolComponent implements OnInit {
  private readonly poolService = inject(TokenOwnerPoolService);
  private readonly settingsService = inject(SettingsService);
  private readonly wallets = inject(WalletsService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  network: Network = 'SOLANA';
  readonly networkOptions = NETWORKS;

  loading = signal(true);
  loadingSettings = signal(true);
  creating = signal(false);
  prefunding = signal(false);
  refreshingBalanceId = signal<string | null>(null);

  reuseEnabled = signal(true);
  targetUsd = signal(550);
  settings = signal<SettingsResponseDto | null>(null);

  pool = signal<TokenOwnerPoolWallet[]>([]);
  reuseDisabledError = signal(false);

  expandedWalletId = signal<string | null>(null);
  expandedDetail = signal<WalletDetailResponseDto | null>(null);
  expandedDetailLoading = signal(false);

  prefundElapsedSec = signal(0);
  prefundError = signal<string | null>(null);
  lastPrefundByWalletId = signal<Record<string, PrefundTokenOwnerResponse>>({});
  private prefundTimer?: ReturnType<typeof setInterval>;

  readonly shortAddress = shortAddress;
  readonly walletExplorerUrl = walletExplorerUrl;
  readonly ownerFundingStatusLabel = ownerFundingStatusLabel;
  readonly ownerFundingStatusBadgeColor = ownerFundingStatusBadgeColor;

  readyCount = computed(() =>
    this.pool().filter((w) => this.walletStatus(w) === 'ready').length
  );

  ngOnInit(): void {
    this.loadSettings();
    this.destroyRef.onDestroy(() => this.stopPrefundTimer());
  }

  onNetworkChange(): void {
    this.expandedWalletId.set(null);
    this.expandedDetail.set(null);
    this.loadPool();
  }

  loadSettings(): void {
    this.loadingSettings.set(true);
    this.settingsService.get().subscribe({
      next: (settings) => {
        this.settings.set(settings);
        const raw = settings as unknown as Record<string, unknown>;
        this.reuseEnabled.set(readTokenOwnerReuseEnabled(raw));
        this.targetUsd.set(readOwnerLaunchFundingUsd(raw));
        this.loadingSettings.set(false);
        if (this.reuseEnabled()) {
          this.loadPool();
        } else {
          this.loading.set(false);
        }
      },
      error: (err) => {
        this.loadingSettings.set(false);
        this.loading.set(false);
        this.toast.error(extractErrorMessage(err));
      },
    });
  }

  loadPool(): void {
    if (!this.reuseEnabled()) {
      return;
    }

    this.loading.set(true);
    this.reuseDisabledError.set(false);
    this.poolService.listPool(this.network).subscribe({
      next: (wallets) => {
        this.pool.set(wallets);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        const message = extractErrorMessage(err);
        if (getHttpStatus(err) === 400 && isTokenOwnerReuseDisabledMessage(message)) {
          this.reuseDisabledError.set(true);
          this.reuseEnabled.set(false);
          return;
        }
        this.toast.error(message);
      },
    });
  }

  createWallet(): void {
    if (!confirm(`Create a new TOKEN_OWNER wallet on ${this.network}?`)) {
      return;
    }

    this.creating.set(true);
    this.poolService.createInPool(this.network).subscribe({
      next: (created) => {
        this.creating.set(false);
        this.toast.success(`Owner wallet created — ${shortAddress(created.address)}`);
        this.loadPool();
      },
      error: (err) => {
        this.creating.set(false);
        this.handlePoolError(err);
      },
    });
  }

  prefundBest(): void {
    this.runPrefund();
  }

  prefundWallet(wallet: TokenOwnerPoolWallet): void {
    if (!this.canPrefundWallet(wallet)) {
      return;
    }
    this.runPrefund(wallet.id);
  }

  refreshWalletBalance(wallet: TokenOwnerPoolWallet): void {
    this.refreshingBalanceId.set(wallet.id);
    this.wallets.getBalance(wallet.id).subscribe({
      next: (balance) => {
        this.refreshingBalanceId.set(null);
        this.pool.update((rows) =>
          rows.map((row) =>
            row.id === wallet.id
              ? { ...row, balanceUsd: balance.balanceUsd ?? row.balanceUsd }
              : row
          )
        );
        this.toast.success('Balance refreshed from chain');
      },
      error: (err) => {
        this.refreshingBalanceId.set(null);
        this.toast.error(extractErrorMessage(err));
      },
    });
  }

  toggleWalletDetail(wallet: TokenOwnerPoolWallet): void {
    if (this.expandedWalletId() === wallet.id) {
      this.expandedWalletId.set(null);
      this.expandedDetail.set(null);
      return;
    }

    this.expandedWalletId.set(wallet.id);
    this.expandedDetail.set(null);
    this.expandedDetailLoading.set(true);
    this.wallets.getById(wallet.id).subscribe({
      next: (detail) => {
        this.expandedDetail.set(detail);
        this.expandedDetailLoading.set(false);
      },
      error: (err) => {
        this.expandedDetailLoading.set(false);
        this.toast.error(extractErrorMessage(err));
      },
    });
  }

  copyAddress(address: string): void {
    void navigator.clipboard.writeText(address).then(
      () => this.toast.success('Address copied'),
      () => this.toast.error('Could not copy address')
    );
  }

  walletStatus(wallet: TokenOwnerPoolWallet): TokenOwnerFundingStatus {
    return computeOwnerFundingStatus(
      wallet.balanceUsd,
      this.targetUsd(),
      wallet.cycleId,
      wallet.ageHours
    );
  }

  canPrefundWallet(wallet: TokenOwnerPoolWallet): boolean {
    if (this.prefunding() || this.creating() || !this.reuseEnabled()) {
      return false;
    }
    if (wallet.cycleId != null) {
      return false;
    }
    if (!wallet.isAssignable) {
      return false;
    }
    return this.walletStatus(wallet) !== 'ready';
  }

  canPrefundBest(): boolean {
    if (this.prefunding() || this.creating() || !this.reuseEnabled() || this.pool().length === 0) {
      return false;
    }
    return this.pool().some((w) => this.canPrefundWallet(w));
  }

  prefundElapsedLabel(): string {
    const sec = this.prefundElapsedSec();
    const min = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${min}:${rem.toString().padStart(2, '0')}`;
  }

  private runPrefund(walletId?: string): void {
    const label = walletId
      ? `Prefund owner wallet ${shortAddress(this.pool().find((w) => w.id === walletId)?.address ?? '')}?`
      : 'Prefund best pool candidate? This may take several minutes.';
    if (!confirm(label)) {
      return;
    }

    if (walletId) {
      this.refreshingBalanceId.set(walletId);
      this.wallets.getBalance(walletId).subscribe({
        next: () => {
          this.refreshingBalanceId.set(null);
          this.executePrefund(walletId);
        },
        error: () => {
          this.refreshingBalanceId.set(null);
          this.executePrefund(walletId);
        },
      });
      return;
    }

    this.executePrefund();
  }

  private executePrefund(walletId?: string): void {
    this.prefunding.set(true);
    this.prefundError.set(null);
    this.startPrefundTimer();

    this.poolService.prefund({ network: this.network, walletId }).subscribe({
      next: (response) => {
        this.finishPrefund(response);
      },
      error: (err) => {
        this.prefunding.set(false);
        this.stopPrefundTimer();
        this.handlePoolError(err, true);
      },
    });
  }

  private finishPrefund(response: PrefundTokenOwnerResponse): void {
    this.prefunding.set(false);
    this.stopPrefundTimer();
    this.lastPrefundByWalletId.update((map) => ({ ...map, [response.walletId]: response }));
    this.toast.success(formatPrefundToast(response));
    this.loadPool();
  }

  lastPrefundForWallet(walletId: string): PrefundTokenOwnerResponse | null {
    return this.lastPrefundByWalletId()[walletId] ?? null;
  }

  private startPrefundTimer(): void {
    this.stopPrefundTimer();
    this.prefundElapsedSec.set(0);
    this.prefundTimer = setInterval(() => {
      this.prefundElapsedSec.update((n) => n + 1);
    }, 1000);
  }

  private stopPrefundTimer(): void {
    if (this.prefundTimer) {
      clearInterval(this.prefundTimer);
      this.prefundTimer = undefined;
    }
    this.prefundElapsedSec.set(0);
  }

  private handlePoolError(err: unknown, prefund = false): void {
    const message = extractErrorMessage(err);
    if (getHttpStatus(err) === 400 && isTokenOwnerReuseDisabledMessage(message)) {
      this.reuseDisabledError.set(true);
      this.reuseEnabled.set(false);
      this.toast.error('TOKEN_OWNER reuse is disabled — enable it in Settings');
      return;
    }
    if (getHttpStatus(err) === 409 || getHttpStatus(err) === 422) {
      this.toast.error('Pool contention — please try again in a moment');
      return;
    }
    if (prefund && (getHttpStatus(err) ?? 0) >= 500) {
      this.prefundError.set(`${message} — check main fee wallet funding`);
      this.toast.error(`${message} — check main fee wallet (Treasury)`);
      return;
    }
    this.toast.error(message);
  }
}
