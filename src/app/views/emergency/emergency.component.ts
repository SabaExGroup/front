import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, OnInit, signal } from '@angular/core';
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
} from '@coreui/angular';
import { HealthService } from '../../core/services/health.service';
import { EmergencyService } from '../../core/services/emergency.service';
import { MainFeeWalletService } from '../../core/services/main-fee-wallet.service';
import { CyclesService } from '../../core/services/cycles.service';
import { TreasuryService } from '../../core/services/treasury.service';
import { ToastService } from '../../shared/services/toast.service';
import {
  CycleResponseDto,
  EmergencyBrakeJobDetailDto,
  EmergencyBrakeResponseDto,
  IntegrationsHealthResponseDto,
  MainFeeWalletResponseDto,
  ResumeSystemResponseDto,
  TreasuryLifecycleJobResponseDto,
} from '../../core/models/api.types';
import {
  BRAKE_JOB_TERMINAL,
  EmergencyBrakeScope,
  EmergencyBrakeSellMode,
  jobStatusBadgeColor,
  treasuryPhaseBadgeColor,
} from '../../core/models/enums';
import { extractErrorMessage, formatApiError } from '../../core/utils/error.util';
import { GmgnQuickLinkComponent } from '../../shared/components/gmgn-quick-link/gmgn-quick-link.component';
import {
  confirmUsdcConvertWarnings,
  fundingTotalUsd,
  looksLikeConvertSkipped,
  usdcConvertHealthWarnings,
  WITHDRAWAL_USD_DISCLAIMER,
  withdrawalSolanaAddress,
} from '../../core/utils/treasury-ui.util';

interface BrakeJobOption {
  id: string;
  label: string;
}

interface BrakeJobMeta {
  status?: string;
  scope?: string;
}

@Component({
  selector: 'app-emergency-page',
  templateUrl: './emergency.component.html',
  styleUrls: ['./emergency.component.scss'],
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
    AlertComponent,
    BadgeComponent,
    ProgressComponent,
    SpinnerComponent,
    RouterLink,
    DatePipe,
    CurrencyPipe,
    GmgnQuickLinkComponent,
  ],
})
export class EmergencyComponent implements OnInit {
  private static readonly RECENT_BRAKE_JOBS_KEY = 'tp.emergency.recentBrakeJobs';
  private static readonly ACTIVE_BRAKE_JOB_KEY = 'tp.emergency.activeBrakeJobId';
  private static readonly ACTIVE_DRAIN_JOB_KEY = 'tp.emergency.activeDrainJobId';

