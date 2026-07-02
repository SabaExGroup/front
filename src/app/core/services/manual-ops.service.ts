import { Injectable, inject } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import {
  LiquidityUnlockExecuteDto,
  LiquidityUnlockJobDetailDto,
  LiquidityUnlockJobResponseDto,
  LiquidityUnlockPreviewDto,
  LiquidityUnlockPreviewResponseDto,
  ManualSellExecuteDto,
  ManualSellJobDetailDto,
  ManualSellJobResponseDto,
  ManualSellPreviewDto,
  ManualSellPreviewResponseDto,
} from '../models/api.types';
import { MANUAL_OPS_JOB_TERMINAL } from '../models/enums';
import { ApiService } from '../http/api.service';
import { createPollSubscription } from '../utils/polling.util';

const MANUAL_OPS_JOB_TERMINAL_SET = new Set<string>(MANUAL_OPS_JOB_TERMINAL);

/** docs/manual-sell-liquidity-frontend.md — Manual Ops (manual sell + liquidity unlock). */
@Injectable({ providedIn: 'root' })
export class ManualOpsService {
  private readonly api = inject(ApiService);

  previewSell(body: ManualSellPreviewDto): Observable<ManualSellPreviewResponseDto> {
    return this.api.post<ManualSellPreviewResponseDto>('/manual-ops/sell/preview', body);
  }

  executeSell(body: ManualSellExecuteDto): Observable<ManualSellJobResponseDto> {
    return this.api.post<ManualSellJobResponseDto>('/manual-ops/sell/execute', body);
  }

  getSellJob(jobId: string): Observable<ManualSellJobDetailDto> {
    return this.api.get<ManualSellJobDetailDto>(`/manual-ops/sell/${jobId}`);
  }

  pollSellJob(
    jobId: string,
    onUpdate: (job: ManualSellJobDetailDto) => void,
    intervalMs = 3_000
  ): Subscription {
    return createPollSubscription(
      () => this.getSellJob(jobId),
      {
        intervalMs,
        stopWhen: (job) => MANUAL_OPS_JOB_TERMINAL_SET.has(job.status),
      },
      onUpdate
    );
  }

  previewLiquidityUnlock(body: LiquidityUnlockPreviewDto): Observable<LiquidityUnlockPreviewResponseDto> {
    return this.api.post<LiquidityUnlockPreviewResponseDto>('/manual-ops/liquidity-unlock/preview', body);
  }

  executeLiquidityUnlock(body: LiquidityUnlockExecuteDto): Observable<LiquidityUnlockJobResponseDto> {
    return this.api.post<LiquidityUnlockJobResponseDto>('/manual-ops/liquidity-unlock/execute', body);
  }

  getLiquidityUnlockJob(jobId: string): Observable<LiquidityUnlockJobDetailDto> {
    return this.api.get<LiquidityUnlockJobDetailDto>(`/manual-ops/liquidity-unlock/${jobId}`);
  }

  pollLiquidityUnlockJob(
    jobId: string,
    onUpdate: (job: LiquidityUnlockJobDetailDto) => void,
    intervalMs = 3_000
  ): Subscription {
    return createPollSubscription(
      () => this.getLiquidityUnlockJob(jobId),
      {
        intervalMs,
        stopWhen: (job) => MANUAL_OPS_JOB_TERMINAL_SET.has(job.status),
      },
      onUpdate
    );
  }
}
