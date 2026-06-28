import { Injectable, inject } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import {
  CycleDetailResponseDto,
  CycleListResponseDto,
  CycleResponseDto,
  CycleResumeSnapshotResponseDto,
  CycleRetryResponseDto,
  ListCyclesQuery,
  RetryCycleDto,
  StartCycleDto,
} from '../models/api.types';
import { ApiService } from '../http/api.service';
import { createPollSubscription } from '../utils/polling.util';
import { isTerminalCycleStatus } from '../models/enums';

@Injectable({ providedIn: 'root' })
export class CyclesService {
  private readonly api = inject(ApiService);

  list(query?: ListCyclesQuery): Observable<CycleListResponseDto> {
    return this.api.get<CycleListResponseDto>('/core-trigger/cycles', {
      page: query?.page,
      limit: query?.limit,
      status: query?.status,
    });
  }

  getById(cycleId: string): Observable<CycleDetailResponseDto> {
    return this.api.get<CycleDetailResponseDto>(`/core-trigger/cycles/${cycleId}`);
  }

  start(body?: StartCycleDto): Observable<CycleResponseDto> {
    return this.api.post<CycleResponseDto>('/core-trigger/cycles', body ?? {});
  }

  abort(cycleId: string): Observable<CycleResponseDto> {
    return this.api.post<CycleResponseDto>(`/core-trigger/cycles/${cycleId}/abort`);
  }

  getResumeSnapshot(cycleId: string): Observable<CycleResumeSnapshotResponseDto> {
    return this.api.get<CycleResumeSnapshotResponseDto>(`/core-trigger/cycles/${cycleId}/resume`);
  }

  retry(cycleId: string, body?: RetryCycleDto): Observable<CycleRetryResponseDto> {
    return this.api.post<CycleRetryResponseDto>(`/core-trigger/cycles/${cycleId}/retry`, body ?? {});
  }

  pollDetail(
    cycleId: string,
    onUpdate: (cycle: CycleDetailResponseDto) => void,
    intervalMs = 5_000
  ): Subscription {
    return createPollSubscription(
      () => this.getById(cycleId),
      {
        intervalMs,
        stopWhen: (cycle) => isTerminalCycleStatus(cycle.status),
      },
      onUpdate
    );
  }
}
