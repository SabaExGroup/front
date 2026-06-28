import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  AlertComponent,
  BadgeComponent,
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardHeaderComponent,
  ColComponent,
  FormCheckComponent,
  FormCheckInputDirective,
  FormCheckLabelDirective,
  FormControlDirective,
  FormLabelDirective,
  FormSelectDirective,
  PageItemComponent,
  PageLinkDirective,
  PaginationComponent,
  ProgressComponent,
  RowComponent,
  SpinnerComponent,
  TabDirective,
  TabPanelComponent,
  TabsComponent,
  TabsContentComponent,
  TabsListComponent,
  TableDirective,
} from '@coreui/angular';
import { CycleStatusBadgeComponent } from '../../../shared/components/cycle-status-badge/cycle-status-badge.component';
import { CyclesService } from '../../../core/services/cycles.service';
import { WalletsService } from '../../../core/services/wallets.service';
import { ProfitExtractorService, TokenAnalysisService } from '../../../core/services/profit-extractor.service';
import { CycleOpsService } from '../../../core/services/cycle-ops.service';
import { MainFeeWalletService } from '../../../core/services/main-fee-wallet.service';
import { ToastService } from '../../../shared/services/toast.service';
import {
  CycleDetailResponseDto,
  CycleMarketWalletBalanceRowDto,
  CycleMarketWalletBalancesResponseDto,
  CycleResumeSnapshotResponseDto,
  CycleRetryResponseDto,
  LaunchpadRecommendationDto,
  LiquidityAnalysisResponseDto,
  MarketSessionDetailResponseDto,
  ProfitExtractorJobResponseDto,
  ProfitExtractorLogDto,
  ProfitExtractorStatusResponseDto,
  SecurityReportResponseDto,
  TokenInfoResponseDto,
  TokenLaunchResponseDto,
  TrendPackageResponseDto,
  WalletBalanceResponseDto,
  WalletSummaryDto,
} from '../../../core/models/api.types';
import {
  CYCLE_STEPS,
  CYCLE_STATUSES,
  CycleStep,
  isTerminalCycleStatus,
  jobStatusBadgeColor,
  tokenSentimentBadgeColor,
  LAUNCHPADS,
  Launchpad,
  NETWORKS,
  Network,
  RetryMode,
  WALLET_TYPES,
  WalletType,
} from '../../../core/models/enums';
import { extractErrorMessage } from '../../../core/utils/error.util';
import { ApiService } from '../../../core/http/api.service';

type CycleTab = 'overview' | 'wallets' | 'profit' | 'analysis' | 'ops';

