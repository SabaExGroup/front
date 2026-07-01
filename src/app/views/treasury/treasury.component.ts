import { CurrencyPipe, DatePipe, KeyValuePipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  AlertComponent,
  BadgeComponent,
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardHeaderComponent,
  ColComponent,
  FormControlDirective,
  FormLabelDirective,
  FormSelectDirective,
  ProgressComponent,
  RowComponent,
  SpinnerComponent,
  TabDirective,
  TabPanelComponent,
  TabsComponent,
  TabsContentComponent,
  TabsListComponent,
} from '@coreui/angular';
import { TreasuryService } from '../../core/services/treasury.service';
import { MainFeeWalletService } from '../../core/services/main-fee-wallet.service';
import { SettingsService } from '../../core/services/settings.service';
import { HealthService } from '../../core/services/health.service';
import { CyclesService } from '../../core/services/cycles.service';
import { ToastService } from '../../shared/services/toast.service';
import {
  CycleResponseDto,
  IntegrationsHealthResponseDto,
  MainFeeWalletResponseDto,
  TreasuryConsolidateJobDetailDto,
  TreasuryLifecycleJobResponseDto,
} from '../../core/models/api.types';
import {
  EmergencyBrakeScope,
  jobStatusBadgeColor,
  Network,
  treasuryPhaseBadgeColor,
  WalletPoolStrategy,
} from '../../core/models/enums';
import { formatApiError, extractErrorMessage } from '../../core/utils/error.util';
import { GmgnQuickLinkComponent } from '../../shared/components/gmgn-quick-link/gmgn-quick-link.component';
import {
  confirmUsdcConvertWarnings,
  fundingTotalUsd,
  looksLikeConvertSkipped,
  usdcConvertHealthWarnings,
  validateConsolidateDestinations,
  WITHDRAWAL_USD_DISCLAIMER,
  withdrawalSolanaAddress,
} from '../../core/utils/treasury-ui.util';

type TreasuryTab = 'lifecycle' | 'drain' | 'rearm' | 'consolidate';
type DestinationMode = 'single' | 'perNetwork';
type LifecycleJobSource = 'drain' | 'rearm' | 'lifecycle';

@Component({
  selector: 'app-treasury-page',
  templateUrl: './treasury.component.html',
  styleUrls: ['./treasury.component.scss'],
  imports: [
    RowComponent,
    ColComponent,
    CardComponent,
    CardBodyComponent,
    CardHeaderComponent,
    ButtonDirective,
    FormsModule,
    FormControlDirective,
    FormLabelDirective,
    FormSelectDirective,
    SpinnerComponent,
    AlertComponent,
    BadgeComponent,
    ProgressComponent,
    RouterLink,
    TabDirective,
    TabPanelComponent,
    TabsComponent,
    TabsContentComponent,
    TabsListComponent,
    DatePipe,
    CurrencyPipe,
    KeyValuePipe,
    NgTemplateOutlet,
    GmgnQuickLinkComponent,
  ],
})
export class TreasuryComponent implements OnInit {
  private static readonly ACTIVE_LIFECYCLE_JOB_KEY = 'tp.treasury.activeLifecycleJobId';
  private static readonly ACTIVE_CONSOLIDATE_JOB_KEY = 'tp.treasury.activeConsolidateJobId';

