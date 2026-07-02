import { FormBuilder } from '@angular/forms';
import {
  buildSettingsForm,
  formToDirtyUpdatePayload,
  formToNormalizedState,
  formToUpdatePayload,
  mergeSettingsAfterSave,
  mergeSettingsPatch,
  normalizeSettingsShape,
  validateSettingsForm,
  validateSettingsState,
} from './settings-form.util';
import { buildSettingsApiResponse, MASKED_SECRET } from './data/settings.test-fixtures';

const SYNTHETIC_SOLANA_ADDRESS = '11111111111111111111111111111111';
import { getDefaultsSnapshot } from './settings-schema.util';

describe('settings-form.util', () => {
  const fb = new FormBuilder();

  describe('formToDirtyUpdatePayload', () => {
    it('sends only automationEnabled when that is the sole change', () => {
      const apiSnapshot = buildSettingsApiResponse();

      const form = buildSettingsForm(fb, apiSnapshot);
      form.get('strategy.cycleSchedule.automationEnabled')?.setValue(false);

      const payload = formToDirtyUpdatePayload(form, apiSnapshot);

      expect(payload.maxInvestmentUsd).toBeUndefined();
      expect(payload.strategy?.['targetTradesPerMinute']).toBeUndefined();
      expect(payload).toEqual({
        strategy: {
          cycleSchedule: {
            automationEnabled: false,
          },
        },
      });
    });

    it('diffs nested strategy.visibility fields without leaking unchanged siblings', () => {
      const apiSnapshot = buildSettingsApiResponse();
      const form = buildSettingsForm(fb, apiSnapshot);

      form.get('strategy.visibility.tradeDelayMsMax')?.setValue(200);

      const payload = formToDirtyUpdatePayload(form, apiSnapshot);

      expect(payload).toEqual({
        strategy: {
          visibility: {
            tradeDelayMsMax: 200,
          },
        },
      });
    });

    it('diffs strategy.distribution.telegramChatIds as string array', () => {
      const apiSnapshot = buildSettingsApiResponse();
      const form = buildSettingsForm(fb, apiSnapshot);

      form.get('strategy.distribution.telegramChatIds')?.setValue('-100111\n-100222');

      const payload = formToDirtyUpdatePayload(form, apiSnapshot);

      expect(payload).toEqual({
        strategy: {
          distribution: {
            telegramChatIds: ['-100111', '-100222'],
          },
        },
      });
    });

    it('diffs treasury.replenish when enabled toggles', () => {
      const apiSnapshot = buildSettingsApiResponse();
      const form = buildSettingsForm(fb, apiSnapshot);

      form.get('treasury.replenish.enabled')?.setValue(false);

      const payload = formToDirtyUpdatePayload(form, apiSnapshot);

      expect(payload).toEqual({
        treasury: {
          replenish: {
            enabled: false,
          },
        },
      });
    });

    it('strips masked secrets from PATCH payload', () => {
      const apiSnapshot = buildSettingsApiResponse();
      const form = buildSettingsForm(fb, apiSnapshot);

      form.get('integrations.openaiApiKey')?.setValue(MASKED_SECRET);
      form.get('telegram.botToken')?.setValue(MASKED_SECRET);
      form.get('proxy.url')?.setValue(MASKED_SECRET);

      const payload = formToDirtyUpdatePayload(form, apiSnapshot);

      expect(payload.integrations?.['openaiApiKey']).toBeUndefined();
      expect(payload.telegram?.['botToken']).toBeUndefined();
      expect(payload.proxy?.['url']).toBeUndefined();
    });

    it('includes newly entered secrets when they differ from masked placeholder', () => {
      const apiSnapshot = buildSettingsApiResponse();
      const form = buildSettingsForm(fb, apiSnapshot);

      form.get('integrations.openaiApiKey')?.setValue('sk-test-new-key');

      const payload = formToDirtyUpdatePayload(form, apiSnapshot);

      expect(payload.integrations?.['openaiApiKey']).toBe('sk-test-new-key');
    });

    it('diffs Owner Liquidity Auto-Lock fields under integrations.runtime.customLaunch (docs/ui-owner-liquidity-auto-lock.md §2.3)', () => {
      const apiSnapshot = buildSettingsApiResponse();
      const form = buildSettingsForm(fb, apiSnapshot);

      form.get('integrations.runtime.customLaunch.autoLockOwnerLiquidity')?.setValue(true);
      form.get('integrations.runtime.customLaunch.ownerLiquidityLockSolBuffer')?.setValue(1.5);

      const payload = formToDirtyUpdatePayload(form, apiSnapshot);

      expect(payload).toEqual({
        integrations: {
          runtime: {
            customLaunch: {
              autoLockOwnerLiquidity: true,
              ownerLiquidityLockSolBuffer: 1.5,
            },
          },
        },
      });
    });

    it('strips includeMainFeeWalletByDefault from treasury consolidate', () => {
      const apiSnapshot = buildSettingsApiResponse();
      const form = buildSettingsForm(fb, apiSnapshot);

      form.get('treasury.consolidate.includeMainFeeWalletByDefault')?.setValue(true);

      const payload = formToDirtyUpdatePayload(form, apiSnapshot);

      expect(payload.treasury?.['consolidate']).toBeUndefined();
    });

    it('sends maxTokenHoldPercent at API root when changed in strategy form', () => {
      const apiSnapshot = buildSettingsApiResponse();
      const form = buildSettingsForm(fb, apiSnapshot);

      form.get('strategy.maxTokenHoldPercent')?.setValue(12);

      const payload = formToDirtyUpdatePayload(form, apiSnapshot);

      expect(payload).toEqual({
        maxTokenHoldPercent: 12,
      });
    });

    it('preserves submitted hoisted strategy fields when PATCH response is partial', () => {
      const apiSnapshot = buildSettingsApiResponse();
      const form = buildSettingsForm(fb, apiSnapshot);

      form.get('strategy.maxTokenHoldPercent')?.setValue(12);
      form.get('strategy.minVolume5mUsd')?.setValue(9000);

      const submitted = formToNormalizedState(form);
      const partialResponse = { updatedAt: '2026-06-29T12:00:00.000Z' };
      const merged = mergeSettingsAfterSave(submitted, partialResponse);

      expect(merged['strategy']).toMatchObject({
        maxTokenHoldPercent: 12,
        minVolume5mUsd: 9000,
      });
      expect(merged['updatedAt']).toBe('2026-06-29T12:00:00.000Z');
    });

    it('preserves maxTokenHoldPercent when PATCH returns stale legacy root value', () => {
      const apiSnapshot = buildSettingsApiResponse();
      const form = buildSettingsForm(fb, apiSnapshot);

      form.get('strategy.maxTokenHoldPercent')?.setValue(12);

      const submitted = formToNormalizedState(form);
      const payload = formToDirtyUpdatePayload(form, apiSnapshot);
      const staleResponse = { maxTokenHoldPercent: 8, updatedAt: '2026-06-29T12:00:00.000Z' };
      const merged = mergeSettingsAfterSave(submitted, staleResponse, payload);

      expect((merged['strategy'] as Record<string, unknown>)['maxTokenHoldPercent']).toBe(12);
    });

    it('preserves withdrawalUsdtProfitAddress when PATCH echoes empty integrations', () => {
      const apiSnapshot = buildSettingsApiResponse();
      const form = buildSettingsForm(fb, apiSnapshot);
      const profitAddress = '0x1234567890123456789012345678901234567890';

      form.get('integrations.withdrawalUsdtProfitAddress')?.setValue(profitAddress);

      const submitted = formToNormalizedState(form);
      const payload = formToDirtyUpdatePayload(form, apiSnapshot);
      const staleResponse = {
        integrations: {
          withdrawalUsdtProfitAddress: '',
          nativeWithdrawalSolanaAddress: SYNTHETIC_SOLANA_ADDRESS,
        },
      };
      const merged = mergeSettingsAfterSave(submitted, staleResponse, payload);

      expect(merged['integrations']).toMatchObject({
        withdrawalUsdtProfitAddress: profitAddress,
      });
    });
  });

  describe('normalizeSettingsShape (via buildSettingsForm)', () => {
    it('hoists legacy root strategy keys under strategy', () => {
      const apiSnapshot = {
        minLiquidityRatio: 0.52,
        minVolume5mUsd: 7500,
        maxTokenHoldPercent: 8,
        trendStyleDefault: 'viral',
        strategy: {
          mode: 'BLITZ',
          trendFinder: {},
        },
      };

      const form = buildSettingsForm(fb, apiSnapshot);

      expect(form.get('strategy.minLiquidityRatio')?.value).toBe(0.52);
      expect(form.get('strategy.minVolume5mUsd')?.value).toBe(7500);
      expect(form.get('strategy.maxTokenHoldPercent')?.value).toBe(8);
      expect(form.get('strategy.trendFinder.style')?.value).toBe('viral');
      expect(form.get('minLiquidityRatio')).toBeNull();
    });

    it('prefers root maxTokenHoldPercent over stale strategy copy on load', () => {
      const apiSnapshot = {
        maxTokenHoldPercent: 25,
        strategy: {
          maxTokenHoldPercent: 30,
          mode: 'BLITZ',
        },
      };

      const form = buildSettingsForm(fb, apiSnapshot);

      expect(form.get('strategy.maxTokenHoldPercent')?.value).toBe(25);
    });

    it('preserves existing trendFinder.style over trendStyleDefault', () => {
      const apiSnapshot = {
        trendStyleDefault: 'viral',
        strategy: {
          trendFinder: { style: 'controversial' },
        },
      };

      const form = buildSettingsForm(fb, apiSnapshot);

      expect(form.get('strategy.trendFinder.style')?.value).toBe('controversial');
    });
  });

  describe('validateSettingsState', () => {
    it('requires Solana withdrawal address when consolidate is NATIVE and enabled', () => {
      const state = {
        treasury: {
          consolidate: {
            enabled: true,
            defaultConvertTo: 'NATIVE',
          },
        },
        integrations: {
          nativeWithdrawalSolanaAddress: '',
        },
      };

      expect(validateSettingsState(state)).toContain('Withdrawal Solana address');
    });

    it('passes when Solana withdrawal address is set', () => {
      const state = {
        treasury: {
          consolidate: {
            enabled: true,
            defaultConvertTo: 'NATIVE',
          },
        },
        integrations: {
          nativeWithdrawalSolanaAddress: '11111111111111111111111111111111',
        },
      };

      expect(validateSettingsState(state)).toBeNull();
    });

    it('skips validation when consolidate is disabled', () => {
      const state = {
        treasury: {
          consolidate: {
            enabled: false,
            defaultConvertTo: 'NATIVE',
          },
        },
        integrations: {},
      };

      expect(validateSettingsState(state)).toBeNull();
    });
  });

  describe('validateSettingsForm', () => {
    it('surfaces validation errors from live form state', () => {
      const apiSnapshot = buildSettingsApiResponse({
        integrations: {
          ...(buildSettingsApiResponse()['integrations'] as Record<string, unknown>),
          nativeWithdrawalSolanaAddress: '',
        },
      });
      const form = buildSettingsForm(fb, apiSnapshot);

      expect(validateSettingsForm(form)).toContain('Withdrawal Solana address');
    });
  });

  describe('defaults alignment', () => {
    it('builds a complete form from defaults snapshot without missing controls', () => {
      const defaults = getDefaultsSnapshot();
      const form = buildSettingsForm(fb, defaults);

      expect(form.get('cronExpression')?.value).toBe('*/15 * * * *');
      expect(form.get('networkPriority.SOLANA')?.value).toBe(true);
      expect(form.get('networkPriority.BSC')?.value).toBe(true);
      expect(form.get('strategy.mode')?.value).toBe('BLITZ');
      expect(form.get('strategy.visibility.minHoldBeforeSellSeconds')?.value).toBe(4);
      expect(form.get('strategy.profitExtract.postPeakGraceSec')?.value).toBe(90);
      expect(form.get('strategy.distribution.enabled')?.value).toBe(true);
      expect(form.get('strategy.distribution.telegramChatIds')?.value).toBe('-1004317150546');
      expect(form.get('strategy.distribution.webhookUrl')?.value).toContain('token-distribution');
      expect(form.get('strategy.botCascade.tradesPerMinuteMultiplier')?.value).toBe(1.6);
      expect(form.get('strategy.botCascade.buyBiasBoostPercent')?.value).toBe(6);
      expect(form.get('treasury.replenish.enabled')?.value).toBe(true);
      expect(form.get('treasury.replenish.profitUsdtSweepEnabled')?.value).toBe(true);
      expect(form.get('treasury.replenish.minProfitUsdtSweepUsd')?.value).toBe(10);
      expect(form.get('treasury.lifecycle.minRearmBalanceUsd')?.value).toBe(4500);
      expect(form.get('integrations.runtime.pumpFun.ipfsGatewayUrl')?.value).toBe('https://ipfs.io/ipfs');
      expect(form.get('integrations.withdrawalUsdtProfitAddress')?.value).toBe('');
      expect(form.get('integrations.runtime.customLaunch.autoLockOwnerLiquidity')?.value).toBe(false);
      expect(form.get('integrations.runtime.customLaunch.ownerLiquidityLockSolBuffer')?.value).toBe(1);
      expect(form.get('integrations.runtime.xTwitter.socialLookupTimeoutMs')?.value).toBe(20000);
    });

    it('round-trips unchanged defaults to empty dirty payload', () => {
      const defaults = normalizeSettingsShape(getDefaultsSnapshot());
      const form = buildSettingsForm(fb, defaults);

      const payload = formToDirtyUpdatePayload(form, defaults);

      expect(payload).toEqual({});
    });

    it('full save payload includes all top-level PATCH keys when form is populated from defaults', () => {
      const defaults = getDefaultsSnapshot();
      const form = buildSettingsForm(fb, defaults);

      const payload = formToUpdatePayload(form);

      expect(payload.cronExpression).toBe('*/15 * * * *');
      expect(payload.strategy).toBeDefined();
      expect(payload.integrations).toBeDefined();
      expect(payload.treasury).toBeDefined();
      expect(payload.telegram).toBeDefined();
      expect(payload.proxy).toBeDefined();
    });
  });
});
