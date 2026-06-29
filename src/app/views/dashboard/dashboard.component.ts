import { CurrencyPipe, DatePipe, DecimalPipe, UpperCasePipe } from '@angular/common';
import { Component, DestroyRef, effect, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin, Subscription, switchMap, timer } from 'rxjs';
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
  FormLabelDirective,
  FormSelectDirective,
  RowComponent,
  SpinnerComponent,
  TableDirective,
} from '@coreui/angular';
import { GmgnQuickLinkComponent } from '../../shared/components/gmgn-quick-link/gmgn-quick-link.component';
import { CycleStatusBadgeComponent } from '../../shared/components/cycle-status-badge/cycle-status-badge.component';
import { HealthService, IntegrationsService } from '../../core/services/health.service';
import { EmergencyService } from '../../core/services/emergency.service';
import { MainFeeWalletService } from '../../core/services/main-fee-wallet.service';
import { CyclesService } from '../../core/services/cycles.service';
import { ToastService } from '../../shared/services/toast.service';
import {
  CycleResponseDto,
  HealthResponseDto,
  IntegrationProbeResultDto,
  IntegrationsHealthResponseDto,
  MainFeeWalletResponseDto,
  NativeUsdPricesResponseDto,
  RpcChainHealthDto,
  RpcHealthResponseDto,
} from '../../core/models/api.types';
import { LAUNCHPADS, Launchpad, NETWORKS, Network } from '../../core/models/enums';
import { extractErrorMessage, formatApiError } from '../../core/utils/error.util';
import {
  fundingTotalUsd,
  withdrawalSolanaAddress,
  WITHDRAWAL_USD_DISCLAIMER,
} from '../../core/utils/treasury-ui.util';

