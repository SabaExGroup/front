import {
  extractManualOpsErrorCode,
  formatLiquidityUnlockConfirmMessage,
  formatManualOpsApiError,
  formatManualSellConfirmMessage,
  isStaleConfirmationError,
} from './manual-ops.util';
import { LiquidityUnlockPreviewResponseDto, ManualSellPreviewResponseDto } from '../models/api.types';

function errorWithCode(code: string, message = 'domain error') {
  return { error: { statusCode: 409, message: { statusCode: 409, code, message }, timestamp: '' } };
}

describe('manual-ops.util', () => {
  describe('extractManualOpsErrorCode', () => {
    it('reads error.error.message.code', () => {
      expect(extractManualOpsErrorCode(errorWithCode('SYSTEM_HALTED'))).toBe('SYSTEM_HALTED');
    });

    it('returns undefined for validation errors without a code', () => {
      const err = { error: { statusCode: 400, message: { statusCode: 400, message: ['percent must not be greater than 100'] }, timestamp: '' } };
      expect(extractManualOpsErrorCode(err)).toBeUndefined();
    });
  });

  describe('formatManualOpsApiError', () => {
    it('maps SYSTEM_HALTED to a friendly message', () => {
      expect(formatManualOpsApiError(errorWithCode('SYSTEM_HALTED'))).toContain('halted');
    });

    it('maps FEATURE_DISABLED to a friendly message', () => {
      expect(formatManualOpsApiError(errorWithCode('FEATURE_DISABLED'))).toContain('disabled');
    });

    it('maps ALREADY_IN_PROGRESS to a friendly message', () => {
      expect(formatManualOpsApiError(errorWithCode('ALREADY_IN_PROGRESS'))).toContain('in progress');
    });

    it('maps CONFIRMATION_MISMATCH to a re-preview hint', () => {
      expect(formatManualOpsApiError(errorWithCode('CONFIRMATION_MISMATCH'))).toContain('preview again');
    });

    it('maps NO_ELIGIBLE_WALLETS to a friendly message', () => {
      expect(formatManualOpsApiError(errorWithCode('NO_ELIGIBLE_WALLETS'))).toContain('Nothing eligible');
    });

    it('maps UNSUPPORTED_LAUNCHPAD to a friendly message', () => {
      expect(formatManualOpsApiError(errorWithCode('UNSUPPORTED_LAUNCHPAD'))).toContain('CUSTOM_RAYDIUM');
    });

    it('falls back to extractErrorMessage for uncoded validation errors', () => {
      const err = { error: { statusCode: 400, message: { statusCode: 400, message: 'percent must not be greater than 100' }, timestamp: '' } };
      expect(formatManualOpsApiError(err)).toBe('percent must not be greater than 100');
    });
  });

  describe('isStaleConfirmationError', () => {
    it('returns true for STALE_CONFIRMATION', () => {
      expect(isStaleConfirmationError(errorWithCode('STALE_CONFIRMATION'))).toBe(true);
    });

    it('returns true for CONFIRMATION_ALREADY_USED', () => {
      expect(isStaleConfirmationError(errorWithCode('CONFIRMATION_ALREADY_USED'))).toBe(true);
    });

    it('returns false for other codes', () => {
      expect(isStaleConfirmationError(errorWithCode('SYSTEM_HALTED'))).toBe(false);
    });
  });

  describe('formatManualSellConfirmMessage', () => {
    it('includes percent, amount, wallet count, and slippage', () => {
      const preview: ManualSellPreviewResponseDto = {
        cycleId: 'c1',
        tokenId: 't1',
        resource: 'MARKET',
        percent: 5,
        walletsEligible: 42,
        balanceBeforeTokens: '125000000.123456789',
        targetTokens: '6250000.006172839',
        estimatedUsdValue: 187.5,
        slippageBps: 300,
        confirmationToken: 'token',
        expiresAt: '2026-07-02T09:37:00.000Z',
      };
      const message = formatManualSellConfirmMessage(preview);
      expect(message).toContain('5%');
      expect(message).toContain('42');
      expect(message).toContain('3.00%');
      expect(message).toContain('187.50');
    });
  });

  describe('formatLiquidityUnlockConfirmMessage', () => {
    it('lists each breakdown leg and the totals', () => {
      const preview: LiquidityUnlockPreviewResponseDto = {
        cycleId: 'c1',
        tokenId: 't1',
        requestedTarget: 'AUTO',
        resolvedTargets: ['POOL', 'OWNER'],
        percent: 5,
        breakdown: [
          {
            target: 'POOL',
            poolAddress: 'pool',
            lpBalanceRaw: '981234567890',
            lpAmountToWithdrawRaw: '49061728394',
            lpBalanceAfterRaw: '932172839496',
            fullyUnlockedAfter: false,
            estimatedSolOut: 2.418,
            estimatedTokenOut: 3050000.5,
          },
          {
            target: 'OWNER',
            poolAddress: 'pool',
            lpBalanceRaw: '120000000',
            lpAmountToWithdrawRaw: '6000000',
            lpBalanceAfterRaw: '114000000',
            fullyUnlockedAfter: false,
            estimatedSolOut: 0.296,
            estimatedTokenOut: 372800.2,
          },
        ],
        totalEstimatedSolOut: 2.714,
        totalEstimatedTokenOut: 3423300.7,
        slippageBps: 300,
        confirmationToken: 'token',
        expiresAt: '2026-07-02T09:45:00.000Z',
      };
      const message = formatLiquidityUnlockConfirmMessage(preview);
      expect(message).toContain('POOL');
      expect(message).toContain('OWNER');
      expect(message).toContain('2.714');
      expect(message).toContain('AUTO');
    });
  });
});
