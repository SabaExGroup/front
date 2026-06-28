import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { isPublicPath } from '../config/api.constants';

function normalizeBase(base: string): string {
  return base.replace(/\/$/, '');
}

function isApiRequest(url: string, apiBase: string): boolean {
  const base = normalizeBase(apiBase);
  if (!base) {
    return false;
  }
  return url === base || url.startsWith(`${base}/`) || url.includes(`${base}/`);
}

function apiPathFromUrl(url: string, apiBase: string): string {
  const base = normalizeBase(apiBase);
  const idx = url.indexOf(base);
  if (idx >= 0) {
    const path = url.slice(idx + base.length);
    return path.startsWith('/') ? path : `/${path}`;
  }
  return url;
}

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const apiBase = auth.apiBase();
  const apiKey = auth.apiKey();

  let headers = req.headers;

  const isApi = isApiRequest(req.url, apiBase);
  if (isApi) {
    const path = apiPathFromUrl(req.url, apiBase);
    const needsAuth = !isPublicPath(path) && !path.startsWith('/assets/logos/');

    if (needsAuth && apiKey) {
      headers = headers.set('X-API-Key', apiKey);
    }
  }

  const cloned = req.clone({ headers });

  return next(cloned).pipe(
    catchError((err) => {
      if (err?.status === 401 && isApi) {
        auth.logout();
        router.navigate(['/login']);
      }
      return throwError(() => err);
    })
  );
};