@Component({
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  imports: [
    RowComponent,
    ColComponent,
    CardComponent,
    CardBodyComponent,
    CardHeaderComponent,
    ButtonDirective,
    TableDirective,
    BadgeComponent,
    AlertComponent,
    RouterLink,
    CycleStatusBadgeComponent,
    SpinnerComponent,
    FormsModule,
    FormLabelDirective,
    FormSelectDirective,
    FormCheckComponent,
    FormCheckInputDirective,
    FormCheckLabelDirective,
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    UpperCasePipe,
    GmgnQuickLinkComponent,
  ],
})
export class DashboardComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly health = inject(HealthService);
  private readonly integrations = inject(IntegrationsService);
  private readonly emergency = inject(EmergencyService);
  private readonly mainFee = inject(MainFeeWalletService);
  private readonly cycles = inject(CyclesService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  loading = signal(true);
  loadingSlow = signal(true);
  refreshing = signal(false);
  refreshingPrices = signal(false);
  startingCycle = signal(false);
  showStartForm = signal(false);

  healthData = signal<HealthResponseDto | null>(null);
  integrationsHealth = signal<IntegrationsHealthResponseDto | null>(null);
  rpcHealth = signal<RpcHealthResponseDto | null>(null);
  nativePrices = signal<NativeUsdPricesResponseDto | null>(null);
  mainFeeWallet = signal<MainFeeWalletResponseDto | null>(null);
  recentCycles = signal<CycleResponseDto[]>([]);
  recentCyclesTotal = signal(0);

  startNetwork: Network | '' = '';
  startLaunchpad: Launchpad | '' = '';
  startDryRun = false;
  startIgnorePeakSchedule = false;

  readonly networkOptions = NETWORKS;
  readonly launchpadOptions = LAUNCHPADS;
  readonly isHalted = this.emergency.haltStatus;
  readonly fundingTotalUsd = fundingTotalUsd;
  readonly withdrawalSolanaAddress = withdrawalSolanaAddress;

  private fastPollSub?: Subscription;
  private slowPollSub?: Subscription;

  constructor() {
    effect(() => {
      if (this.isHalted()?.halted) {
        this.showStartForm.set(false);
      }
    });
  }

  ngOnInit(): void {
    this.loadAll();

    this.fastPollSub = timer(30_000, 30_000)
      .pipe(
        switchMap(() => this.fetchFastBundle()),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (data) => this.applyFastBundle(data),
        error: () => { /* silent poll */ },
      });

    this.slowPollSub = timer(60_000, 60_000)
      .pipe(
        switchMap(() => this.fetchSlowBundle()),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (data) => this.applySlowBundle(data),
        error: () => { /* silent poll */ },
      });

    this.destroyRef.onDestroy(() => {
      this.fastPollSub?.unsubscribe();
      this.slowPollSub?.unsubscribe();
    });
  }

  loadAll(): void {
    this.loading.set(true);
    this.loadingSlow.set(true);

    this.fetchFastBundle().subscribe({
      next: (data) => {
        this.applyFastBundle(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(formatApiError(err));
      },
    });

    this.fetchSlowBundle().subscribe({
      next: (data) => {
        this.applySlowBundle(data);
        this.loadingSlow.set(false);
      },
      error: (err) => {
        this.loadingSlow.set(false);
        this.toast.error(formatApiError(err));
      },
    });
  }

  refreshAll(): void {
    this.refreshing.set(true);
    forkJoin({
      health: this.health.getHealth(),
      integrations: this.health.getIntegrationsHealth(),
      rpc: this.health.getRpcHealth(),
      prices: this.integrations.getNativePrices(),
      wallet: this.mainFee.getWallet(),
      cycles: this.cycles.list({ page: 1, limit: 5 }),
    }).subscribe({
      next: (data) => {
        this.healthData.set(data.health);
        this.integrationsHealth.set(data.integrations);
        this.rpcHealth.set(data.rpc);
        this.nativePrices.set(data.prices);
        this.mainFeeWallet.set(data.wallet);
        this.recentCycles.set(data.cycles.data);
        this.recentCyclesTotal.set(data.cycles.total);
        this.refreshing.set(false);
        this.toast.success('Dashboard refreshed');
      },
      error: (err) => {
        this.refreshing.set(false);
        this.toast.error(formatApiError(err));
      },
    });
  }

  refreshPrices(): void {
    this.refreshingPrices.set(true);
    this.integrations.refreshNativePrices().subscribe({
      next: (prices) => {
        this.nativePrices.set(prices);
        this.refreshingPrices.set(false);
        this.toast.success('Native prices refreshed');
      },
      error: (err) => {
        this.refreshingPrices.set(false);
        this.toast.error(formatApiError(err));
      },
    });
  }

  toggleStartForm(): void {
    this.showStartForm.update((v) => !v);
  }

  navigateWithConfirm(path: '/emergency' | '/treasury', label: string): void {
    if (!confirm(`Open ${label}? These are high-impact operational pages.`)) return;
    void this.router.navigate([path]);
  }

  startCycle(): void {
    if (this.isHalted()?.halted) {
      this.toast.warning('System is halted — cannot start cycle');
      return;
    }
    if (!confirm('Start a new cycle?')) return;

    this.startingCycle.set(true);
    this.cycles.start({
      network: this.startNetwork || undefined,
      forceLaunchpad: this.startLaunchpad || undefined,
      dryRun: this.startDryRun,
      ignorePeakSchedule: this.startIgnorePeakSchedule,
    }).subscribe({
      next: (cycle) => {
        this.startingCycle.set(false);
        this.toast.success(`Cycle started — ${cycle.status}`);
        this.showStartForm.set(false);
        void this.router.navigate(['/cycles', cycle.id]);
      },
      error: (err) => {
        this.startingCycle.set(false);
        this.toast.error(formatApiError(err));
      },
    });
  }

  dependencyColor(status: string): string {
    switch (status) {
      case 'up':
      case 'ok':
        return 'success';
      case 'degraded':
        return 'warning';
      case 'disabled':
      case 'unknown':
        return 'secondary';
      default:
        return 'danger';
    }
  }

  /** docs §۷ — jupiter must appear for Solana USDC convert health */
  private static readonly INTEGRATION_PROVIDER_ORDER = [
    'jupiter',
    'changenow',
  ] as const;

  providerEntries(): { key: string; value: IntegrationProbeResultDto }[] {
    const providers = this.integrationsHealth()?.providers ?? {};
    const entries: { key: string; value: IntegrationProbeResultDto }[] = [];
    const seen = new Set<string>();

    for (const key of DashboardComponent.INTEGRATION_PROVIDER_ORDER) {
      seen.add(key);
      entries.push({
        key,
        value: providers[key] ?? {
          status: 'unknown',
          message: key === 'jupiter'
            ? 'Not reported — required for Solana USDC convert'
            : 'Not reported by health API',
        },
      });
    }

    for (const [key, value] of Object.entries(providers)) {
      if (!seen.has(key)) {
        entries.push({ key, value });
      }
    }

    return entries;
  }

  rpcChains(): { name: string; chain: RpcChainHealthDto }[] {
    const rpc = this.rpcHealth();
    if (!rpc) return [];
    return [
      { name: 'Solana', chain: rpc.solana },
      { name: 'BSC', chain: rpc.bsc },
      { name: 'Ethereum', chain: rpc.ethereum },
    ];
  }

  private fetchFastBundle() {
    return forkJoin({
      health: this.health.getHealth(),
      wallet: this.mainFee.getWallet(),
      cycles: this.cycles.list({ page: 1, limit: 5 }),
    });
  }

  private fetchSlowBundle() {
    return forkJoin({
      integrations: this.health.getIntegrationsHealth(),
      rpc: this.health.getRpcHealth(),
      prices: this.integrations.getNativePrices(),
    });
  }

  private applyFastBundle(data: {
    health: HealthResponseDto;
    wallet: MainFeeWalletResponseDto;
    cycles: { data: CycleResponseDto[]; total: number };
  }): void {
    this.healthData.set(data.health);
    this.mainFeeWallet.set(data.wallet);
    this.recentCycles.set(data.cycles.data);
    this.recentCyclesTotal.set(data.cycles.total);
  }

  private applySlowBundle(data: {
    integrations: IntegrationsHealthResponseDto;
    rpc: RpcHealthResponseDto;
    prices: NativeUsdPricesResponseDto;
  }): void {
    this.integrationsHealth.set(data.integrations);
    this.rpcHealth.set(data.rpc);
    this.nativePrices.set(data.prices);
  }
}
