export const SESSION_API_KEY = 'apiKey';
export const SESSION_API_BASE = 'apiBase';

export const PUBLIC_PATHS = [
  '/health',
  '/integrations/health',
  '/integrations/rpc/health',
] as const;

export function isPublicPath(path: string): boolean {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return PUBLIC_PATHS.some((p) => normalized === p || normalized.startsWith('/assets/logos/'));
}
