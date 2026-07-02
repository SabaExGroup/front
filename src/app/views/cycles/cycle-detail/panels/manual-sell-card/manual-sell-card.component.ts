import { DatePipe } from '@angular/common';
import { Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
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
  FormControlDirective,
  FormLabelDirective,
  SpinnerComponent,
} from '@coreui/angular';
import { ManualOpsService } from '../../../../../core/services/manual-ops.service';
import { EmergencyService } from '../../../../../core/services/emergency.service';
import { ManualSellExecuteDto, ManualSellJobDetailDto, ManualSellPreviewDto, ManualSellPreviewResponseDto } from '../../../../../core/models/api.types';
import { ManualSellResource, jobStatusBadgeColor } from '../../../../../core/models/enums';
import {
  formatManualOpsApiError,
  formatManualSellConfirmMessage,
  isStaleConfirmationError,
} from '../../../../../core/utils/manual-ops.util';
import { ToastService } from '../../../../../shared/services/toast.service';

/** docs/manual-sell-liquidity-frontend.md §3-4 — manual sell of MARKET or TOKEN_OWNER wallets. */
@Component({
  selector: 'app-manual-sell-card',
  templateUrl: './manual-sell-card.component.html',
  styleUrls: ['./manual-sell-card.component.scss'],
  imports: [
    CardComponent,
    CardBodyComponent,
    CardHeaderComponent,
    ButtonDirective,
    BadgeComponent,
    AlertComponent,
    SpinnerComponent,
    FormControlDirective,
    FormLabelDirective,
    FormsModule,
    RouterLink,
    DatePipe,
  ],
})
export class ManualSellCardComponent {
  private readonly manualOps = inject(ManualOpsService);
  private readonly emergency = inject(EmergencyService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  cycleId = input.required<string>();
  resource = input.required<ManualSellResource>();

  readonly isHalted = this.emergency.haltStatus;
  readonly jobStatusBadgeColor = jobStatusBadgeColor;

  percent = signal(5);
  slippageBpsOverride = signal<number | null>(null);
  reason = signal('');

  preview = signal<ManualSellPreviewResponseDto | null>(null);
  previewLoading = signal(false);
  executing = signal(false);
  job = signal<ManualSellJobDetailDto | null>(null);

  private previewedSlippageOverride: number | null = null;
  private pollSub?: Subscription;
  private loadedKey = '';

  constructor() {
    effect(() => {
      const key = `${this.cycleId()}::${this.resource()}`;
      if (key !== this.loadedKey) {
        this.loadedKey = key;
        this.resetState();
      }
    });

    this.destroyRef.onDestroy(() => this.stopPolling());
  }

  resourceLabel(): string {
    return this.resource() === 'MARKET' ? 'Market wallets' : 'Token owner wallet';
  }

  isBusy(): boolean {
    return this.previewLoading() || this.executing();
  }

  isPollingActive(): boolean {
    const status = this.job()?.status;
    return !!status && status !== 'COMPLETED' && status !== 'PARTIAL' && status !== 'FAILED';
  }

  isPreviewStale(): boolean {
    const preview = this.preview();
    if (!preview) return true;
    if (preview.percent !== this.percent()) return true;
    if ((this.slippageBpsOverride() ?? null) !== this.previewedSlippageOverride) return true;
    return new Date(preview.expiresAt).getTime() <= Date.now();
  }

  runPreview(): void {
    if (this.isBusy()) return;

    const cycleId = this.cycleId();
    const percentValue = this.percent();
    if (!cycleId || !percentValue || percentValue <= 0 || percentValue > 100) {
      this.toast.error('Percent must be greater than 0 and at most 100.');
      return;
    }

    const body: ManualSellPreviewDto = {
      cycleId,
      resource: this.resource(),
      percent: percentValue,
    };
    const slippage = this.slippageBpsOverride();
    if (slippage) {
      body.slippageBps = slippage;
    }

    this.previewLoading.set(true);
    this.manualOps.previewSell(body).subscribe({
      next: (preview) => {
        this.previewLoading.set(false);
        this.preview.set(preview);
        this.previewedSlippageOverride = slippage ?? null;
      },
      error: (err) => {
        this.previewLoading.set(false);
        this.toast.error(formatManualOpsApiError(err));
      },
    });
  }

  confirmAndExecute(): void {
    if (this.isBusy()) return;

    const preview = this.preview();
    if (!preview || this.isPreviewStale()) {
      this.toast.info('Preview expired or inputs changed — fetching a fresh preview.');
      this.runPreview();
      return;
    }

    if (!confirm(formatManualSellConfirmMessage(preview))) {
      return;
    }

    const body: ManualSellExecuteDto = {
      confirmationToken: preview.confirmationToken,
      cycleId: preview.cycleId,
      resource: preview.resource,
      percent: preview.percent,
      reason: this.reason().trim() || undefined,
    };

    this.executing.set(true);
    this.manualOps.executeSell(body).subscribe({
      next: (res) => {
        this.executing.set(false);
        this.preview.set(null);
        this.toast.success(`Sell job queued (${res.jobId})`);
        this.startPolling(res.jobId);
      },
      error: (err) => {
        this.executing.set(false);
        if (isStaleConfirmationError(err)) {
          this.toast.info('Confirmation expired — fetching a fresh preview.');
          this.runPreview();
          return;
        }
        this.toast.error(formatManualOpsApiError(err));
      },
    });
  }

  private startPolling(jobId: string): void {
    this.stopPolling();
    this.pollSub = this.manualOps.pollSellJob(jobId, (job) => {
      this.job.set(job);
      if (!this.isPollingActive()) {
        this.stopPolling();
      }
    });
  }

  private stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = undefined;
  }

  private resetState(): void {
    this.percent.set(5);
    this.slippageBpsOverride.set(null);
    this.reason.set('');
    this.preview.set(null);
    this.previewLoading.set(false);
    this.executing.set(false);
    this.job.set(null);
    this.previewedSlippageOverride = null;
    this.stopPolling();
  }
}
