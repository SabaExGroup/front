import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { timeout } from 'rxjs/operators';
import {
  CycleMarketWalletBalancesResponseDto,
  GenerateWalletsDto,
  ListSystemWalletBalancesQuery,
  ListWalletsQuery,
  SystemWalletBalancesResponseDto,
  WalletBalanceResponseDto,
  WalletDetailResponseDto,
  WalletListResponseDto,
} from '../models/api.types';
import { ApiService } from '../http/api.service';

/** Sync runs RPC for many wallets in parallel — allow at least 60s before client timeout. */
const SYSTEM_WALLET_SYNC_TIMEOUT_MS = 60_000;

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

  getSystemWalletBalances(
    query?: ListSystemWalletBalancesQuery,
  ): Observable<SystemWalletBalancesResponseDto> {
    return this.api.get<SystemWalletBalancesResponseDto>('/wallets/overview/balances', {
      network: query?.network,
      type: query?.type,
    });
  }

  syncSystemWalletBalances(
    query?: ListSystemWalletBalancesQuery,
  ): Observable<SystemWalletBalancesResponseDto> {
    return this.api
      .post<SystemWalletBalancesResponseDto>('/wallets/overview/balances/sync', {}, {
        network: query?.network,
        type: query?.type,
      })
      .pipe(timeout(SYSTEM_WALLET_SYNC_TIMEOUT_MS));
  }

  generate(body: GenerateWalletsDto): Observable<unknown> {
    return this.api.post('/wallets', body);
  }
}