@Component({
  selector: 'app-cycle-detail',
  templateUrl: './cycle-detail.component.html',
  styleUrls: ['./cycle-detail.component.scss'],
  imports: [
    RowComponent,
    ColComponent,
    CardComponent,
    CardBodyComponent,
    CardHeaderComponent,
    ButtonDirective,
    RouterLink,
    CycleStatusBadgeComponent,
    SpinnerComponent,
    AlertComponent,
    TableDirective,
    BadgeComponent,
    DatePipe,
    DecimalPipe,
    CurrencyPipe,
    FormsModule,
    FormControlDirective,
    FormLabelDirective,
    FormSelectDirective,
    FormCheckComponent,
    FormCheckInputDirective,
    FormCheckLabelDirective,
    ProgressComponent,
    PaginationComponent,
    PageItemComponent,
    PageLinkDirective,
    TabDirective,
    TabPanelComponent,
    TabsComponent,
    TabsContentComponent,
    TabsListComponent,
  ],
})
export class CycleDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cycles = inject(CyclesService);
  private readonly wallets = inject(WalletsService);
  private readonly profit = inject(ProfitExtractorService);
  private readonly analysis = inject(TokenAnalysisService);
  private readonly ops = inject(CycleOpsService);
  private readonly mainFee = inject(MainFeeWalletService);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  cycleId = signal('');
  cycle = signal<CycleDetailResponseDto | null>(null);
  resumeSnapshot = signal<CycleResumeSnapshotResponseDto | null>(null);
  lastRetry = signal<CycleRetryResponseDto | null>(null);

  activeTab = signal<CycleTab>('overview');
  loading = signal(true);
  actionLoading = signal(false);
  polling = signal(false);

  // Retry form
  retryMode: RetryMode = 'resume';
  retryForce = false;
  retryFromStep: CycleStep | '' = '';
  retryRegenerateTrend = false;
  retryDryRun = false;

  // Wallets
  walletList = signal<WalletSummaryDto[]>([]);
  walletTotal = signal(0);
  walletPage = signal(1);
  walletLimit = signal(50);
  walletNetworkFilter: Network | '' = '';
  walletTypeFilter: WalletType | '' = '';
  walletsLoading = signal(false);
  marketBalances = signal<CycleMarketWalletBalancesResponseDto | null>(null);
  marketBalancesLoading = signal(false);
  marketBalancesSyncing = signal(false);
  selectedWalletIds = signal<Set<string>>(new Set());
  expandedWalletId = signal<string | null>(null);
  expandedWalletBalance = signal<WalletBalanceResponseDto | null>(null);
  balanceLoading = signal(false);
  generateNetwork: Network = 'SOLANA';
  generateType: WalletType = 'MARKET';
  generateCount = 10;
  fundSourceAsset: 'USDC' | 'ETH' = 'USDC';
  fundAmountPerWallet = 0.1;

  // Profit
  profitStatus = signal<ProfitExtractorStatusResponseDto | null>(null);
  profitLogs = signal<ProfitExtractorLogDto[]>([]);
  profitLogsTotal = signal(0);
  profitLogsPage = signal(1);
  profitForce = false;
  lastProfitJob = signal<ProfitExtractorJobResponseDto | null>(null);
  profitLoading = signal(false);

  // Analysis
  tokenInfo = signal<TokenInfoResponseDto | null>(null);
  liquidity = signal<LiquidityAnalysisResponseDto | null>(null);
  security = signal<SecurityReportResponseDto | null>(null);
  analysisLoading = signal(false);

  // Ops
  bestLaunchpad = signal<LaunchpadRecommendationDto | null>(null);
  marketDetail = signal<MarketSessionDetailResponseDto | null>(null);
  lastLaunch = signal<TokenLaunchResponseDto | null>(null);
  lastTrend = signal<TrendPackageResponseDto | null>(null);
  opsLaunchpad: Launchpad | '' = '';
  opsLaunchDryRun = false;
  regenerateStyle: 'viral' | 'controversial' | 'meme' | '' = '';
  opsLoading = signal(false);

  readonly pipelineSteps = CYCLE_STEPS;
  readonly cycleStatuses = CYCLE_STATUSES;
  readonly networkOptions = NETWORKS;
  readonly launchpadOptions = LAUNCHPADS;
  readonly walletTypeOptions = WALLET_TYPES;
  readonly jobStatusBadgeColor = jobStatusBadgeColor;
  readonly tokenSentimentBadgeColor = tokenSentimentBadgeColor;

  private pollSub?: Subscription;
  private marketPollSub?: Subscription;
  private loadedCycleId = '';

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id') ?? '';
      if (id !== this.loadedCycleId) {
        this.resetCycleScopedState();
        this.loadedCycleId = id;
      }
      this.cycleId.set(id);
      this.load(id);
    });

    this.destroyRef.onDestroy(() => {
      this.pollSub?.unsubscribe();
      this.marketPollSub?.unsubscribe();
    });
  }

  onTabChange(key: string | number | undefined): void {
    if (typeof key === 'string') {
      this.activeTab.set(key as CycleTab);
      this.onTabActivated(key as CycleTab);
    }
  }

  private onTabActivated(tab: CycleTab): void {
    if (tab === 'wallets') {
      if (this.walletList().length === 0) {
        this.loadWallets();
      }
      if (this.needsMarketBalancesLoad()) {
        this.loadMarketBalances();
      }
    }
    if (tab === 'profit' && !this.profitStatus()) {
      this.loadProfit();
    }
    if (tab === 'analysis' && this.cycle()?.token?.address && !this.tokenInfo()) {
      this.loadAnalysis();
    }
    if (tab === 'ops' && this.cycle()?.marketSessionId && !this.marketDetail()) {
      this.refreshMarketSession();
    }
  }

  private needsMarketBalancesLoad(): boolean {
    const cached = this.marketBalances();
    return !cached || cached.cycleId !== this.cycleId();
  }

  private resetCycleScopedState(): void {
    this.walletList.set([]);
    this.walletTotal.set(0);
    this.walletPage.set(1);
    this.selectedWalletIds.set(new Set());
    this.expandedWalletId.set(null);
    this.expandedWalletBalance.set(null);
    this.marketBalances.set(null);
    this.marketBalancesLoading.set(false);
    this.marketBalancesSyncing.set(false);
    this.tokenInfo.set(null);
    this.liquidity.set(null);
    this.security.set(null);
    this.analysisLoading.set(false);
    this.profitStatus.set(null);
    this.profitLogs.set([]);
    this.profitLogsTotal.set(0);
    this.profitLogsPage.set(1);
    this.marketDetail.set(null);
    this.bestLaunchpad.set(null);
    this.lastLaunch.set(null);
    this.lastTrend.set(null);
    this.resumeSnapshot.set(null);
  }

  load(id: string): void {
    this.loading.set(true);
    this.pollSub?.unsubscribe();

    this.cycles.getById(id).subscribe({
      next: (detail) => {
        this.cycle.set(detail);
        this.loading.set(false);
        this.startPollingIfNeeded(id, detail);
        this.loadResumeSnapshot(id, detail.status);
        if (detail.network) {
          this.generateNetwork = detail.network;
        }
        this.onTabActivated(this.activeTab());
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(extractErrorMessage(err));
      },
    });
  }

  refresh(): void {
    this.load(this.cycleId());
  }

  pipelineIndex(status: string): number {
    const idx = CYCLE_STEPS.indexOf(status as CycleStep);
    if (idx >= 0) return idx;
    if (status === 'COMPLETED') return CYCLE_STEPS.length;
    if (status === 'PENDING') return -1;
    return -1;
  }

  stepState(step: CycleStep, status: string): 'done' | 'current' | 'pending' | 'failed' {
    if (status === 'FAILED' || status === 'ABORTED') {
      const failedAt = this.resumeSnapshot()?.failedAtStep;
      const stepIdx = CYCLE_STEPS.indexOf(step);
      const failedIdx = failedAt ? CYCLE_STEPS.indexOf(failedAt) : -1;
      if (failedIdx >= 0 && stepIdx === failedIdx) return 'failed';
      if (failedIdx >= 0 && stepIdx < failedIdx) return 'done';
      return 'pending';
    }
    const currentIdx = this.pipelineIndex(status);
    const stepIdx = CYCLE_STEPS.indexOf(step);
    if (currentIdx < 0) return 'pending';
    if (stepIdx < currentIdx) return 'done';
    if (stepIdx === currentIdx) return 'current';
    if (status === 'COMPLETED') return 'done';
    return 'pending';
  }

  logoUrl(): string | null {
    const logo = this.cycle()?.trendPackage?.logoUrl;
    if (!logo) return null;
    const filename = logo.split('/').pop();
    return filename ? this.api.assetLogoUrl(filename) : logo;
  }

  canAbort(): boolean {
    const status = this.cycle()?.status;
    return !!status && !isTerminalCycleStatus(status);
  }

  canRetry(): boolean {
    const status = this.cycle()?.status;
    return (status === 'FAILED' || status === 'ABORTED') && !!this.resumeSnapshot()?.canResume;
  }

  abortCycle(): void {
    if (!confirm('Abort this cycle?')) return;
    this.actionLoading.set(true);
    this.cycles.abort(this.cycleId()).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.toast.success('Cycle aborted');
        this.load(this.cycleId());
      },
      error: (err) => {
        this.actionLoading.set(false);
        this.toast.error(extractErrorMessage(err));
      },
    });
  }

  retryCycle(): void {
    const snap = this.resumeSnapshot();
    if (!snap?.canResume) {
      this.toast.warning('Cycle cannot be resumed');
      return;
    }
    const fromStep = this.retryFromStep || snap.suggestedResumeStep;
    if (!confirm(`${this.retryMode === 'restart' ? 'Restart' : 'Resume'} cycle${fromStep ? ` from ${fromStep}` : ''}?`)) return;

    this.actionLoading.set(true);
    this.cycles.retry(this.cycleId(), {
      mode: this.retryMode,
      force: this.retryForce,
      fromStep: fromStep || undefined,
      regenerateTrend: this.retryRegenerateTrend,
      dryRun: this.retryDryRun,
    }).subscribe({
      next: (res) => {
        this.actionLoading.set(false);
        this.lastRetry.set(res);
        this.toast.success(`Retry queued — ${res.status}`);
        this.load(this.cycleId());
      },
      error: (err) => {
        this.actionLoading.set(false);
        this.toast.error(extractErrorMessage(err));
      },
    });
  }

  loadWallets(): void {
    this.walletsLoading.set(true);
    this.wallets.list({
      cycleId: this.cycleId(),
      page: this.walletPage(),
      limit: this.walletLimit(),
      network: this.walletNetworkFilter || undefined,
      type: this.walletTypeFilter || undefined,
    }).subscribe({
      next: (res) => {
        this.walletList.set(res.data);
        this.walletTotal.set(res.total);
        this.walletsLoading.set(false);
      },
      error: (err) => {
        this.walletsLoading.set(false);
        this.toast.error(extractErrorMessage(err));
      },
    });
  }

  loadMarketBalances(): void {
    const cycleId = this.cycleId();
    if (!cycleId) {
      return;
    }
    this.marketBalancesLoading.set(true);
    this.wallets.getCycleMarketBalances(cycleId).subscribe({
      next: (res) => {
        this.marketBalances.set(res);
        this.marketBalancesLoading.set(false);
      },
      error: (err) => {
        this.marketBalancesLoading.set(false);
        this.toast.error(extractErrorMessage(err));
      },
    });
  }

  syncMarketBalances(): void {
    const cycleId = this.cycleId();
    if (!cycleId) {
      return;
    }
    this.marketBalancesSyncing.set(true);
    this.wallets.syncCycleMarketBalances(cycleId).subscribe({
      next: (res) => {
        this.marketBalances.set(res);
        this.marketBalancesSyncing.set(false);
        this.loadWallets();
        if (res.failedSyncCount > 0) {
          this.toast.warning(
            `Synced with ${res.failedSyncCount} wallet failure${res.failedSyncCount === 1 ? '' : 's'}`,
          );
        } else {
          this.toast.success('Market balances synced from chain');
        }
      },
      error: (err) => {
        this.marketBalancesSyncing.set(false);
        this.toast.error(extractErrorMessage(err));
      },
    });
  }

  walletPages(): number {
    return Math.max(1, Math.ceil(this.walletTotal() / this.walletLimit()));
  }

  walletPageNumbers(): number[] {
    return this.pageNumbersFor(this.walletPage(), this.walletPages());
  }

  goWalletPage(p: number): void {
    if (p < 1 || p > this.walletPages()) return;
    this.walletPage.set(p);
    this.loadWallets();
  }

  toggleWalletSelection(id: string, checked: boolean): void {
    this.selectedWalletIds.update((set) => {
      const next = new Set(set);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  isWalletSelected(id: string): boolean {
    return this.selectedWalletIds().has(id);
  }

  toggleWalletExpand(wallet: WalletSummaryDto): void {
    if (this.expandedWalletId() === wallet.id) {
      this.expandedWalletId.set(null);
      this.expandedWalletBalance.set(null);
      return;
    }
    this.expandedWalletId.set(wallet.id);
    this.balanceLoading.set(true);
    this.wallets.getBalance(wallet.id).subscribe({
      next: (bal) => {
        this.expandedWalletBalance.set(bal);
        this.balanceLoading.set(false);
      },
      error: (err) => {
        this.balanceLoading.set(false);
        this.toast.error(extractErrorMessage(err));
      },
    });
  }

  generateWallets(): void {
    if (!confirm(`Generate ${this.generateCount} ${this.generateType} wallets on ${this.generateNetwork}?`)) return;
    this.actionLoading.set(true);
    this.wallets.generate({
      network: this.generateNetwork,
      type: this.generateType,
      count: this.generateCount,
      cycleId: this.cycleId(),
    }).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.toast.success('Wallets generated');
        this.walletPage.set(1);
        this.loadWallets();
        this.loadMarketBalances();
      },
      error: (err) => {
        this.actionLoading.set(false);
        this.toast.error(extractErrorMessage(err));
      },
    });
  }

  fundSelectedWallets(): void {
    const ids = [...this.selectedWalletIds()];
    if (ids.length === 0) {
      this.toast.warning('Select at least one wallet');
      return;
    }
    const network = this.walletNetworkFilter || this.cycle()?.network || 'SOLANA';
    if (!confirm(`Fund ${ids.length} wallet(s)?`)) return;

    this.actionLoading.set(true);
    this.mainFee.fund({
      cycleId: this.cycleId(),
      walletIds: ids,
      sourceAsset: this.fundSourceAsset,
      targetNetwork: network as Network,
      amountPerWalletUsd: this.fundAmountPerWallet,
    }).subscribe({
      next: (res) => {
        this.actionLoading.set(false);
        this.toast.info(`Funding job ${res.jobId} — ${res.status}`);
        this.selectedWalletIds.set(new Set());
      },
      error: (err) => {
        this.actionLoading.set(false);
        this.toast.error(extractErrorMessage(err));
      },
    });
  }

  loadProfit(): void {
    this.profitLoading.set(true);
    const id = this.cycleId();
    this.profit.getStatus(id).subscribe({
      next: (status) => {
        this.profitStatus.set(status);
        this.profitLoading.set(false);
      },
      error: (err) => {
        this.profitLoading.set(false);
        this.toast.error(extractErrorMessage(err));
      },
    });
    this.loadProfitLogs();
  }

  loadProfitLogs(): void {
    this.profit.getLogs({
      cycleId: this.cycleId(),
      page: this.profitLogsPage(),
      limit: 20,
    }).subscribe({
      next: (logs) => {
        this.profitLogs.set(logs.data);
        this.profitLogsTotal.set(logs.total);
      },
    });
  }

  profitLogsLimit = 20;

  profitLogsPages(): number {
    return Math.max(1, Math.ceil(this.profitLogsTotal() / this.profitLogsLimit));
  }

  profitLogsPageNumbers(): number[] {
    return this.pageNumbersFor(this.profitLogsPage(), this.profitLogsPages());
  }

  goProfitLogsPage(p: number): void {
    if (p < 1 || p > this.profitLogsPages()) return;
    this.profitLogsPage.set(p);
    this.loadProfitLogs();
  }

  private pageNumbersFor(current: number, total: number): number[] {
    const window = 5;
    let start = Math.max(1, current - Math.floor(window / 2));
    const end = Math.min(total, start + window - 1);
    start = Math.max(1, end - window + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  runProfitExtraction(): void {
    if (!confirm('Run profit extraction?')) return;
    this.profit.run({ cycleId: this.cycleId(), force: this.profitForce }).subscribe({
      next: (res) => {
        this.lastProfitJob.set(res);
        this.toast.info(`Profit job — ${res.status}`);
        this.loadProfit();
      },
      error: (err) => this.toast.error(extractErrorMessage(err)),
    });
  }

  profitHeldProgress(): number {
    const ps = this.profitStatus();
    if (!ps?.heldPercent || !ps.maxPercent) return 0;
    return Math.min(100, Math.round((ps.heldPercent / ps.maxPercent) * 100));
  }

  loadAnalysis(): void {
    const address = this.cycle()?.token?.address;
    const network = this.cycle()?.network ?? 'SOLANA';
    if (!address) {
      this.toast.warning('No token address yet');
      return;
    }
    this.analysisLoading.set(true);
    let pending = 3;
    const finish = (): void => {
      pending -= 1;
      if (pending === 0) {
        this.analysisLoading.set(false);
      }
    };

    this.analysis.getTokenInfo(address, network).subscribe({
      next: (info) => this.tokenInfo.set(info),
      error: (err) => this.toast.error(extractErrorMessage(err)),
      complete: finish,
    });
    this.analysis.getLiquidity(address, network, this.cycle()?.launchpad ?? undefined).subscribe({
      next: (liq) => this.liquidity.set(liq),
      error: (err) => this.toast.error(extractErrorMessage(err)),
      complete: finish,
    });
    this.analysis.checkSecurity(network, address).subscribe({
      next: (sec) => this.security.set(sec),
      error: (err) => this.toast.error(extractErrorMessage(err)),
      complete: finish,
    });
  }

  marketBalanceSourceLabel(wallet: CycleMarketWalletBalanceRowDto): string {
    if (wallet.syncError) {
      return wallet.syncError;
    }
    if (wallet.fromCache === true) {
      return 'RPC (cached)';
    }
    if (wallet.fromCache === false) {
      return 'RPC';
    }
    return 'DB stored';
  }

  loadBestLaunchpad(): void {
    const network = this.cycle()?.network ?? 'SOLANA';
    this.opsLoading.set(true);
    this.ops.getBestLaunchpad(network).subscribe({
      next: (rec) => {
        this.bestLaunchpad.set(rec);
        this.opsLoading.set(false);
      },
      error: (err) => {
        this.opsLoading.set(false);
        this.toast.error(extractErrorMessage(err));
      },
    });
  }

  regenerateTrend(): void {
    if (!confirm('Regenerate trend package for this cycle?')) return;
    this.opsLoading.set(true);
    this.ops.regenerateTrend(this.cycleId(), {
      style: this.regenerateStyle || undefined,
    }).subscribe({
      next: (trend) => {
        this.lastTrend.set(trend);
        this.opsLoading.set(false);
        this.toast.success('Trend regenerated');
        this.load(this.cycleId());
      },
      error: (err) => {
        this.opsLoading.set(false);
        this.toast.error(extractErrorMessage(err));
      },
    });
  }

  launchToken(): void {
    if (!confirm('Launch token manually?')) return;
    this.opsLoading.set(true);
    this.ops.launchToken({
      cycleId: this.cycleId(),
      launchpad: this.opsLaunchpad || undefined,
      dryRun: this.opsLaunchDryRun,
    }).subscribe({
      next: (res) => {
        this.lastLaunch.set(res);
        this.opsLoading.set(false);
        this.toast.success(res.dryRun ? 'Dry run launch complete' : 'Token launched');
        this.load(this.cycleId());
      },
      error: (err) => {
        this.opsLoading.set(false);
        this.toast.error(extractErrorMessage(err));
      },
    });
  }

  startMarket(): void {
    const tokenId = this.cycle()?.tokenId;
    if (!tokenId) {
      this.toast.warning('Token ID not available yet');
      return;
    }
    if (!confirm('Start market making session?')) return;
    this.opsLoading.set(true);
    this.ops.startMarket({ cycleId: this.cycleId(), tokenId }).subscribe({
      next: () => {
        this.opsLoading.set(false);
        this.toast.success('Market session started');
        this.load(this.cycleId());
      },
      error: (err) => {
        this.opsLoading.set(false);
        this.toast.error(extractErrorMessage(err));
      },
    });
  }

  refreshMarketSession(): void {
    const sessionId = this.cycle()?.marketSessionId;
    if (!sessionId) return;
    this.ops.getMarketSession(sessionId).subscribe({
      next: (detail) => this.marketDetail.set(detail),
      error: (err) => this.toast.error(extractErrorMessage(err)),
    });
  }

  stopMarket(): void {
    const sessionId = this.cycle()?.marketSessionId;
    if (!sessionId) return;
    if (!confirm('Stop market making session?')) return;
    this.opsLoading.set(true);
    this.ops.stopMarket(sessionId).subscribe({
      next: () => {
        this.opsLoading.set(false);
        this.toast.success('Market session stopped');
        this.refreshMarketSession();
        this.load(this.cycleId());
      },
      error: (err) => {
        this.opsLoading.set(false);
        this.toast.error(extractErrorMessage(err));
      },
    });
  }

  analysisEntries(obj: Record<string, unknown> | null | undefined): { key: string; value: unknown }[] {
    if (!obj) return [];
    return Object.entries(obj).map(([key, value]) => ({ key, value }));
  }

  private loadResumeSnapshot(id: string, status: string): void {
    if (status === 'FAILED' || status === 'ABORTED') {
      this.cycles.getResumeSnapshot(id).subscribe({
        next: (snap) => {
          this.resumeSnapshot.set(snap);
          if (snap.suggestedResumeStep && !this.retryFromStep) {
            this.retryFromStep = snap.suggestedResumeStep;
          }
        },
      });
    } else {
      this.resumeSnapshot.set(null);
    }
  }

  private startPollingIfNeeded(id: string, detail: CycleDetailResponseDto): void {
    if (isTerminalCycleStatus(detail.status)) {
      this.polling.set(false);
      return;
    }
    this.polling.set(true);
    this.pollSub = this.cycles.pollDetail(id, (updated) => {
      this.cycle.set(updated);
      if (isTerminalCycleStatus(updated.status)) {
        this.polling.set(false);
        this.loadResumeSnapshot(id, updated.status);
      }
    });
  }
}