  private readonly treasury = inject(TreasuryService);
  private readonly mainFee = inject(MainFeeWalletService);
  private readonly settingsService = inject(SettingsService);
  private readonly health = inject(HealthService);
  private readonly cycles = inject(CyclesService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  activeTab = signal<TreasuryTab>('drain');
  running = signal(false);
  loadingWallet = signal(true);

  mainFeeWallet = signal<MainFeeWalletResponseDto | null>(null);
  integrationsHealth = signal<IntegrationsHealthResponseDto | null>(null);
  cycleOptions = signal<CycleResponseDto[]>([]);

  lifecycleJob = signal<TreasuryLifecycleJobResponseDto | null>(null);
  lifecycleJobSource = signal<LifecycleJobSource | null>(null);
  consolidateJob = signal<TreasuryConsolidateJobDetailDto | null>(null);
  settingsDrainConvertDefault = signal<'NATIVE' | 'USDC' | null>(null);

  private lifecyclePollSub?: Subscription;
  private consolidatePollSub?: Subscription;

  // Shared scope / networks
  scope: EmergencyBrakeScope = 'GLOBAL';
  cycleId = '';
  networkSol = true;
  networkBsc = true;

  // Drain
  drainConvertTo: 'USDC' | 'NATIVE' = 'NATIVE';
  drainIncludeOwner = true;
  drainReason = '';

  // Wait for deposit (lifecycle)
  waitEnabled = true;
  minBalanceUsd = 1000;
  timeoutMinutes = 60;

  // Rearm
  walletPoolStrategy: WalletPoolStrategy = 'AUTO';
  marketWalletCount = 150;
  forceReuse = false;
  sourceAsset: 'USDC' | 'ETH' = 'USDC';
  amountPerWalletUsd = 0.1;
  skipIfBalanceInsufficient = true;
  startCycleAfterRearm = true;

  // Consolidate
  consolidateConvertTo: 'USDC' | 'NATIVE' = 'NATIVE';
  destinationMode: DestinationMode = 'single';
  destinationSingle = '';
  destinationSol = '';
  destinationBsc = '';
  sellAllTokens = true;
  minSweepUsd = 0.5;
  slippageBps = 1500;
  consolidateReason = '';

  readonly jobStatusBadgeColor = jobStatusBadgeColor;
  readonly treasuryPhaseBadgeColor = treasuryPhaseBadgeColor;
  readonly fundingTotalUsd = fundingTotalUsd;
  readonly withdrawalSolanaAddress = withdrawalSolanaAddress;
  readonly withdrawalUsdDisclaimer = WITHDRAWAL_USD_DISCLAIMER;

  readonly usdcHealthWarnings = computed(() =>
    usdcConvertHealthWarnings(this.integrationsHealth())
  );

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.lifecyclePollSub?.unsubscribe();
      this.consolidatePollSub?.unsubscribe();
    });
  }

  ngOnInit(): void {
    this.mainFee.getWallet().subscribe({
      next: (wallet) => {
        this.mainFeeWallet.set(wallet);
        this.loadingWallet.set(false);
      },
      error: (err) => {
        this.loadingWallet.set(false);
        this.toast.error(extractErrorMessage(err));
      },
    });

    this.settingsService.get().subscribe({
      next: (settings) => {
        const lifecycle = settings.treasury?.['lifecycle'] as Record<string, unknown> | undefined;
        const defaultConvert = lifecycle?.['defaultDrainConvertTo'];
        if (defaultConvert === 'NATIVE' || defaultConvert === 'USDC') {
          this.drainConvertTo = defaultConvert;
          this.settingsDrainConvertDefault.set(defaultConvert);
        }
        const defaultStrategy = lifecycle?.['defaultWalletPoolStrategy'];
        if (defaultStrategy === 'AUTO' || defaultStrategy === 'FRESH' || defaultStrategy === 'REUSE') {
          this.walletPoolStrategy = defaultStrategy;
        }
        const defaultAmount = lifecycle?.['defaultAmountPerWalletUsd'];
        if (typeof defaultAmount === 'number') {
          this.amountPerWalletUsd = defaultAmount;
        }
        const defaultSource = lifecycle?.['defaultSourceAsset'];
        if (defaultSource === 'USDC' || defaultSource === 'ETH') {
          this.sourceAsset = defaultSource;
        }
        const minRearm = lifecycle?.['minRearmBalanceUsd'];
        if (typeof minRearm === 'number') {
          this.minBalanceUsd = minRearm;
        }
        const consolidate = settings.treasury?.['consolidate'] as Record<string, unknown> | undefined;
        const consolidateDefault = consolidate?.['defaultConvertTo'];
        if (consolidateDefault === 'NATIVE' || consolidateDefault === 'USDC') {
          this.consolidateConvertTo = consolidateDefault;
        }
        const defaultSlippage = consolidate?.['defaultSlippageBps'];
        if (typeof defaultSlippage === 'number') {
          this.slippageBps = defaultSlippage;
        }
        const defaultMinSweep = consolidate?.['minSweepUsd'];
        if (typeof defaultMinSweep === 'number') {
          this.minSweepUsd = defaultMinSweep;
        }
      },
      error: () => { /* defaults already NATIVE */ },
    });

    this.health.getIntegrationsHealth().subscribe({
      next: (health) => this.integrationsHealth.set(health),
      error: () => { /* optional */ },
    });

    this.cycles.list({ page: 1, limit: 50 }).subscribe({
      next: (res) => this.cycleOptions.set(res.data),
      error: () => { /* optional */ },
    });

    this.restoreActiveJobs();
  }

  lifecycleJobInProgress(): boolean {
    const job = this.lifecycleJob();
    if (!job) return false;
    return !['COMPLETED', 'FAILED', 'READY'].includes(job.status);
  }

  private restoreActiveJobs(): void {
    const lifecycleJobId = sessionStorage.getItem(TreasuryComponent.ACTIVE_LIFECYCLE_JOB_KEY);
    if (lifecycleJobId) {
      this.treasury.getLifecycleJob(lifecycleJobId).subscribe({
        next: (job) => {
          this.lifecycleJob.set(job);
          if (!['COMPLETED', 'FAILED', 'READY'].includes(job.status)) {
            this.startLifecyclePolling(job.jobId);
          } else {
            sessionStorage.removeItem(TreasuryComponent.ACTIVE_LIFECYCLE_JOB_KEY);
          }
        },
        error: () => sessionStorage.removeItem(TreasuryComponent.ACTIVE_LIFECYCLE_JOB_KEY),
      });
    }

    const consolidateJobId = sessionStorage.getItem(TreasuryComponent.ACTIVE_CONSOLIDATE_JOB_KEY);
    if (consolidateJobId) {
      this.treasury.getConsolidateJob(consolidateJobId).subscribe({
        next: (job) => {
          this.consolidateJob.set(job);
          if (!['COMPLETED', 'PARTIAL', 'FAILED'].includes(job.status)) {
            this.startConsolidatePolling(job.jobId);
          } else {
            sessionStorage.removeItem(TreasuryComponent.ACTIVE_CONSOLIDATE_JOB_KEY);
          }
        },
        error: () => sessionStorage.removeItem(TreasuryComponent.ACTIVE_CONSOLIDATE_JOB_KEY),
      });
    }
  }

  activeConvertTo(): 'USDC' | 'NATIVE' {
    const tab = this.activeTab();
    if (tab === 'consolidate') return this.consolidateConvertTo;
    return this.drainConvertTo;
  }

  confirmUsdcIfNeeded(): boolean {
    return confirmUsdcConvertWarnings(this.activeConvertTo(), this.usdcHealthWarnings());
  }

  notifyConvertSkipped(message: string | undefined): void {
    if (!looksLikeConvertSkipped(message)) return;
    this.toast.warning(
      'USDC convert was skipped — check Settings → Integrations (Jupiter API key & withdrawal private keys).'
    );
  }
  onTabChange(key: string | number | undefined): void {
    if (typeof key === 'string') {
      this.activeTab.set(key as TreasuryTab);
    }
  }

  selectedNetworks(): Network[] {
    const networks: Network[] = [];
    if (this.networkSol) networks.push('SOLANA');
    if (this.networkBsc) networks.push('BSC');
    return networks;
  }

  buildDrainPayload() {
    const networks = this.selectedNetworks();
    return {
      scope: this.scope,
      cycleId: this.scope === 'CYCLE' ? this.cycleId.trim() || undefined : undefined,
      networks: networks.length > 0 ? networks : undefined,
      convertTo: this.drainConvertTo,
      includeOwnerWallets: this.drainIncludeOwner,
      reason: this.drainReason.trim() || undefined,
    };
  }

  buildRearmPayload() {
    const networks = this.selectedNetworks();
    return {
      networks: networks.length > 0 ? networks : undefined,
      walletPoolStrategy: this.walletPoolStrategy,
      marketWalletCount: this.marketWalletCount,
      forceReuse: this.forceReuse,
      sourceAsset: this.sourceAsset,
      amountPerWalletUsd: this.amountPerWalletUsd,
      skipIfBalanceInsufficient: this.skipIfBalanceInsufficient,
      startCycleAfterRearm: this.startCycleAfterRearm,
    };
  }

  buildConsolidateDestination(): string | { SOLANA?: string; BSC?: string } {
    if (this.destinationMode === 'perNetwork') {
      const map: { SOLANA?: string; BSC?: string } = {};
      if (this.destinationSol.trim()) map.SOLANA = this.destinationSol.trim();
      if (this.destinationBsc.trim()) map.BSC = this.destinationBsc.trim();
      return map;
    }
    return this.destinationSingle.trim();
  }

  validateScope(): boolean {
    if (this.scope === 'CYCLE' && !this.cycleId.trim()) {
      this.toast.warning('Cycle ID is required when scope is CYCLE');
      return false;
    }
    if (!this.networkSol && !this.networkBsc) {
      this.toast.warning('Select at least one network');
      return false;
    }
    return true;
  }

  runLifecycle(): void {
    if (!this.validateScope()) return;
    if (this.lifecycleJobInProgress()) {
      this.toast.warning('A treasury lifecycle job is already in progress');
      return;
    }
    if (!this.confirmUsdcIfNeeded()) return;
    if (!confirm('Run full treasury lifecycle (drain → wait → rearm)?')) return;

    this.running.set(true);
    this.treasury.runLifecycle({
      drain: this.buildDrainPayload(),
      waitForDeposit: {
        enabled: this.waitEnabled,
        minBalanceUsd: this.minBalanceUsd,
        timeoutMinutes: this.timeoutMinutes,
      },
      rearm: this.buildRearmPayload(),
      startCycleAfterRearm: this.startCycleAfterRearm,
    }).subscribe({
      next: (job) => this.handleLifecycleStarted(job, 'lifecycle'),
      error: (err) => this.handleError(err, 'lifecycle'),
    });
  }

  drainOnly(): void {
    if (!this.validateScope()) return;
    if (this.lifecycleJobInProgress()) {
      this.toast.warning('A treasury lifecycle job is already in progress');
      return;
    }
    if (!this.confirmUsdcIfNeeded()) return;
    if (!confirm('Drain wallets to withdrawal addresses?')) return;

    this.running.set(true);
    this.treasury.drain(this.buildDrainPayload()).subscribe({
      next: (job) => this.handleLifecycleStarted(job, 'drain'),
      error: (err) => this.handleError(err, 'drain'),
    });
  }

  rearmOnly(): void {
    if (!this.validateScope()) return;
    if (this.lifecycleJobInProgress()) {
      this.toast.warning('A treasury lifecycle job is already in progress');
      return;
    }
    if (!confirm('Rearm wallet pool?')) return;

    this.running.set(true);
    this.treasury.rearm(this.buildRearmPayload()).subscribe({
      next: (job) => this.handleLifecycleStarted(job, 'rearm'),
      error: (err) => this.handleError(err, 'rearm'),
    });
  }

  runConsolidate(): void {
    if (!this.validateScope()) return;
    const consolidateJob = this.consolidateJob();
    if (consolidateJob && !['COMPLETED', 'PARTIAL', 'FAILED'].includes(consolidateJob.status)) {
      this.toast.warning('A consolidate job is already in progress');
      return;
    }

    const destinationAddress = this.buildConsolidateDestination();
    if (typeof destinationAddress === 'string' && !destinationAddress) {
      this.toast.warning('Destination address is required');
      return;
    }
    if (typeof destinationAddress === 'object' && !destinationAddress.SOLANA && !destinationAddress.BSC) {
      this.toast.warning('At least one destination address is required');
      return;
    }

    const fundingError = validateConsolidateDestinations(destinationAddress, this.mainFeeWallet());
    if (fundingError) {
      this.toast.warning(fundingError);
      return;
    }

    if (!this.confirmUsdcIfNeeded()) return;
    if (!confirm('Start consolidate job to destination address(es)?')) return;

    this.running.set(true);
    this.treasury.consolidate({
      scope: this.scope,
      cycleId: this.scope === 'CYCLE' ? this.cycleId.trim() || undefined : undefined,
      networks: this.selectedNetworks(),
      destinationAddress,
      convertTo: this.consolidateConvertTo,
      sellAllTokens: this.sellAllTokens,
      minSweepUsd: this.minSweepUsd,
      slippageBps: this.slippageBps,
      reason: this.consolidateReason.trim() || undefined,
    }).subscribe({
      next: (res) => {
        this.running.set(false);
        this.toast.info(`Consolidate job ${res.jobId} — ${res.status}`);
        sessionStorage.setItem(TreasuryComponent.ACTIVE_CONSOLIDATE_JOB_KEY, res.jobId);
        this.startConsolidatePolling(res.jobId);
        this.treasury.getConsolidateJob(res.jobId).subscribe({
          next: (job) => this.consolidateJob.set(job),
        });
      },
      error: (err) => this.handleError(err, 'consolidate'),
    });
  }

  consolidateProgress(): number {
    const job = this.consolidateJob();
    if (!job?.progress?.walletsTotal) return 0;
    return Math.round((job.progress.walletsSwept / job.progress.walletsTotal) * 100);
  }

  consolidateTotalsEntries(job: TreasuryConsolidateJobDetailDto): { key: string; value: unknown }[] {
    if (!job.totals) return [];
    return Object.entries(job.totals).map(([key, value]) => ({ key, value }));
  }

  refreshLifecycleJob(): void {
    const job = this.lifecycleJob();
    if (!job) return;
    this.treasury.getLifecycleJob(job.jobId).subscribe({
      next: (updated) => this.lifecycleJob.set(updated),
      error: (err) => this.toast.error(extractErrorMessage(err)),
    });
  }

  refreshConsolidateJob(): void {
    const job = this.consolidateJob();
    if (!job) return;
    this.treasury.getConsolidateJob(job.jobId).subscribe({
      next: (updated) => this.consolidateJob.set(updated),
      error: (err) => this.toast.error(extractErrorMessage(err)),
    });
  }

  private startConsolidatePolling(jobId: string): void {
    this.consolidatePollSub?.unsubscribe();
    this.consolidatePollSub = this.treasury.pollConsolidateJob(jobId, (job) => {
      this.consolidateJob.set(job);
      if (['COMPLETED', 'PARTIAL', 'FAILED'].includes(job.status)) {
        sessionStorage.removeItem(TreasuryComponent.ACTIVE_CONSOLIDATE_JOB_KEY);
        if (job.status === 'COMPLETED') {
          this.toast.success('Consolidate completed');
        } else if (job.status === 'PARTIAL') {
          this.toast.warning('Consolidate completed with partial success');
        } else if (job.status === 'FAILED') {
          this.toast.error('Consolidate failed');
        }
      }
    });
  }

  private startLifecyclePolling(jobId: string): void {
    this.lifecyclePollSub?.unsubscribe();
    this.lifecyclePollSub = this.treasury.pollLifecycleJob(jobId, (updated) => {
      this.lifecycleJob.set(updated);
      this.notifyConvertSkipped(updated.errorMessage ?? undefined);
      if (['COMPLETED', 'FAILED', 'READY'].includes(updated.status)) {
        sessionStorage.removeItem(TreasuryComponent.ACTIVE_LIFECYCLE_JOB_KEY);
        if (updated.status === 'COMPLETED' || updated.status === 'READY') {
          this.toast.success('Treasury job completed');
        } else if (updated.status === 'FAILED') {
          this.toast.error(updated.errorMessage ?? 'Treasury job failed');
        }
      }
    });
  }

  private handleLifecycleStarted(job: TreasuryLifecycleJobResponseDto, source: LifecycleJobSource): void {
    this.running.set(false);
    this.lifecycleJob.set(job);
    this.lifecycleJobSource.set(source);
    sessionStorage.setItem(TreasuryComponent.ACTIVE_LIFECYCLE_JOB_KEY, job.jobId);
    this.toast.info(`Job ${job.jobId} — ${job.phase} / ${job.status}`);
    this.startLifecyclePolling(job.jobId);
  }

  private handleError(err: unknown, context: 'lifecycle' | 'drain' | 'rearm' | 'consolidate' = 'lifecycle'): void {
    this.running.set(false);
    this.toast.error(formatApiError(err, { context }));
  }
}
