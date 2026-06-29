import {
  computeOwnerFundingStatus,
  formatPrefundToast,
  isTokenOwnerLogHighlight,
  isTokenOwnerReuseDisabledMessage,
  ownerFundingStatusBadgeColor,
  ownerFundingStatusLabel,
  readOwnerLaunchFundingUsd,
  readTokenOwnerReuseEnabled,
} from './token-owner-pool.util';

describe('token-owner-pool.util', () => {
  describe('computeOwnerFundingStatus', () => {
    const target = 550;

    it('returns in_use when cycleId is set', () => {
      expect(computeOwnerFundingStatus(500, target, 'cycle-1', 10)).toBe('in_use');
    });

    it('returns ready when balance >= 50% target', () => {
      expect(computeOwnerFundingStatus(275, target, null, 5)).toBe('ready');
      expect(computeOwnerFundingStatus(560, target, null, 5)).toBe('ready');
    });

    it('returns partial when balance > 0 but below threshold', () => {
      expect(computeOwnerFundingStatus(100, target, null, 5)).toBe('partial');
    });

    it('returns needs_prefund when empty but has age', () => {
      expect(computeOwnerFundingStatus(0, target, null, 24)).toBe('needs_prefund');
    });

    it('returns empty for new wallet with zero balance', () => {
      expect(computeOwnerFundingStatus(0, target, null, 0)).toBe('empty');
    });
  });

  describe('readTokenOwnerReuseEnabled', () => {
    it('defaults to true when field is missing', () => {
      expect(readTokenOwnerReuseEnabled({ strategy: {} })).toBe(true);
      expect(readTokenOwnerReuseEnabled(null)).toBe(true);
    });

    it('returns false only when explicitly false', () => {
      expect(readTokenOwnerReuseEnabled({ strategy: { tokenOwnerReuseEnabled: false } })).toBe(false);
    });
  });

  describe('readOwnerLaunchFundingUsd', () => {
    it('reads strategy.ownerLaunchFundingUsd with fallback', () => {
      expect(readOwnerLaunchFundingUsd({ strategy: { ownerLaunchFundingUsd: 600 } })).toBe(600);
      expect(readOwnerLaunchFundingUsd({})).toBe(550);
    });
  });

  describe('isTokenOwnerLogHighlight', () => {
    it('highlights WALLET_GENERATION reuse messages', () => {
      expect(
        isTokenOwnerLogHighlight({
          step: 'WALLET_GENERATION',
          message: 'Reused TOKEN_OWNER wallet abc (balance $500)',
          at: '2026-01-01',
        })
      ).toBe(true);
    });

    it('ignores unrelated steps', () => {
      expect(
        isTokenOwnerLogHighlight({
          step: 'TOKEN_LAUNCH',
          message: 'Reused TOKEN_OWNER wallet',
          at: '2026-01-01',
        })
      ).toBe(false);
    });
  });

  describe('formatPrefundToast', () => {
    it('formats already funded response', () => {
      const msg = formatPrefundToast({
        alreadyFunded: true,
        balanceUsd: 560,
        targetUsd: 550,
        ageHours: 30,
      });
      expect(msg).toContain('Launch ready');
      expect(msg).toContain('560');
    });

    it('formats top-up response', () => {
      const msg = formatPrefundToast({
        alreadyFunded: false,
        balanceUsd: 545,
        targetUsd: 550,
        topUpSendUsd: 120.5,
        ageHours: 28,
      });
      expect(msg).toContain('top-up');
      expect(msg).toContain('120.5');
    });
  });

  describe('isTokenOwnerReuseDisabledMessage', () => {
    it('detects backend reuse disabled error', () => {
      expect(isTokenOwnerReuseDisabledMessage('TOKEN_OWNER reuse is disabled in settings')).toBe(true);
    });
  });

  describe('ownerFundingStatusLabel', () => {
    it('maps status codes to labels', () => {
      expect(ownerFundingStatusLabel('ready')).toBe('Ready');
      expect(ownerFundingStatusLabel('needs_prefund')).toBe('Needs prefund');
      expect(ownerFundingStatusBadgeColor('in_use')).toBe('info');
    });
  });
});
