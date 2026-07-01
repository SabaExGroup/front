import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { timeout } from 'rxjs/operators';
import {
  CreatePoolTokenOwnerResponse,
  PrefundTokenOwnerRequest,
  PrefundTokenOwnerResponse,
  TokenOwnerPoolWallet,
} from '../models/api.types';
import { ApiService } from '../http/api.service';
import { Network } from '../models/enums';

/**
 * `POST prefund` is synchronous — the backend blocks until ChangeNOW completes before
 * responding, which can take several minutes (docs/ui-token-owner-wallet-pool.md §3.3: "Timeout
 * UI حداقل 10–15 دقیقه"). Give the request itself a matching client timeout instead of polling a
 * separate balance endpoint afterwards — the prefund response already carries the final balance.
 */
export const PREFUND_TIMEOUT_MS = 15 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class TokenOwnerPoolService {
  private readonly api = inject(ApiService);

  listPool(network: Network, limit = 50): Observable<TokenOwnerPoolWallet[]> {
    return this.api.get<TokenOwnerPoolWallet[]>('/core-trigger/token-owners/pool', { network, limit });
  }

  createInPool(network: Network): Observable<CreatePoolTokenOwnerResponse> {
    return this.api.post<CreatePoolTokenOwnerResponse>('/core-trigger/token-owners/pool', { network });
  }

  prefund(body: PrefundTokenOwnerRequest): Observable<PrefundTokenOwnerResponse> {
    return this.api
      .post<PrefundTokenOwnerResponse>('/core-trigger/token-owners/prefund', {
        network: body.network,
        walletId: body.walletId,
      })
      .pipe(timeout(PREFUND_TIMEOUT_MS));
  }
}
