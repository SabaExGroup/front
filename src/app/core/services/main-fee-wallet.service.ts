import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { FundWalletsDto, FundingJobResponseDto, MainFeeWalletResponseDto } from '../models/api.types';
import { ApiService } from '../http/api.service';

@Injectable({ providedIn: 'root' })
export class MainFeeWalletService {
  private readonly api = inject(ApiService);

  getWallet(): Observable<MainFeeWalletResponseDto> {
    return this.api.get<MainFeeWalletResponseDto>('/main-fee-wallet');
  }

  fund(body: FundWalletsDto): Observable<FundingJobResponseDto> {
    return this.api.post<FundingJobResponseDto>('/main-fee-wallet/fund', body);
  }
}
