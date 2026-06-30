import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertComponent,
  BadgeComponent,
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardHeaderComponent,
  ColComponent,
  FormControlDirective,
  FormSelectDirective,
  PageItemComponent,
  PageLinkDirective,
  PaginationComponent,
  RowComponent,
  SpinnerComponent,
  TabDirective,
  TabPanelComponent,
  TabsComponent,
  TabsContentComponent,
  TabsListComponent,
  TableDirective,
  TooltipDirective,
} from '@coreui/angular';
import { ExternalTraderIntelligenceService } from '../../../../../core/services/external-trader-intelligence.service';
import {
  ExitScenarioEstimateDto,
  ExitStrategy,
  ExternalTraderIntelligenceSnapshotDto,
  ExternalTraderPositionStatus,
  ExternalTraderRowDto,
} from '../../../../../core/models/api.types';
import { GmgnQuickLinkComponent } from '../../../../../shared/components/gmgn-quick-link/gmgn-quick-link.component';
import { CycleStatusBadgeComponent } from '../../../../../shared/components/cycle-status-badge/cycle-status-badge.component';
import { ToastService } from '../../../../../shared/services/toast.service';
import { extractErrorMessage, getHttpStatus } from '../../../../../core/utils/error.util';
import {
  shortAddress,
  walletExplorerUrl,
} from '../../../../../core/utils/token-owner-pool.util';
import { CycleStatus } from '../../../../../core/models/enums';

type TraderViewTab = 'open' | 'closed' | 'all';
type SegmentKey = 'all' | 'openPositions' | 'closedPositions' | 'neverHeld';
type TraderSortKey =
  | 'address'
  | 'positionStatus'
  | 'tokenBalanceUsd'
  | 'buyUsd'
  | 'sellUsd'
  | 'netFlowUsd'
  | 'realizedPnlUsd'
  | 'capitalDeployedUsd'
  | 'dataComplete';

const SYNC_DEBOUNCE_MS = 10_000;
const AUTO_REFRESH_MS = 60_000;
const TRADER_PAGE_SIZE = 50;

const EXIT_STRATEGY_LABELS: Record<ExitStrategy, string> = {
  MARK_TO_MARKET: 'Current (MTM)',
  DUMP: 'Emergency dump',
  TWAP: 'TWAP',
  STEP_PROFIT: 'Step profit',
};

const POSITION_STATUS_COLORS: Record<ExternalTraderPositionStatus, string> = {
  OPEN: 'success',
  CLOSED: 'secondary',
  NEVER_HELD: 'light',
};

@Component({
  selector: 'app-cycle-external-traders-tab',
  templateUrl: './cycle-external-traders-tab.component.html',
  styleUrls: ['./cycle-external-traders-tab.component.scss'],
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
    TabsComponent,
    TabsListComponent,
    TabDirective,
    TabsContentComponent,
    TabPanelComponent,
    PaginationComponent,
    PageItemComponent,
    PageLinkDirective,
    FormControlDirective,
    FormSelectDirective,
    FormsModule,
    TooltipDirective,
    DatePipe,
    DecimalPipe,
    NgTemplateOutlet,
  ],
})
export class CycleExternalTradersTabComponent implements OnInit {
  private readonly service = inject(ExternalTraderIntelligenceService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  cycleId = input.required<string>();
  cycleStatus = input<CycleStatus | string>('');
  active = input(false);

  snapshot = signal<ExternalTraderIntelligenceSnapshotDto | null>(null);
  loading = signal(false);
  syncing = signal(false);
  tokenUnavailable = signal(false);
  loadError = signal<string | null>(null);

  traderViewTab = signal<TraderViewTab>('open');
  searchQuery = signal('');
  positionFilter = signal<ExternalTraderPositionStatus | ''>('');
  dataCompleteFilter = signal<'all' | 'complete' | 'incomplete'>('all');
  sortKey = signal<TraderSortKey>('tokenBalanceUsd');
  sortDir = signal<'asc' | 'desc'>('desc');
  traderPage = signal(1);
  showDetailsPanel = signal(false);

  private autoRefreshSub?: ReturnType<typeof setInterval>;
  private loadedForCycleId = '';
  private lastSyncAt = 0;

  readonly traderPageSize = TRADER_PAGE_SIZE;
  readonly exitStrategyLabels = EXIT_STRATEGY_LABELS;
  readonly positionStatusColors = POSITION_STATUS_COLORS;
  readonly segmentKeys: SegmentKey[] = ['all', 'openPositions', 'closedPositions', 'neverHeld'];

  readonly filteredTraders = computed(() => {
    const data = this.snapshot();
    if (!data) return [];

    let rows: ExternalTraderRowDto[];
    const tab = this.traderViewTab();
    if (tab === 'open') {
      rows = data.topOpenPositions.length > 0 ? data.topOpenPositions : data.traders.filter((t) => t.positionStatus === 'OPEN');
    } else if (tab === 'closed') {
      rows =
        data.topClosedTraders.length > 0
          ? data.topClosedTraders
          : data.traders.filter((t) => t.positionStatus === 'CLOSED');
    } else {
      rows = data.traders;
    }

    const query = this.searchQuery().trim().toLowerCase();
    if (query) {
      rows = rows.filter((t) => t.address.toLowerCase().includes(query));
    }

    const posFilter = this.positionFilter();
    if (posFilter) {
      rows = rows.filter((t) => t.positionStatus === posFilter);
    }

    const dcFilter = this.dataCompleteFilter();
    if (dcFilter === 'complete') {
      rows = rows.filter((t) => t.dataComplete);
    } else if (dcFilter === 'incomplete') {
      rows = rows.filter((t) => !t.dataComplete);
    }

    const key = this.sortKey();
    const dir = this.sortDir();
    return [...rows].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (typeof av === 'string' && typeof bv === 'string') {
        return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      if (typeof av === 'boolean' && typeof bv === 'boolean') {
        return dir === 'asc' ? Number(av) - Number(bv) : Number(bv) - Number(av);
      }
      const an = Number(av) || 0;
      const bn = Number(bv) || 0;
      return dir === 'asc' ? an - bn : bn - an;
    });
  });

