import { Injectable, inject } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import {
  TreasuryConsolidateDto,
  TreasuryConsolidateJobDetailDto,
  TreasuryConsolidateResponseDto,
  TreasuryDrainDto,
  TreasuryLifecycleJobResponseDto,
  TreasuryLifecycleRunDto,
  TreasuryRearmDto,
} from '../models/api.types';
import { ApiService } from '../http/api.service';
import { createPollSubscription } from '../utils/polling.util';

const LIFECYCLE_TERMINAL = new Set(['COMPLETED', 'FAILED', 'READY']);
const CONSOLIDATE_TERMINAL = new Set(['COMPLETED', 'PARTIAL', 'FAILED']);

@Injectable({ providedIn: 'root' })
export class TreasuryService {
  private readonly api = inject(ApiService);

  drain(body: TreasuryDrainDto): Observable<TreasuryLifecycleJobResponseDto> {
    return this.api.post<TreasuryLifecycleJobResponseDto>('/treasury/drain', body);
  }

  rearm(body: TreasuryRearmDto): Observable<TreasuryLifecycleJobResponseDto> {
    return this.api.post<TreasuryLifecycleJobResponseDto>('/treasury/rearm', body);
  }

  runLifecycle(body: TreasuryLifecycleRunDto): Observable<TreasuryLifecycleJobResponseDto> {
    return this.api.post<TreasuryLifecycleJobResponseDto>('/treasury/lifecycle/run', body);
  }

  getLifecycleJob(jobId: string): Observable<TreasuryLifecycleJobResponseDto> {
    return this.api.get<TreasuryLifecycleJobResponseDto>(`/treasury/lifecycle/${jobId}`);
  }

  pollLifecycleJob(
    jobId: string,
    onUpdate: (job: TreasuryLifecycleJobResponseDto) => void,
    intervalMs = 5_000
  ): Subscription {
    return createPollSubscription(
      () => this.getLifecycleJob(jobId),
      {
        intervalMs,
        stopWhen: (job) => LIFECYCLE_TERMINAL.has(job.status),
      },
      onUpdate
    );
  }

  consolidate(body: TreasuryConsolidateDto): Observable<TreasuryConsolidateResponseDto> {
    return this.api.post<TreasuryConsolidateResponseDto>('/treasury/consolidate', body);
  }

  getConsolidateJob(jobId: string): Observable<TreasuryConsolidateJobDetailDto> {
    return this.api.get<TreasuryConsolidateJobDetailDto>(`/treasury/consolidate/${jobId}`);
  }

  pollConsolidateJob(
    jobId: string,
    onUpdate: (job: TreasuryConsolidateJobDetailDto) => void,
    intervalMs = 5_000
  ): Subscription {
    return createPollSubscription(
      () => this.getConsolidateJob(jobId),
      {
        intervalMs,
        stopWhen: (job) => CONSOLIDATE_TERMINAL.has(job.status),
      },
      onUpdate
    );
  }
}
