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

/** Prefund is synchronous on the backend (ChangeNOW) — allow up to 15 minutes. */
const PREFUND_TIMEOUT_MS = 15 * 60 * 1000;

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
    const payload: PrefundTokenOwnerRequest = {
      network: body.network,
      wait: true,
      ...(body.walletId ? { walletId: body.walletId } : {}),
    };
    return this.api
      .post<PrefundTokenOwnerResponse>('/core-trigger/token-owners/prefund', payload)
      .pipe(timeout(PREFUND_TIMEOUT_MS));
  }
}
