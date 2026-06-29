import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  TrendSocialPoolsSnapshot,
  TrendSocialPoolsUpdateDto,
} from '../models/api.types';
import { ApiService } from '../http/api.service';

@Injectable({ providedIn: 'root' })
export class TrendSocialService {
  private readonly api = inject(ApiService);

  getSocialPools(): Observable<TrendSocialPoolsSnapshot> {
    return this.api.get<TrendSocialPoolsSnapshot>('/trend-finder/social-pools');
  }

  saveSocialPools(body: TrendSocialPoolsUpdateDto): Observable<TrendSocialPoolsSnapshot> {
    return this.api.put<TrendSocialPoolsSnapshot>('/trend-finder/social-pools', body);
  }
}
