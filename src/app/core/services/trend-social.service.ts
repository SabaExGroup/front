import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  TrendSocialPoolsSnapshot,
  TrendSocialPoolsUpdateDto,
} from '../models/api.types';
import { buildSocialPoolsPayload } from '../utils/trend-social.util';
import { ApiService } from '../http/api.service';

@Injectable({ providedIn: 'root' })
export class TrendSocialService {
  private readonly api = inject(ApiService);

  getSocialPools(): Observable<TrendSocialPoolsSnapshot> {
    return this.api.get<TrendSocialPoolsSnapshot>('/trend-finder/social-pools');
  }

  /** PUT expects whitelisted keys; pool fields must be string[] (never a single multiline string). */
  saveSocialPools(body: TrendSocialPoolsSnapshot): Observable<TrendSocialPoolsSnapshot> {
    const normalized = buildSocialPoolsPayload(body);
    const payload: TrendSocialPoolsUpdateDto = {
      telegramUrlPool: [...normalized.telegramUrlPool],
      websiteUrlPool: [...normalized.websiteUrlPool],
      twitterUrlPool: [...normalized.twitterUrlPool],
      twitterSearchEnabled: normalized.twitterSearchEnabled,
      twitterMinFollowers: normalized.twitterMinFollowers,
    };
    return this.api.put<TrendSocialPoolsSnapshot>('/trend-finder/social-pools', payload);
  }
}
