import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ProxyConfigDto,
  ProxyTestResultDto,
  SettingsResponseDto,
  SettingsUpdateDto,
  TelegramTestDto,
  TelegramTestResponseDto,
} from '../models/api.types';
import { ApiService } from '../http/api.service';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly api = inject(ApiService);

  get(): Observable<SettingsResponseDto> {
    return this.api.get<SettingsResponseDto>('/settings');
  }

  patch(body: SettingsUpdateDto): Observable<SettingsResponseDto> {
    return this.api.patch<SettingsResponseDto>('/settings', body);
  }

  testProxy(body: ProxyConfigDto): Observable<ProxyTestResultDto> {
    return this.api.post<ProxyTestResultDto>('/settings/proxy/test', body);
  }

  testTelegram(body?: TelegramTestDto): Observable<TelegramTestResponseDto> {
    return this.api.post<TelegramTestResponseDto>('/telegram/test', body ?? {});
  }
}
