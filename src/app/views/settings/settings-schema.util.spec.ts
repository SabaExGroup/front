import {
  generateRuntimeSections,
  generateStrategySections,
  generateTreasurySections,
  getDefaultsSnapshot,
} from './settings-schema.util';

function sectionFieldKeys(sections: { path: string; fields: { key: string }[] }[]): string[] {
  return sections.flatMap((section) =>
    section.fields.map((field) => `${section.path}.${field.key}`)
  );
}

describe('settings-schema.util', () => {
  describe('generateStrategySections', () => {
    it('exposes BLITZ, visibility, profitExtract, weights, cycleSchedule, and trendFinder fields', () => {
      const sections = generateStrategySections();
      const keys = sectionFieldKeys(sections);

      expect(keys).toContain('strategy.mode');
      expect(keys).toContain('strategy.tokenOwnerReuseEnabled');
      expect(keys).toContain('strategy.targetTradesPerMinute');
      expect(keys).toContain('strategy.visibility.minHoldBeforeSellSeconds');
      expect(keys).toContain('strategy.visibility.walletFundingStaggerMsMax');
      expect(keys).toContain('strategy.profitExtract.postPeakForceExtract');
      expect(keys).toContain('strategy.profitExtract.minExtractUsd');
      expect(keys).toContain('strategy.weights.w_marketCap');
      expect(keys).toContain('strategy.cycleSchedule.schedulerTickCron');
      expect(keys).toContain('strategy.trendFinder.style');
      expect(keys).toContain('strategy.emergencyBrake.sellMode');
      expect(keys).toContain('strategy.emergencyBrake.sellConcurrency');
      expect(keys).toContain('strategy.emergencyBrake.sellOwnerLast');
      expect(keys).toContain('strategy.distribution.enabled');
      expect(keys).toContain('strategy.distribution.postOnLaunch');
      expect(keys).toContain('strategy.distribution.webhookUrl');
      expect(keys).toContain('strategy.botCascade.tradesPerMinuteMultiplier');
      expect(keys).toContain('strategy.botCascade.pauseSellsSeconds');
    });

    it('uses human-readable section titles for nested strategy groups', () => {
      const sections = generateStrategySections();
      const titles = sections.map((section) => section.title);

      expect(titles).toContain('Visibility & Bot Magnet');
      expect(titles).toContain('Profit Extract');
      expect(titles).toContain('Optimizer Weights');
      expect(titles).toContain('Cycle Schedule');
      expect(titles).toContain('Trend Finder');
      expect(titles).toContain('Emergency Brake');
      expect(titles).toContain('Token Distribution');
      expect(titles).toContain('Bot Cascade');
    });
  });

  describe('generateRuntimeSections', () => {
    it('includes jupiter and pumpFun ipfsGatewayUrl runtime fields', () => {
      const sections = generateRuntimeSections();
      const keys = sectionFieldKeys(sections);

      expect(keys).toContain('integrations.runtime.jupiter.slippageBps');
      expect(keys).toContain('integrations.runtime.pumpFun.ipfsGatewayUrl');
      expect(keys).toContain('integrations.runtime.changeNow.pollTimeoutMs');
    });

    it('labels jupiter runtime section explicitly', () => {
      const sections = generateRuntimeSections();
      const jupiter = sections.find((section) => section.path === 'integrations.runtime.jupiter');

      expect(jupiter?.title).toBe('Jupiter Runtime');
    });

    it('exposes Owner Liquidity Auto-Lock fields on the customLaunch section (docs/ui-owner-liquidity-auto-lock.md §2)', () => {
      const sections = generateRuntimeSections();
      const keys = sectionFieldKeys(sections);

      expect(keys).toContain('integrations.runtime.customLaunch.autoLockOwnerLiquidity');
      expect(keys).toContain('integrations.runtime.customLaunch.ownerLiquidityLockSolBuffer');

      const customLaunch = sections.find((section) => section.path === 'integrations.runtime.customLaunch');
      const buffer = customLaunch?.fields.find((f) => f.key === 'ownerLiquidityLockSolBuffer');
      expect(buffer?.type).toBe('number');
      expect(buffer?.min).toBe(0);
    });

    it('exposes xTwitter socialLookupTimeoutMs (docs/ui-trend-social-links.md §2)', () => {
      const sections = generateRuntimeSections();
      const keys = sectionFieldKeys(sections);

      expect(keys).toContain('integrations.runtime.xTwitter.socialLookupTimeoutMs');
    });
  });

  describe('generateTreasurySections', () => {
    it('covers consolidate, replenish, lifecycle, and autoDrain', () => {
      const sections = generateTreasurySections();
      const keys = sectionFieldKeys(sections);

      expect(keys).toContain('treasury.consolidate.defaultConvertTo');
      expect(keys).toContain('treasury.replenish.minWithdrawalUsd');
      expect(keys).toContain('treasury.replenish.pollTimeoutMs');
      expect(keys).toContain('treasury.replenish.profitUsdtSweepEnabled');
      expect(keys).toContain('treasury.replenish.minProfitUsdtSweepUsd');
      expect(keys).toContain('treasury.lifecycle.minRearmBalanceUsd');
      expect(keys).toContain('treasury.lifecycle.autoDrain.fallbackCron');
    });

    it('includes replenish section title', () => {
      const sections = generateTreasurySections();
      const titles = sections.map((section) => section.title);

      expect(titles).toContain('Replenish');
    });
  });

  describe('getDefaultsSnapshot', () => {
    it('reflects updated BLITZ tuning values without secrets', () => {
      const defaults = getDefaultsSnapshot();

      expect(defaults['maxInvestmentUsd']).toBe(11000);
      expect(defaults['marketWalletCount']).toBe(120);
      expect(defaults['securityMinScore']).toBe(10);
      expect((defaults['networkPriority'] as string[])).toEqual(['SOLANA', 'BSC']);

      const strategy = defaults['strategy'] as Record<string, unknown>;
      expect(strategy['targetTradesPerMinute']).toBe(420);
      expect(strategy['buyBiasPercent']).toBe(66);

      const distribution = strategy['distribution'] as Record<string, unknown>;
      expect(distribution['enabled']).toBe(true);
      expect(distribution['telegramChatIds']).toEqual(['-1004317150546']);
      expect(distribution['launchDelaySeconds']).toBe(8);

      const botCascade = strategy['botCascade'] as Record<string, unknown>;
      expect(botCascade['enabled']).toBe(true);
      expect(botCascade['tradesPerMinuteMultiplier']).toBe(1.6);

      const integrations = defaults['integrations'] as Record<string, unknown>;
      expect(integrations['openaiApiKey']).toBe('');
      expect(integrations['gmgnApiKey']).toBe('');

      const treasury = defaults['treasury'] as Record<string, unknown>;
      const replenish = treasury['replenish'] as Record<string, unknown>;
      expect(replenish['enabled']).toBe(true);
      expect(replenish['convertTo']).toBe('USDC');
      expect(replenish['profitUsdtSweepEnabled']).toBe(true);
      expect(replenish['minProfitUsdtSweepUsd']).toBe(10);
    });
  });
});
