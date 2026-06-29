import {
  externalLinkLabel,
  inferTwitterSource,
  isPartialSocialBackfillLog,
  isSocialLogHighlight,
  isValidTelegramUrl,
  isValidTwitterUrl,
  isValidWebsiteUrl,
  normalizeTwitterUrl,
  normalizeWebsiteUrl,
  parseInvalidUrlsFromError,
} from './trend-social.util';

describe('trend-social.util', () => {
  describe('URL validation', () => {
    it('accepts valid telegram URLs', () => {
      expect(isValidTelegramUrl('https://t.me/channel_alpha')).toBe(true);
      expect(isValidTelegramUrl('https://telegram.me/foo')).toBe(true);
    });

    it('rejects invalid telegram URLs', () => {
      expect(isValidTelegramUrl('https://example.com')).toBe(false);
    });

    it('normalizes website URLs', () => {
      expect(normalizeWebsiteUrl('example.com')).toBe('https://example.com');
      expect(isValidWebsiteUrl('example.com')).toBe(true);
    });

    it('accepts twitter handles and profile URLs', () => {
      expect(isValidTwitterUrl('@backup_account')).toBe(true);
      expect(isValidTwitterUrl('https://x.com/memecoin')).toBe(true);
      expect(normalizeTwitterUrl('@user')).toBe('https://x.com/user');
    });

    it('rejects twitter search/home paths', () => {
      expect(isValidTwitterUrl('https://x.com/search')).toBe(false);
      expect(isValidTwitterUrl('https://twitter.com/home')).toBe(false);
    });
  });

  describe('inferTwitterSource', () => {
    it('detects pool, synthetic, and auto_x', () => {
      expect(inferTwitterSource('https://x.com/official', ['https://x.com/official'], 'GDSR')).toBe('pool');
      expect(inferTwitterSource('https://x.com/gdsr', [], 'GDSR')).toBe('synthetic');
      expect(inferTwitterSource('https://x.com/other', [], 'GDSR')).toBe('auto_x');
    });
  });

  describe('parseInvalidUrlsFromError', () => {
    it('parses backend validation messages', () => {
      expect(
        parseInvalidUrlsFromError('Invalid telegram URLs: https://bad.com, https://t.me/ok', 'telegram')
      ).toEqual(['https://bad.com', 'https://t.me/ok']);
    });
  });

  describe('social log helpers', () => {
    it('highlights social-related logs', () => {
      expect(
        isSocialLogHighlight({ step: 'SOCIAL', message: 'Resolved twitter', at: '' })
      ).toBe(true);
      expect(
        isSocialLogHighlight({ step: 'TREND_GENERATION', message: 'FxTwitter lookup', at: '' })
      ).toBe(true);
      expect(
        isSocialLogHighlight({ step: 'FUNDING', message: 'wallet funded', at: '' })
      ).toBe(false);
    });

    it('detects partial backfill logs', () => {
      expect(
        isPartialSocialBackfillLog({ step: 'TOKEN_LAUNCH', message: 'partial backfill social', at: '' })
      ).toBe(true);
      expect(
        isPartialSocialBackfillLog({ step: 'TOKEN_LAUNCH', message: 'launched', at: '' })
      ).toBe(false);
    });

    it('shortens external link labels', () => {
      expect(externalLinkLabel('https://x.com/gdsro')).toContain('x.com');
    });
  });
});
