import { CycleLogEntryDto, TrendSocialPoolsSnapshot } from '../models/api.types';

export type SocialUrlKind = 'telegram' | 'website' | 'twitter';
export type SocialSource = 'auto_x' | 'pool' | 'synthetic';

const SOCIAL_LOG_STEPS = new Set(['SOCIAL', 'TREND_GENERATION', 'TOKEN_LAUNCH']);

const POOL_TEXT_SPLIT = /[\n\r,;]+/;

/** Expand backend/UI paste: string, string[], or entries with embedded newlines → flat string[]. */
export function expandUrlPoolValue(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === 'string') {
    return value
      .split(POOL_TEXT_SPLIT)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) {
    const out: string[] = [];
    for (const item of value) {
      if (typeof item === 'string') {
        out.push(
          ...item
            .split(POOL_TEXT_SPLIT)
            .map((part) => part.trim())
            .filter(Boolean),
        );
      }
    }
    return out;
  }
  return [];
}

export function splitUrlPoolText(text: string): string[] {
  return text
    .split(POOL_TEXT_SPLIT)
    .map((part) => part.trim())
    .filter(Boolean);
}
const TELEGRAM_URL_REGEX = /^https:\/\/(t\.me|telegram\.me|telegram\.dog)\/[a-z0-9_]{2,}/i;
const WEBSITE_URL_REGEX = /^https?:\/\/.+/i;
const TWITTER_PROFILE_REGEX = /^https:\/\/(x\.com|twitter\.com)\/[A-Za-z0-9_]{2,}$/i;
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
  try {
    let raw = trimmed;
    if (!/^https?:\/\//i.test(raw)) {
      raw = `https://${raw}`;
    }
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    if (host !== 'x.com' && host !== 'twitter.com') {
      return trimmed;
    }
    const handle = parsed.pathname.replace(/^\/+/, '').split('/')[0]?.replace(/^@+/, '') ?? '';
    if (!handle || TWITTER_BLOCKED_PATH.test(`/${handle}`)) {
      return trimmed;
    }
    return `https://x.com/${handle}`;
  } catch {
    return trimmed;
  }
}

export function normalizeTelegramUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  try {
    let raw = trimmed;
    if (!/^https?:\/\//i.test(raw)) {
      if (/^(t\.me|telegram\.me|telegram\.dog)\//i.test(raw)) {
        raw = `https://${raw}`;
      } else {
        return trimmed;
      }
    }
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    if (host !== 't.me' && host !== 'telegram.me' && host !== 'telegram.dog') {
      return trimmed;
    }
    const channel = parsed.pathname.replace(/^\/+/, '').split('/')[0] ?? '';
    if (!channel) return '';
    // Backend validators often require lowercase t.me slugs.
    return `https://t.me/${channel.toLowerCase()}`;
  } catch {
    return trimmed;
  }
}

export function isValidTelegramUrl(input: string): boolean {
  const url = normalizeTelegramUrl(input);
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

  for (const url of pools.telegramUrlPool ?? []) {
    if (url.trim() && !isValidTelegramUrl(url)) {
      errors.telegram.push(url);
    }
  }
  for (const url of pools.websiteUrlPool ?? []) {
    if (url.trim() && !isValidWebsiteUrl(url)) {
      errors.website.push(url);
    }
  }
  for (const url of pools.twitterUrlPool ?? []) {
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
  const patterns = [
    new RegExp(`Invalid ${label} URLs?:\\s*(.+)$`, 'i'),
    new RegExp(`${label} URLs? (?:validation )?failed:?\\s*(.+)$`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return match[1].split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

export function inferInvalidUrlKind(message: string): SocialUrlKind | null {
  if (/invalid telegram|telegram urls?/i.test(message)) return 'telegram';
  if (/invalid website|website urls?/i.test(message)) return 'website';
  if (/invalid twitter|twitter urls?/i.test(message)) return 'twitter';
  return null;
}

export function formatSocialPoolsSaveError(error: unknown): string {
  const base = typeof error === 'object' && error !== null
    ? extractSocialPoolsHttpMessage(error)
    : String(error ?? 'Request failed');

  if (/Http failure response for/i.test(base)) {
    return `${base}. Open browser DevTools → Network → social-pools → Response for the backend validation message.`;
  }
  return base;
}

function extractSocialPoolsHttpMessage(error: unknown): string {
  const errObj = error as {
    error?: unknown;
    message?: string;
    status?: number;
    statusText?: string;
  };

  const nested = errObj.error;
  if (nested && typeof nested === 'object') {
    const body = nested as Record<string, unknown>;
    const message = body['message'];
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.map(String).join('; ');
    if (message && typeof message === 'object') {
      const inner = message as Record<string, unknown>;
      if (Array.isArray(inner['message'])) return inner['message'].map(String).join('; ');
      if (typeof inner['message'] === 'string') return inner['message'];
    }
  }

  if (typeof errObj.message === 'string') return errObj.message;
  return 'Request failed';
}

export function trimUrlPool(urls: string[] | null | undefined): string[] {
  return (urls ?? []).map((u) => u.trim()).filter(Boolean);
}

function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    const key = url.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(url.trim());
  }
  return out;
}

export function buildSocialPoolsPayload(
  current: TrendSocialPoolsSnapshot,
): TrendSocialPoolsSnapshot {
  return {
    telegramUrlPool: dedupeUrls(
      expandUrlPoolValue(current.telegramUrlPool).map(normalizeTelegramUrl).filter(Boolean),
    ),
    websiteUrlPool: dedupeUrls(
      expandUrlPoolValue(current.websiteUrlPool).map(normalizeWebsiteUrl).filter(Boolean),
    ),
    twitterUrlPool: dedupeUrls(
      expandUrlPoolValue(current.twitterUrlPool).map(normalizeTwitterUrl).filter(Boolean),
    ),
    twitterSearchEnabled: current.twitterSearchEnabled !== false,
    twitterMinFollowers: Math.max(0, Math.floor(Number(current.twitterMinFollowers) || 0)),
  };
}

function readUrlPool(source: Record<string, unknown>, ...keys: string[]): string[] {
  for (const key of keys) {
    if (!(key in source)) continue;
    return expandUrlPoolValue(source[key]);
  }
  return [];
}

export function normalizeSocialPoolsSnapshot(raw: unknown): TrendSocialPoolsSnapshot {
  const root = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const nested =
    root['social'] && typeof root['social'] === 'object'
      ? (root['social'] as Record<string, unknown>)
      : root;

  return buildSocialPoolsPayload({
    telegramUrlPool: readUrlPool(nested, 'telegramUrlPool', 'telegramUrls', 'telegram_urls'),
    websiteUrlPool: readUrlPool(nested, 'websiteUrlPool', 'websiteUrls', 'website_urls'),
    twitterUrlPool: readUrlPool(nested, 'twitterUrlPool', 'twitterUrls', 'twitter_urls'),
    twitterSearchEnabled: nested['twitterSearchEnabled'] !== false,
    twitterMinFollowers: Number(nested['twitterMinFollowers'] ?? 0) || 0,
  });
}

export function poolsAreEmpty(snapshot: Pick<TrendSocialPoolsSnapshot, 'telegramUrlPool' | 'websiteUrlPool' | 'twitterUrlPool'>): boolean {
  return (
    (snapshot.telegramUrlPool?.length ?? 0) === 0 &&
    (snapshot.websiteUrlPool?.length ?? 0) === 0 &&
    (snapshot.twitterUrlPool?.length ?? 0) === 0
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
