import { CycleLogEntryDto, TrendSocialPoolsSnapshot } from '../models/api.types';

export type SocialUrlKind = 'telegram' | 'website' | 'twitter';
export type SocialSource = 'auto_x' | 'pool' | 'synthetic';

const SOCIAL_LOG_STEPS = new Set(['SOCIAL', 'TREND_GENERATION', 'TOKEN_LAUNCH']);

const TELEGRAM_URL_REGEX = /^https:\/\/(t\.me|telegram\.me|telegram\.dog)\/.+/i;
const WEBSITE_URL_REGEX = /^https?:\/\/.+/i;
const TWITTER_PROFILE_REGEX = /^https:\/\/(x\.com|twitter\.com)\/[^/?#]+$/i;
const TWITTER_HANDLE_REGEX = /^@[A-Za-z0-9_]{1,15}$/;
const TWITTER_BLOCKED_PATH = /\/(search|home|intent)(\/|$)/i;

export function normalizeWebsiteUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function normalizeTwitterUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (TWITTER_HANDLE_REGEX.test(trimmed)) {
    return `https://x.com/${trimmed.slice(1)}`;
  }
  return trimmed;
}

export function isValidTelegramUrl(input: string): boolean {
  const url = input.trim();
  return url.length > 0 && TELEGRAM_URL_REGEX.test(url);
}

export function isValidWebsiteUrl(input: string): boolean {
  const url = normalizeWebsiteUrl(input);
  return url.length > 0 && WEBSITE_URL_REGEX.test(url);
}

export function isValidTwitterUrl(input: string): boolean {
  const raw = input.trim();
  if (!raw) return false;
  if (TWITTER_HANDLE_REGEX.test(raw)) return true;
  const normalized = normalizeTwitterUrl(raw);
  if (!TWITTER_PROFILE_REGEX.test(normalized)) return false;
  return !TWITTER_BLOCKED_PATH.test(normalized);
}

export function validateSocialPools(pools: {
  telegramUrlPool: string[];
  websiteUrlPool: string[];
  twitterUrlPool: string[];
}): Record<SocialUrlKind, string[]> {
  const errors: Record<SocialUrlKind, string[]> = {
    telegram: [],
    website: [],
    twitter: [],
  };

  for (const url of pools.telegramUrlPool) {
    if (url.trim() && !isValidTelegramUrl(url)) {
      errors.telegram.push(url);
    }
  }
  for (const url of pools.websiteUrlPool) {
    if (url.trim() && !isValidWebsiteUrl(url)) {
      errors.website.push(url);
    }
  }
  for (const url of pools.twitterUrlPool) {
    if (url.trim() && !isValidTwitterUrl(url)) {
      errors.twitter.push(url);
    }
  }

  return errors;
}

export function hasValidationErrors(errors: Record<SocialUrlKind, string[]>): boolean {
  return errors.telegram.length > 0 || errors.website.length > 0 || errors.twitter.length > 0;
}

export function parseInvalidUrlsFromError(message: string, kind: SocialUrlKind): string[] {
  const label =
    kind === 'telegram' ? 'telegram' : kind === 'website' ? 'website' : 'twitter';
  const match = message.match(new RegExp(`Invalid ${label} URLs?:\\s*(.+)$`, 'i'));
  if (!match?.[1]) return [];
  return match[1].split(',').map((s) => s.trim()).filter(Boolean);
}

export function inferInvalidUrlKind(message: string): SocialUrlKind | null {
  if (/invalid telegram urls?/i.test(message)) return 'telegram';
  if (/invalid website urls?/i.test(message)) return 'website';
  if (/invalid twitter urls?/i.test(message)) return 'twitter';
  return null;
}

export function trimUrlPool(urls: string[]): string[] {
  return urls.map((u) => u.trim()).filter(Boolean);
}

export function poolsAreEmpty(snapshot: Pick<TrendSocialPoolsSnapshot, 'telegramUrlPool' | 'websiteUrlPool' | 'twitterUrlPool'>): boolean {
  return (
    snapshot.telegramUrlPool.length === 0 &&
    snapshot.websiteUrlPool.length === 0 &&
    snapshot.twitterUrlPool.length === 0
  );
}

export function inferTwitterSource(
  url: string,
  pool: string[],
  symbol: string,
): SocialSource {
  const normalized = normalizeTwitterUrl(url).toLowerCase();
  const poolNormalized = new Set(pool.map((p) => normalizeTwitterUrl(p).toLowerCase()));
  if (poolNormalized.has(normalized)) return 'pool';
  const slug = symbol.toLowerCase();
  if (normalized === `https://x.com/${slug}`) return 'synthetic';
  return 'auto_x';
}

export function inferTelegramSource(url: string, pool: string[], symbol: string): SocialSource {
  const normalized = url.trim().toLowerCase();
  const poolSet = new Set(pool.map((p) => p.trim().toLowerCase()));
  if (poolSet.has(normalized)) return 'pool';
  const slug = symbol.toLowerCase();
  if (normalized === `https://t.me/${slug}`) return 'synthetic';
  return 'pool';
}

export function inferWebsiteSource(url: string, pool: string[], symbol: string): SocialSource {
  const normalized = normalizeWebsiteUrl(url).toLowerCase();
  const poolSet = new Set(pool.map((p) => normalizeWebsiteUrl(p).toLowerCase()));
  if (poolSet.has(normalized)) return 'pool';
  const searchFallback = `https://x.com/search?q=%24${encodeURIComponent(symbol.toUpperCase())}`.toLowerCase();
  if (normalized === searchFallback || normalized.includes('x.com/search')) return 'synthetic';
  return 'pool';
}

export function socialSourceLabel(source: SocialSource): string {
  switch (source) {
    case 'auto_x':
      return 'Auto X search (FxTwitter)';
    case 'pool':
      return 'Operator pool';
    case 'synthetic':
      return 'Synthetic fallback';
  }
}

export function socialSourceBadgeColor(source: SocialSource): string {
  switch (source) {
    case 'auto_x':
      return 'primary';
    case 'pool':
      return 'success';
    case 'synthetic':
      return 'warning';
  }
}

export function isSocialLogHighlight(log: CycleLogEntryDto): boolean {
  if (!SOCIAL_LOG_STEPS.has(log.step)) {
    return false;
  }
  const msg = log.message.toLowerCase();
  return (
    log.step === 'SOCIAL' ||
    msg.includes('social') ||
    msg.includes('twitter') ||
    msg.includes('telegram') ||
    msg.includes('website') ||
    msg.includes('fxtwitter') ||
    msg.includes('vxtwitter')
  );
}

export function isPartialSocialBackfillLog(log: CycleLogEntryDto): boolean {
  const msg = log.message.toLowerCase();
  return (
    log.step === 'TOKEN_LAUNCH' &&
    (msg.includes('backfill') || msg.includes('partial') || msg.includes('empty social'))
  );
}

export function externalLinkLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.length > 24 ? `${parsed.pathname.slice(0, 24)}…` : parsed.pathname;
    return `${parsed.hostname}${path}`;
  } catch {
    return url.length > 40 ? `${url.slice(0, 40)}…` : url;
  }
}
