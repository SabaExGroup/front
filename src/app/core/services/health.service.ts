import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  HealthResponseDto,
  IntegrationsHealthResponseDto,
  NativeUsdPricesResponseDto,
  RpcHealthResponseDto,
} from '../models/api.types';
import { ApiService } from '../http/api.service';

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly api = inject(ApiService);

  getHealth(): Observable<HealthResponseDto> {
    return this.api.get<HealthResponseDto>('/health');
  }

  getIntegrationsHealth(): Observable<IntegrationsHealthResponseDto> {
    return this.api.get<IntegrationsHealthResponseDto>('/integrations/health');
  }

  getRpcHealth(): Observable<RpcHealthResponseDto> {
    return this.api.get<RpcHealthResponseDto>('/integrations/rpc/health');
  }
}

@Injectable({ providedIn: 'root' })
export class IntegrationsService {
  private readonly api = inject(ApiService);

  getNativePrices(): Observable<NativeUsdPricesResponseDto> {
    return this.api.get<NativeUsdPricesResponseDto>('/integrations/native-prices');
  }

  refreshNativePrices(): Observable<NativeUsdPricesResponseDto> {
    return this.api.post<NativeUsdPricesResponseDto>('/integrations/native-prices/refresh');
  }
}
