import { DatePipe, DecimalPipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import {
  AlertComponent,
  BadgeComponent,
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardHeaderComponent,
  ColComponent,
  RowComponent,
  SpinnerComponent,
  TableDirective,
} from '@coreui/angular';
import { CycleAnalysisService } from '../../../../../core/services/cycle-analysis.service';
import {
  CycleAnalysisResponseDto,
  CycleAnalysisWalletDto,
  InflowConfidence,
} from '../../../../../core/models/api.types';
import { GmgnQuickLinkComponent } from '../../../../../shared/components/gmgn-quick-link/gmgn-quick-link.component';
import { CycleStatusBadgeComponent } from '../../../../../shared/components/cycle-status-badge/cycle-status-badge.component';
import { ToastService } from '../../../../../shared/services/toast.service';
import { extractErrorMessage } from '../../../../../core/utils/error.util';
import { CycleStatus } from '../../../../../core/models/enums';

type WalletGroupKey = 'market' | 'tokenOwner';

@Component({
  selector: 'app-cycle-analysis-tab',
  templateUrl: './cycle-analysis-tab.component.html',
  styleUrls: ['./cycle-analysis-tab.component.scss'],
  imports: [
    RowComponent,
    ColComponent,
    CardComponent,
    CardBodyComponent,
    CardHeaderComponent,
    ButtonDirective,
    SpinnerComponent,
    AlertComponent,
    TableDirective,
    BadgeComponent,
    CycleStatusBadgeComponent,
    GmgnQuickLinkComponent,
    DatePipe,
    DecimalPipe,
  ],
})
export class CycleAnalysisTabComponent implements OnInit {
  private readonly analysisService = inject(CycleAnalysisService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  cycleId = input.required<string>();
  cycleStatus = input<CycleStatus | string>('');
  active = input(false);

  analysis = signal<CycleAnalysisResponseDto | null>(null);
  loading = signal(false);
  syncing = signal(false);
  expandedWalletKey = signal<string | null>(null);

  private autoRefreshSub?: ReturnType<typeof setInterval>;
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
      if (this.active() && this.cycleId() && !this.analysis() && !this.loading() && !this.syncing()) {
        this.load();
      }
    });

    effect(() => {
      this.configureAutoRefresh(this.cycleStatus(), this.active());
    });
  }

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => {
      if (this.autoRefreshSub) {
        clearInterval(this.autoRefreshSub);
      }
    });
  }

  load(): void {
    const id = this.cycleId();
    if (!id) return;

    this.loading.set(true);
    this.analysisService.get(id).subscribe({
      next: (data) => {
        this.analysis.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(extractErrorMessage(err));
      },
    });
  }

  syncFromChain(): void {
    const id = this.cycleId();
    if (!id) return;

    this.syncing.set(true);
    this.analysisService.sync(id).subscribe({
      next: (data) => {
        this.analysis.set(data);
        this.syncing.set(false);
      },
      error: (err) => {
        this.syncing.set(false);
        this.toast.error(extractErrorMessage(err));
      },
    });
  }

  needsSync(data: CycleAnalysisResponseDto): boolean {
    const dq = data.dataQuality;
    return (
      dq.organicInflowConfidence === 'low' ||
      dq.organicInflowConfidence === 'unavailable' ||
      dq.failedNativeSyncCount > 0 ||
      !!dq.tokenBalanceError
    );
  }

  hasLedgerDrift(data: CycleAnalysisResponseDto): boolean {
    return Math.abs(data.economics.profitLedgerDriftUsd) > 5;
  }

  confidenceBadgeColor(confidence: InflowConfidence): string {
    switch (confidence) {
      case 'high':
        return 'success';
      case 'medium':
        return 'warning';
      default:
        return 'danger';
    }
  }

  formatMultiple(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return '—';
    return `${value.toFixed(2)}x`;
  }

  formatUsd(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  formatSignedUsd(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return '—';
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${this.formatUsd(value)}`;
  }

  shortAddress(address: string, head = 6, tail = 4): string {
    if (!address || address.length <= head + tail + 3) return address;
    return `${address.slice(0, head)}…${address.slice(-tail)}`;
  }

  toggleWalletExpand(group: WalletGroupKey, wallet: CycleAnalysisWalletDto): void {
    const key = `${group}:${wallet.id}`;
    this.expandedWalletKey.update((current) => (current === key ? null : key));
  }

  isWalletExpanded(group: WalletGroupKey, walletId: string): boolean {
    return this.expandedWalletKey() === `${group}:${walletId}`;
  }

  organicInflowUsd(data: CycleAnalysisResponseDto): number | null {
    if (data.organicFlow) {
      return data.organicFlow.externalInflowUsd;
    }
    return data.economics.externalInflowUsd ?? null;
  }

  inflowConfidence(data: CycleAnalysisResponseDto): InflowConfidence {
    return data.organicFlow?.inflowConfidence ?? data.dataQuality.organicInflowConfidence;
  }

  private resetState(): void {
    this.analysis.set(null);
    this.loading.set(false);
    this.syncing.set(false);
    this.expandedWalletKey.set(null);
  }

  private configureAutoRefresh(status: CycleStatus | string, active: boolean): void {
    if (this.autoRefreshSub) {
      clearInterval(this.autoRefreshSub);
      this.autoRefreshSub = undefined;
    }

    if (!active || status !== 'MARKET_MAKING') return;

    const id = this.cycleId();
    if (!id) return;

    this.autoRefreshSub = setInterval(() => {
      this.analysisService.get(id).subscribe({
        next: (data) => this.analysis.set(data),
        error: () => undefined,
      });
    }, 30_000);
  }
}
