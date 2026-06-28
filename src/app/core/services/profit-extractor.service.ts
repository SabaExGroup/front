import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  LiquidityAnalysisResponseDto,
  ProfitExtractorJobResponseDto,
  ProfitExtractorLogListResponseDto,
  ProfitExtractorRunDto,
  ProfitExtractorStatusResponseDto,
  ProfitLogsQuery,
  SecurityReportResponseDto,
  TokenInfoResponseDto,
} from '../models/api.types';
import { ApiService } from '../http/api.service';
import { Network } from '../models/enums';

@Injectable({ providedIn: 'root' })
export class ProfitExtractorService {
  private readonly api = inject(ApiService);

  getStatus(cycleId: string): Observable<ProfitExtractorStatusResponseDto> {
    return this.api.get<ProfitExtractorStatusResponseDto>(`/profit-extractor/status/${cycleId}`);
  }

  run(body: ProfitExtractorRunDto): Observable<ProfitExtractorJobResponseDto> {
    return this.api.post<ProfitExtractorJobResponseDto>('/profit-extractor/run', body);
  }

  getLogs(query?: ProfitLogsQuery): Observable<ProfitExtractorLogListResponseDto> {
    return this.api.get<ProfitExtractorLogListResponseDto>('/profit-extractor/logs', {
      cycleId: query?.cycleId,
      page: query?.page,
      limit: query?.limit,
    });
  }
}

@Injectable({ providedIn: 'root' })
export class TokenAnalysisService {
  private readonly api = inject(ApiService);

  getTokenInfo(address: string, network: Network = 'SOLANA'): Observable<TokenInfoResponseDto> {
    return this.api.get<TokenInfoResponseDto>(`/token-info/${address}`, { network });
  }

  getLiquidity(address: string, network: Network = 'SOLANA', launchpad?: string): Observable<LiquidityAnalysisResponseDto> {
    return this.api.get<LiquidityAnalysisResponseDto>(`/liquidity/${address}`, { network, launchpad });
  }

  checkSecurity(network: Network, address: string): Observable<SecurityReportResponseDto> {
    return this.api.get<SecurityReportResponseDto>('/security/check', { network, address });
  }

  checkSecurityPost(network: Network, address: string): Observable<SecurityReportResponseDto> {
    return this.api.post<SecurityReportResponseDto>('/security/check', { network, address });
  }
}