  private readonly emergency = inject(EmergencyService);
  private readonly treasury = inject(TreasuryService);
  private readonly mainFee = inject(MainFeeWalletService);
  private readonly health = inject(HealthService);
  private readonly cycles = inject(CyclesService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  scope: EmergencyBrakeScope = 'GLOBAL';
  cycleId = '';
  sellMode: EmergencyBrakeSellMode = 'TWAP';
  convertTo: 'USDC' | 'NATIVE' = 'NATIVE';
  fullDrain = false;
  reason = '';
  resumeJobId = '';
  resumeJobIdTouched = false;
  useCustomResumeJobId = false;

  braking = signal(false);
  resuming = signal(false);
  refreshingHalt = signal(false);
  activeJob = signal<EmergencyBrakeJobDetailDto | null>(null);
  activeDrainJobId = signal<string | null>(null);
  drainJob = signal<TreasuryLifecycleJobResponseDto | null>(null);
  mainFeeWallet = signal<MainFeeWalletResponseDto | null>(null);
  integrationsHealth = signal<IntegrationsHealthResponseDto | null>(null);
  cycleOptions = signal<CycleResponseDto[]>([]);
  resumeError = signal<string | null>(null);
  lastResume = signal<ResumeSystemResponseDto | null>(null);
  recentBrakeJobs = signal<string[]>(this.loadRecentBrakeJobs());
  brakeJobMeta = signal<Record<string, BrakeJobMeta>>({});

  readonly halt = this.emergency.haltStatus;
  readonly jobStatusBadgeColor = jobStatusBadgeColor;
  readonly treasuryPhaseBadgeColor = treasuryPhaseBadgeColor;
  readonly fundingTotalUsd = fundingTotalUsd;
  readonly withdrawalSolanaAddress = withdrawalSolanaAddress;

  readonly usdcHealthWarnings = computed(() =>
    usdcConvertHealthWarnings(this.integrationsHealth())
  );

  readonly brakeJobOptions = computed((): BrakeJobOption[] => {
    const options: BrakeJobOption[] = [];
    const seen = new Set<string>();
    const meta = this.brakeJobMeta();

    const add = (id: string | undefined, hint: string) => {
      if (!id || seen.has(id)) return;
      seen.add(id);
      const jobMeta = meta[id];
      const parts: string[] = [id];
      if (jobMeta?.status) parts.push(jobMeta.status);
      if (jobMeta?.scope) parts.push(jobMeta.scope);
      parts.push(`(${hint})`);
      options.push({ id, label: parts.join(' · ') });
    };

    add(this.halt()?.emergencyLock, 'current lock');
    add(this.activeJob()?.jobId, 'active job');
    for (const id of this.recentBrakeJobs()) {
      add(id, 'recent');
    }
    return options;
  });

  private jobPollSub?: Subscription;
  private drainPollSub?: Subscription;
  private fetchedJobMeta = new Set<string>();

  ngOnInit(): void {
    this.mainFee.getWallet().subscribe({
      next: (wallet) => this.mainFeeWallet.set(wallet),
      error: () => { /* optional */ },
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

  private restoreActiveJobs(): void {
    const brakeJobId =
      sessionStorage.getItem(EmergencyComponent.ACTIVE_BRAKE_JOB_KEY) ??
      this.halt()?.emergencyLock ??
      this.halt()?.halt?.jobId ??
      null;

    if (brakeJobId) {
      this.emergency.getBrakeJob(brakeJobId).subscribe({
        next: (job) => {
          this.activeJob.set(job);
          this.rememberBrakeJob(job.jobId, job.status, job.scope, false);
          if (!(BRAKE_JOB_TERMINAL as readonly string[]).includes(job.status)) {
            this.pollJob(job.jobId);
          } else {
            this.clearActiveBrakeJob();
          }
          const drainId =
            job.drainJobId ?? sessionStorage.getItem(EmergencyComponent.ACTIVE_DRAIN_JOB_KEY);
          if (drainId) {
            this.persistActiveDrainJob(drainId);
            this.pollDrainJob(drainId);
          }
        },
        error: () => this.clearActiveBrakeJob(),
      });
      return;
    }

    const storedDrainId = sessionStorage.getItem(EmergencyComponent.ACTIVE_DRAIN_JOB_KEY);
    if (storedDrainId) {
      this.persistActiveDrainJob(storedDrainId);
      this.pollDrainJob(storedDrainId);
    }
  }

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.jobPollSub?.unsubscribe();
      this.drainPollSub?.unsubscribe();
    });

    effect(() => {
      const lock = this.halt()?.emergencyLock;
      if (lock) {
        this.ensureJobMeta(lock);
      }
      if (lock && !this.resumeJobIdTouched && !this.resumeJobId.trim()) {
        this.resumeJobId = lock;
      }
    });
  }

  private loadRecentBrakeJobs(): string[] {
    try {
      const raw = sessionStorage.getItem(EmergencyComponent.RECENT_BRAKE_JOBS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  }

  private rememberBrakeJob(jobId: string, status?: string, scope?: string, addToRecent = true): void {
    if (addToRecent) {
      this.recentBrakeJobs.update((list) => {
        const next = [jobId, ...list.filter((id) => id !== jobId)].slice(0, 10);
        sessionStorage.setItem(EmergencyComponent.RECENT_BRAKE_JOBS_KEY, JSON.stringify(next));
        return next;
      });
    }
    this.brakeJobMeta.update((current) => ({
      ...current,
      [jobId]: {
        status: status ?? current[jobId]?.status,
        scope: scope ?? current[jobId]?.scope,
      },
    }));
  }

  private ensureJobMeta(jobId: string): void {
    if (!jobId || this.fetchedJobMeta.has(jobId)) return;
    this.fetchedJobMeta.add(jobId);
    this.emergency.getBrakeJob(jobId).subscribe({
      next: (job) => this.rememberBrakeJob(job.jobId, job.status, job.scope, false),
      error: () => this.fetchedJobMeta.delete(jobId),
    });
  }

  useSelectForResumeJob(): boolean {
    return !this.useCustomResumeJobId && this.brakeJobOptions().length > 0;
  }

  onResumeJobSelected(value: string): void {
    this.resumeJobIdTouched = true;
    this.resumeJobId = value;
  }

  enableCustomResumeJobId(): void {
    this.useCustomResumeJobId = true;
    this.resumeJobIdTouched = true;
  }

  disableCustomResumeJobId(): void {
    this.useCustomResumeJobId = false;
    const first = this.brakeJobOptions()[0];
    if (first) {
      this.resumeJobId = first.id;
      this.resumeJobIdTouched = false;
    }
  }

  refreshHalt(): void {
    this.refreshingHalt.set(true);
    this.emergency.getHalt().subscribe({
      next: (status) => {
        this.emergency.haltStatus.set(status);
        this.refreshingHalt.set(false);
      },
      error: (err) => {
        this.refreshingHalt.set(false);
        this.toast.error(extractErrorMessage(err));
      },
    });
  }

  onResumeJobIdInput(): void {
    this.resumeJobIdTouched = true;
  }

  brakeFormValid(): boolean {
    if (!this.reason.trim()) return false;
    if (this.scope === 'CYCLE' && !this.cycleId.trim()) return false;
    return true;
  }

  validateBrakeForm(): boolean {
    if (!this.reason.trim()) {
      this.toast.warning('Reason is required');
      return false;
    }
    if (this.scope === 'CYCLE' && !this.cycleId.trim()) {
      this.toast.warning('Cycle ID is required when scope is CYCLE');
      return false;
    }
    return true;
  }

  brakeInProgress(): boolean {
    const job = this.activeJob();
    if (!job) return false;
    return !(BRAKE_JOB_TERMINAL as readonly string[]).includes(job.status);
  }

  triggerBrake(): void {
    if (!this.validateBrakeForm()) return;
    if (this.brakeInProgress()) {
      this.toast.warning('A brake job is already in progress');
      return;
    }
    if (!confirm(`Trigger ${this.scope} emergency brake? This halts the system.`)) return;
    if (this.fullDrain && this.scope === 'GLOBAL') {
      if (!confirm('FULL DRAIN (GLOBAL) halts the system and drains all wallets via treasury. Continue?')) return;
    }
    if (this.fullDrain && this.scope === 'CYCLE') {
      if (!confirm('FULL DRAIN (CYCLE) sells cycle targets and runs chain drain. Continue?')) return;
    }
    if (!confirmUsdcConvertWarnings(this.convertTo, this.usdcHealthWarnings())) return;

    this.braking.set(true);
    this.lastResume.set(null);
    this.resumeError.set(null);
    this.drainJob.set(null);
    this.emergency.triggerBrake({
      scope: this.scope,
      cycleId: this.scope === 'CYCLE' ? this.cycleId.trim() : undefined,
      sellMode: this.sellMode,
      convertTo: this.convertTo,
      fullDrain: this.fullDrain,
      reason: this.reason.trim(),
    }).subscribe({
      next: (res) => this.handleBrakeStarted(res),
      error: (err) => {
        this.braking.set(false);
        this.toast.error(formatApiError(err, { context: 'brake' }));
      },
    });
  }

  resumeSystem(): void {
    const jobId = this.resumeJobId.trim() || this.halt()?.emergencyLock || '';
    if (!jobId) {
      this.toast.warning('Job ID required for resume');
      return;
    }
    if (!this.halt()?.halted) {
      this.toast.warning('System is not halted — resume is only available when halted');
      return;
    }
    if (!confirm('Resume system after halt? Operational queues will restart.')) return;

    this.resuming.set(true);
    this.resumeError.set(null);
    this.emergency.resume({ jobId }).subscribe({
      next: (res) => {
        this.resuming.set(false);
        this.lastResume.set(res);
        this.toast.success(res.message ?? 'System resumed');
        this.clearActiveJobs();
        this.emergency.getHalt().subscribe((h) => this.emergency.haltStatus.set(h));
      },
      error: (err) => {
        this.resuming.set(false);
        const message = formatApiError(err, {
          context: 'resume',
          emergencyLock: this.halt()?.emergencyLock,
        });
        this.resumeError.set(message);
        this.toast.error(message);
      },
    });
  }

  notifyConvertSkipped(message: string | undefined): void {
    if (!looksLikeConvertSkipped(message)) return;
    this.toast.warning(
      'USDC convert was skipped — check Settings → Integrations (Jupiter API key & withdrawal private keys).'
    );
  }

  brakeProgress(): number {
    const job = this.activeJob();
    if (!job?.progress) return 0;
    const total = job.walletsAffected ?? job.progress.walletsProcessed ?? 0;
    if (total <= 0) return 0;
    return Math.min(100, Math.round((job.progress.walletsProcessed ?? 0) / total * 100));
  }

  refreshDrainJob(): void {
    const jobId = this.activeDrainJobId();
    if (!jobId) return;
    this.treasury.getLifecycleJob(jobId).subscribe({
      next: (job) => this.drainJob.set(job),
      error: (err) => this.toast.error(extractErrorMessage(err)),
    });
  }

  refreshBrakeJob(): void {
    const job = this.activeJob();
    if (!job) return;
    this.emergency.getBrakeJob(job.jobId).subscribe({
      next: (updated) => this.activeJob.set(updated),
      error: (err) => this.toast.error(extractErrorMessage(err)),
    });
  }

  private persistActiveBrakeJob(jobId: string): void {
    sessionStorage.setItem(EmergencyComponent.ACTIVE_BRAKE_JOB_KEY, jobId);
  }

  private persistActiveDrainJob(jobId: string): void {
    this.activeDrainJobId.set(jobId);
    sessionStorage.setItem(EmergencyComponent.ACTIVE_DRAIN_JOB_KEY, jobId);
  }

  private clearActiveBrakeJob(): void {
    sessionStorage.removeItem(EmergencyComponent.ACTIVE_BRAKE_JOB_KEY);
  }

  private clearActiveDrainJob(clearDisplay = false): void {
    this.activeDrainJobId.set(null);
    this.drainPollSub?.unsubscribe();
    this.drainPollSub = undefined;
    sessionStorage.removeItem(EmergencyComponent.ACTIVE_DRAIN_JOB_KEY);
    if (clearDisplay) {
      this.drainJob.set(null);
    }
  }

  private clearActiveJobs(): void {
    this.activeJob.set(null);
    this.jobPollSub?.unsubscribe();
    this.jobPollSub = undefined;
    this.clearActiveBrakeJob();
    this.clearActiveDrainJob(true);
  }

  private handleBrakeStarted(res: EmergencyBrakeResponseDto): void {
    this.braking.set(false);
    this.toast.warning(res.message ?? 'Emergency brake queued');
    this.rememberBrakeJob(res.jobId, res.status, res.scope);
    this.persistActiveBrakeJob(res.jobId);
    this.resumeJobId = res.jobId;
    this.resumeJobIdTouched = false;
    this.useCustomResumeJobId = false;
    this.activeJob.set({
      jobId: res.jobId,
      status: res.status,
      mode: res.mode,
      scope: res.scope,
      cycleId: res.cycleId,
      drainJobId: res.drainJobId,
      walletsAffected: res.walletsAffected,
      systemHalted: res.systemHalted,
      message: res.message,
    });
    this.pollJob(res.jobId);
    if (res.drainJobId) {
      this.persistActiveDrainJob(res.drainJobId);
      this.pollDrainJob(res.drainJobId);
    } else {
      this.clearActiveDrainJob(true);
    }
    if (res.systemHalted) {
      this.emergency.getHalt().subscribe((h) => this.emergency.haltStatus.set(h));
    }
  }

  private pollDrainJob(jobId: string): void {
    this.drainPollSub?.unsubscribe();
    this.treasury.getLifecycleJob(jobId).subscribe({
      next: (job) => this.drainJob.set(job),
    });
    this.drainPollSub = this.treasury.pollLifecycleJob(jobId, (job) => {
      this.drainJob.set(job);
      this.notifyConvertSkipped(job.errorMessage ?? undefined);
      if (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'READY') {
        this.toast.info(`Drain job ${job.status.toLowerCase()}`);
        this.clearActiveDrainJob();
      }
    });
  }

  private pollJob(jobId: string): void {
    this.jobPollSub?.unsubscribe();
    this.jobPollSub = this.emergency.pollBrakeJob(jobId, (job) => {
      this.activeJob.set(job);
      this.rememberBrakeJob(job.jobId, job.status, job.scope, false);
      if (job.drainJobId) {
        this.persistActiveDrainJob(job.drainJobId);
        if (!this.drainPollSub) {
          this.pollDrainJob(job.drainJobId);
        }
      }
      this.notifyConvertSkipped(job.message);
      if ((BRAKE_JOB_TERMINAL as readonly string[]).includes(job.status)) {
        this.clearActiveBrakeJob();
        if (job.status === 'COMPLETED' || job.status === 'DRAINED_HALTED') {
          this.toast.success('Emergency brake completed');
          this.emergency.getHalt().subscribe((h) => this.emergency.haltStatus.set(h));
        } else if (job.status === 'PARTIAL') {
          this.toast.warning('Emergency brake completed with partial success');
          this.emergency.getHalt().subscribe((h) => this.emergency.haltStatus.set(h));
        } else if (job.status === 'FAILED') {
          this.toast.error('Emergency brake failed');
        }
      }
    });
  }
}
