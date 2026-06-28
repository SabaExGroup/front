import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from '../auth/auth.service';

type QueryParams = Record<string, string | number | boolean | undefined | null>;

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  get<T>(path: string, query?: QueryParams): Observable<T> {
    return this.http.get<T>(this.url(path), { params: this.toParams(query) });
  }

  post<T>(path: string, body?: unknown, query?: QueryParams): Observable<T> {
    return this.http.post<T>(this.url(path), body ?? {}, { params: this.toParams(query) });
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>(this.url(path), body);
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(this.url(path));
  }

  assetLogoUrl(filename: string): string {
    return `${this.auth.apiBase()}/assets/logos/${filename}`;
  }

  private url(path: string): string {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${this.auth.apiBase()}${normalized}`;
  }

  private toParams(query?: QueryParams): HttpParams | undefined {
    if (!query) {
      return undefined;
    }

    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return params;
  }
}
