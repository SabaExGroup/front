import { Injectable, inject } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import {
  CreatePoolTokenOwnerResponse,
  PrefundTokenOwnerRequest,
  PrefundTokenOwnerResponse,
  TokenOwnerPoolWallet,
  WalletBalanceResponseDto,
} from '../models/api.types';
import { ApiService } from '../http/api.service';
import { Network } from '../models/enums';
import { WalletsService } from './wallets.service';
import { createPollSubscription } from '../utils/polling.util';

/** Async prefund can take several minutes via ChangeNOW — poll balance until launch ready. */
export const PREFUND_POLL_TIMEOUT_MS = 15 * 60 * 1000;
export const PREFUND_POLL_INTERVAL_MS = 5_000;

@Injectable({ providedIn: 'root' })
export class TokenOwnerPoolService {
  private readonly api = inject(ApiService);
  private readonly wallets = inject(WalletsService);

  listPool(network: Network, limit = 50): Observable<TokenOwnerPoolWallet[]> {
    return this.api.get<TokenOwnerPoolWallet[]>('/core-trigger/token-owners/pool', { network, limit });
  }

  createInPool(network: Network): Observable<CreatePoolTokenOwnerResponse> {
    return this.api.post<CreatePoolTokenOwnerResponse>('/core-trigger/token-owners/pool', { network });
  }

  prefund(body: PrefundTokenOwnerRequest): Observable<PrefundTokenOwnerResponse> {
    return this.api.post<PrefundTokenOwnerResponse>('/core-trigger/token-owners/prefund', {
      network: body.network,
      walletId: body.walletId,
    });
  }

  pollWalletLaunchReady(
    walletId: string,
    onUpdate: (balance: WalletBalanceResponseDto) => void,
    onError?: (err: unknown) => void,
    intervalMs = PREFUND_POLL_INTERVAL_MS
  ): Subscription {
    return createPollSubscription(
      () => this.wallets.getBalance(walletId),
      {
        intervalMs,
        stopWhen: (balance) => balance.isLaunchReady === true,
      },
      onUpdate,
      onError
    );
  }
}