  readonly paginatedTraders = computed(() => {
    const all = this.filteredTraders();
    const page = this.traderPage();
    const start = (page - 1) * TRADER_PAGE_SIZE;
    return all.slice(start, start + TRADER_PAGE_SIZE);
  });

  readonly traderTotalPages = computed(() => {
    const total = this.filteredTraders().length;
    return Math.max(1, Math.ceil(total / TRADER_PAGE_SIZE));
  });

  readonly bestExitScenario = computed(() => {
    const scenarios = this.snapshot()?.exitScenarios ?? [];
    if (scenarios.length === 0) return null;
    return scenarios.reduce((best, cur) =>
      cur.totalFinalUsd > best.totalFinalUsd ? cur : best,
    );
  });

  readonly externalDumpRisk = computed(() => {
    const data = this.snapshot();
    if (!data) return false;
    const openUsd = data.summary.openPositions.openPositionUsd;
    const openCount = data.summary.openPositions.traderCount;
    return openUsd >= 1000 || openCount >= 20;
  });

  constructor() {
    effect(() => {
      const id = this.cycleId();
      if (id && id !== this.loadedForCycleId) {
        this.loadedForCycleId = id;
        this.resetState();
      }
    });

    effect(() => {
      if (this.active() && this.cycleId() && !this.snapshot() && !this.loading() && !this.syncing() && !this.tokenUnavailable()) {
        this.sync();
      }
    });

    effect(() => {
      this.configureAutoRefresh(this.cycleStatus(), this.active());
    });

    effect(() => {
      this.searchQuery();
      this.positionFilter();
      this.dataCompleteFilter();
      this.traderViewTab();
      this.traderPage.set(1);
    });
  }

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => {
      if (this.autoRefreshSub) {
        clearInterval(this.autoRefreshSub);
      }
    });
  }

  sync(): void {
    const id = this.cycleId();
    if (!id) return;

    const now = Date.now();
    if (this.syncing()) return;
    if (now - this.lastSyncAt < SYNC_DEBOUNCE_MS && this.snapshot()) {
      this.toast.error('Please wait at least 10 seconds between syncs.');
      return;
    }

    this.syncing.set(true);
    this.loadError.set(null);
    this.service.sync(id).subscribe({
      next: (data) => {
        this.snapshot.set(data);
        this.syncing.set(false);
        this.tokenUnavailable.set(false);
        this.lastSyncAt = Date.now();
      },
      error: (err) => {
        this.syncing.set(false);
        const status = getHttpStatus(err);
        const message = extractErrorMessage(err);
        if (status === 404 && /token/i.test(message)) {
          this.tokenUnavailable.set(true);
          this.loadError.set(null);
        } else {
          this.loadError.set(message);
          this.toast.error(message);
        }
      },
    });
  }

  retryLoad(): void {
    this.loadError.set(null);
    this.tokenUnavailable.set(false);
    this.snapshot.set(null);
    this.sync();
  }

  isDataHealthy(data: ExternalTraderIntelligenceSnapshotDto): boolean {
    return (
      data.coverage.completeness === 'full' &&
      data.coverage.coveragePercent >= 99 &&
      data.reconciliation.isReconciled &&
      data.reconciliation.incompleteTraderCount === 0
    );
  }

  healthWarnings(data: ExternalTraderIntelligenceSnapshotDto): string[] {
    const warnings: string[] = [];
    if (data.coverage.completeness !== 'full') {
      warnings.push('Holder coverage incomplete — on-chain scan was not fully successful.');
    }
    if (data.coverage.coveragePercent < 99) {
      warnings.push(`${data.coverage.coveragePercent.toFixed(1)}% of reported holders identified.`);
    }
    if (data.reconciliation.incompleteTraderCount > 0) {
      warnings.push(
        `${data.reconciliation.incompleteTraderCount} wallet(s) missing complete buy/sell data.`,
      );
    }
    if (!data.reconciliation.isReconciled) {
      warnings.push(...data.reconciliation.notes);
    }
    return warnings;
  }

  completenessBadgeColor(completeness: string): string {
    switch (completeness) {
      case 'full':
        return 'success';
      case 'partial':
        return 'warning';
      default:
        return 'danger';
    }
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

  formatDuration(sec: number | null | undefined): string {
    if (sec == null || sec <= 0) return '—';
    if (sec < 60) return `~${sec}s`;
    const min = Math.round(sec / 60);
    return `~${min} min`;
  }

  formatPercent(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return '—';
    return `${value.toFixed(2)}%`;
  }

  shortAddress = shortAddress;
  walletExplorerUrl = walletExplorerUrl;

  toggleSort(key: TraderSortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortDir.set(key === 'address' || key === 'positionStatus' ? 'asc' : 'desc');
    }
  }

  sortIndicator(key: TraderSortKey): string {
    if (this.sortKey() !== key) return '';
    return this.sortDir() === 'asc' ? ' ↑' : ' ↓';
  }

  onTraderPageChange(page: number): void {
    const clamped = Math.min(Math.max(1, page), this.traderTotalPages());
    this.traderPage.set(clamped);
  }

  exportCsv(): void {
    const data = this.snapshot();
    if (!data || data.traders.length === 0) return;

    const headers = [
      'address',
      'positionStatus',
      'tokenBalance',
      'tokenBalanceUsd',
      'buyUsd',
      'sellUsd',
      'netFlowUsd',
      'buyCount',
      'sellCount',
      'realizedPnlUsd',
      'capitalDeployedUsd',
      'dataComplete',
      'missingFields',
      'sources',
    ];

    const escape = (v: string | number | boolean) => {
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const lines = [
      headers.join(','),
      ...data.traders.map((t) =>
        [
          t.address,
          t.positionStatus,
          t.tokenBalance,
          t.tokenBalanceUsd,
          t.buyUsd,
          t.sellUsd,
          t.netFlowUsd,
          t.buyCount,
          t.sellCount,
          t.realizedPnlUsd,
          t.capitalDeployedUsd,
          t.dataComplete,
          t.missingFields.join('|'),
          t.sources.join('|'),
        ]
          .map(escape)
          .join(','),
      ),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `external-traders-${data.cycleId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  isBestExitScenario(scenario: ExitScenarioEstimateDto): boolean {
    const best = this.bestExitScenario();
    return best?.strategy === scenario.strategy;
  }

  isHighSlippage(scenario: ExitScenarioEstimateDto): boolean {
    return scenario.strategy === 'DUMP' && scenario.slippagePercent >= 3;
  }

  assumptionsTooltip(scenario: ExitScenarioEstimateDto): string {
    return scenario.assumptions?.length ? scenario.assumptions.join('\n') : scenario.label;
  }

  segmentLabel(key: SegmentKey): string {
    switch (key) {
      case 'all':
        return 'All external';
      case 'openPositions':
        return 'Open positions';
      case 'closedPositions':
        return 'Closed';
      case 'neverHeld':
        return 'Never held';
    }
  }

  private resetState(): void {
    this.snapshot.set(null);
    this.loading.set(false);
    this.syncing.set(false);
    this.tokenUnavailable.set(false);
    this.loadError.set(null);
    this.traderViewTab.set('open');
    this.searchQuery.set('');
    this.positionFilter.set('');
    this.dataCompleteFilter.set('all');
    this.traderPage.set(1);
    this.lastSyncAt = 0;
  }

  private configureAutoRefresh(status: CycleStatus | string, tabActive: boolean): void {
    if (this.autoRefreshSub) {
      clearInterval(this.autoRefreshSub);
      this.autoRefreshSub = undefined;
    }

    if (!tabActive || (status !== 'MONITORING' && status !== 'MARKET_MAKING')) return;

    const id = this.cycleId();
    if (!id) return;

    this.autoRefreshSub = setInterval(() => {
      if (this.syncing()) return;
      const now = Date.now();
      if (now - this.lastSyncAt < SYNC_DEBOUNCE_MS) return;

      this.service.sync(id).subscribe({
        next: (data) => {
          this.snapshot.set(data);
          this.lastSyncAt = Date.now();
        },
        error: () => undefined,
      });
    }, AUTO_REFRESH_MS);
  }
}
