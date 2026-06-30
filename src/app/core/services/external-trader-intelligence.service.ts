import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../http/api.service';
import { ExternalTraderIntelligenceSnapshotDto } from '../models/api.types';

@Injectable({ providedIn: 'root' })
export class ExternalTraderIntelligenceService {
  private readonly api = inject(ApiService);

  get(cycleId: string): Observable<ExternalTraderIntelligenceSnapshotDto> {
    return this.api.get<ExternalTraderIntelligenceSnapshotDto>(
      `/cycles/${cycleId}/external-traders`,
    );
  }

  sync(cycleId: string): Observable<ExternalTraderIntelligenceSnapshotDto> {
    return this.api.post<ExternalTraderIntelligenceSnapshotDto>(
      `/cycles/${cycleId}/external-traders/sync`,
    );
  }
}
