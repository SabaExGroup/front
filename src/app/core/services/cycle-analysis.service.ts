import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../http/api.service';
import { CycleAnalysisResponseDto } from '../models/api.types';

@Injectable({ providedIn: 'root' })
export class CycleAnalysisService {
  private readonly api = inject(ApiService);

  get(cycleId: string): Observable<CycleAnalysisResponseDto> {
    return this.api.get<CycleAnalysisResponseDto>(`/cycles/${cycleId}/analysis`);
  }

  sync(cycleId: string): Observable<CycleAnalysisResponseDto> {
    return this.api.post<CycleAnalysisResponseDto>(`/cycles/${cycleId}/analysis/sync`);
  }
}
