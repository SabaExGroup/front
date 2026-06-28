import { Injectable, inject, signal } from '@angular/core';
import { Observable, Subscription, tap } from 'rxjs';
import {
  EmergencyBrakeJobDetailDto,
  EmergencyBrakeResponseDto,
  EmergencyHaltStatusResponseDto,
  ManualBrakeDto,
  ResumeSystemDto,
  ResumeSystemResponseDto,
} from '../models/api.types';
import { ApiService } from '../http/api.service';
import { createPollSubscription } from '../utils/polling.util';
import { BRAKE_JOB_TERMINAL } from '../models/enums';

@Injectable({ providedIn: 'root' })
export class EmergencyService {
  private readonly api = inject(ApiService);

  readonly haltStatus = signal<EmergencyHaltStatusResponseDto | null>(null);
  private haltPollSub?: Subscription;

  getHalt(): Observable<EmergencyHaltStatusResponseDto> {
    return this.api.get<EmergencyHaltStatusResponseDto>('/emergency/halt');
  }

  startHaltPolling(intervalMs = 10_000): void {
    this.stopHaltPolling();
    this.haltPollSub = createPollSubscription(
      () => this.getHalt(),
      { intervalMs, stopWhen: () => false, immediate: true },
      (status) => this.haltStatus.set(status)
    );
  }

  stopHaltPolling(): void {
    this.haltPollSub?.unsubscribe();
    this.haltPollSub = undefined;
  }

  triggerBrake(body: ManualBrakeDto): Observable<EmergencyBrakeResponseDto> {
    return this.api.post<EmergencyBrakeResponseDto>('/emergency/brake', body);
  }

  getBrakeJob(jobId: string): Observable<EmergencyBrakeJobDetailDto> {
    return this.api.get<EmergencyBrakeJobDetailDto>(`/emergency/brake/${jobId}`);
  }

  pollBrakeJob(
    jobId: string,
    onUpdate: (job: EmergencyBrakeJobDetailDto) => void,
    intervalMs = 3_000
  ): Subscription {
    return createPollSubscription(
      () => this.getBrakeJob(jobId),
      {
        intervalMs,
        stopWhen: (job) => BRAKE_JOB_TERMINAL.includes(job.status as (typeof BRAKE_JOB_TERMINAL)[number]),
      },
      onUpdate
    );
  }

  resume(body: ResumeSystemDto): Observable<ResumeSystemResponseDto> {
    return this.api.post<ResumeSystemResponseDto>('/emergency/resume', body).pipe(
      tap(() => this.getHalt().subscribe((s) => this.haltStatus.set(s)))
    );
  }
}
