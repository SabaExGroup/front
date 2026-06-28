import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CycleMarketWalletBalancesResponseDto,
  GenerateWalletsDto,
  ListWalletsQuery,
  WalletBalanceResponseDto,
  WalletDetailResponseDto,
  WalletListResponseDto,
} from '../models/api.types';
import { ApiService } from '../http/api.service';

@Injectable({ providedIn: 'root' })
export class WalletsService {
  private readonly api = inject(ApiService);

  list(query?: ListWalletsQuery): Observable<WalletListResponseDto> {
    return this.api.get<WalletListResponseDto>('/wallets', {
      page: query?.page,
      limit: query?.limit,
      cycleId: query?.cycleId,
      network: query?.network,
      type: query?.type,
    });
  }

  getById(walletId: string): Observable<WalletDetailResponseDto> {
    return this.api.get<WalletDetailResponseDto>(`/wallets/${walletId}`);
  }

  getBalance(walletId: string): Observable<WalletBalanceResponseDto> {
    return this.api.get<WalletBalanceResponseDto>(`/wallets/${walletId}/balance`);
  }

  getCycleMarketBalances(cycleId: string): Observable<CycleMarketWalletBalancesResponseDto> {
    return this.api.get<CycleMarketWalletBalancesResponseDto>(
      `/wallets/cycles/${cycleId}/market-balances`,
    );
  }

  syncCycleMarketBalances(cycleId: string): Observable<CycleMarketWalletBalancesResponseDto> {
    return this.api.post<CycleMarketWalletBalancesResponseDto>(
      `/wallets/cycles/${cycleId}/market-balances/sync`,
      {},
    );
  }

  generate(body: GenerateWalletsDto): Observable<unknown> {
    return this.api.post('/wallets', body);
  }
}
