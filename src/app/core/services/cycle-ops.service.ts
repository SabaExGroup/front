import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  LaunchTokenDto,
  LaunchpadRecommendationDto,
  MarketSessionDetailResponseDto,
  MarketSessionResponseDto,
  StartMarketMakingDto,
  TokenLaunchResponseDto,
  TrendPackageResponseDto,
  TrendRegenerateDto,
} from '../models/api.types';
import { ApiService } from '../http/api.service';
import { Network } from '../models/enums';

@Injectable({ providedIn: 'root' })
export class CycleOpsService {
  private readonly api = inject(ApiService);

  regenerateTrend(cycleId: string, body?: TrendRegenerateDto): Observable<TrendPackageResponseDto> {
    return this.api.post<TrendPackageResponseDto>(`/trend-finder/regenerate/${cycleId}`, body ?? {});
  }

  getBestLaunchpad(network: Network): Observable<LaunchpadRecommendationDto> {
    return this.api.get<LaunchpadRecommendationDto>('/token-factory/launchpads/best', { network });
  }

  launchToken(body: LaunchTokenDto): Observable<TokenLaunchResponseDto> {
    return this.api.post<TokenLaunchResponseDto>('/token-factory/launch', body);
  }

  startMarket(body: StartMarketMakingDto): Observable<MarketSessionResponseDto> {
    return this.api.post<MarketSessionResponseDto>('/market-generator/start', body);
  }

  getMarketSession(sessionId: string): Observable<MarketSessionDetailResponseDto> {
    return this.api.get<MarketSessionDetailResponseDto>(`/market-generator/sessions/${sessionId}`);
  }

  stopMarket(sessionId: string): Observable<MarketSessionResponseDto> {
    return this.api.post<MarketSessionResponseDto>(`/market-generator/sessions/${sessionId}/stop`, {});
  }
}
