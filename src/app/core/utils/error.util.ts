import { HttpErrorResponseDto } from '../models/api.types';

export type ApiErrorContext = 'brake' | 'resume' | 'lifecycle' | 'drain' | 'rearm' | 'consolidate';

export interface ApiErrorFormatOptions {
  context?: ApiErrorContext;
  emergencyLock?: string;
}

export function getHttpStatus(error: unknown): number | undefined {
  const errObj = error as { status?: number; statusCode?: number; error?: HttpErrorResponseDto };
  return errObj.status ?? errObj.statusCode ?? errObj.error?.statusCode;
}

export function extractErrorMessage(error: unknown): string {
  if (!error) {
    return 'Unknown error';
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  const httpError = error as HttpErrorResponseDto;
  if (httpError.message) {
    if (typeof httpError.message === 'string') {
      return httpError.message;
    }
    const nested = httpError.message.message;
    if (Array.isArray(nested)) {
      return nested.join('; ');
    }
    if (typeof nested === 'string') {
      return nested;
    }
  }

  const errObj = error as { error?: HttpErrorResponseDto; message?: string; status?: number; statusText?: string; url?: string };
  if (errObj.status === 0) {
    return (
      'Cannot reach the API (network/CORS). In dev use API Base `/api/v1` and restart `npm start` ' +
      '(proxy forwards to localhost:5420). Ensure the API is running.'
    );
  }
  if (typeof errObj.message === 'string' && errObj.message.includes('Http failure during parsing')) {
    return (
      'API returned HTML instead of JSON — the dev proxy is not active. Stop and restart `npm start`, ' +
      'then use API Base `/api/v1` (not http://localhost:5420/...).'
    );
  }
  if (errObj.error?.message) {
    return extractErrorMessage(errObj.error);
  }
  if (errObj.message) {
    return errObj.message;
  }

  return 'Request failed';
}

/** docs §10 — mapped HTTP errors for treasury / emergency flows */
export function formatApiError(error: unknown, options: ApiErrorFormatOptions = {}): string {
  const status = getHttpStatus(error);
  const { context, emergencyLock } = options;

  if (status === 409) {
    if (context === 'resume') {
      const lockHint = emergencyLock ? ` Active emergency lock: ${emergencyLock}.` : '';
      return `Resume rejected — halt belongs to another brake job.${lockHint}`;
    }
    return 'Another operation is already in progress. Wait for the current job to finish.';
  }

  if (status === 404 && context && ['brake', 'lifecycle', 'drain', 'rearm', 'consolidate'].includes(context)) {
    return 'Resource not found — check cycle ID or job ID.';
  }

  return extractErrorMessage(error);
}
