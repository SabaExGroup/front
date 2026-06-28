import { Injectable, computed, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { SESSION_API_BASE, SESSION_API_KEY } from '../config/api.constants';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiKeySignal = signal<string | null>(this.readStorage(SESSION_API_KEY));
  private readonly apiBaseSignal = signal<string>(
    this.readStorage(SESSION_API_BASE) ?? environment.defaultApiBase
  );

  readonly apiKey = this.apiKeySignal.asReadonly();
  readonly apiBase = this.apiBaseSignal.asReadonly();
  readonly isAuthenticated = computed(() => !!this.apiKeySignal());

  setCredentials(apiKey: string, apiBase?: string): void {
    this.writeStorage(SESSION_API_KEY, apiKey);
    this.apiKeySignal.set(apiKey);

    const base = apiBase?.trim() || environment.defaultApiBase;
    this.writeStorage(SESSION_API_BASE, base);
    this.apiBaseSignal.set(base);
  }

  setApiBase(apiBase: string): void {
    const base = apiBase.trim() || environment.defaultApiBase;
    this.writeStorage(SESSION_API_BASE, base);
    this.apiBaseSignal.set(base);
  }

  logout(): void {
    this.removeStorage(SESSION_API_KEY);
    this.removeStorage(SESSION_API_BASE);
    this.apiKeySignal.set(null);
    this.apiBaseSignal.set(environment.defaultApiBase);
  }

  private readStorage(key: string): string | null {
    try {
      const fromLocal = localStorage.getItem(key);
      if (fromLocal) {
        return fromLocal;
      }

      const fromSession = sessionStorage.getItem(key);
      if (fromSession) {
        localStorage.setItem(key, fromSession);
        sessionStorage.removeItem(key);
        return fromSession;
      }

      return null;
    } catch {
      return null;
    }
  }

  private writeStorage(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
      sessionStorage.removeItem(key);
    } catch {
      // ignore quota / private mode
    }
  }

  private removeStorage(key: string): void {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}
