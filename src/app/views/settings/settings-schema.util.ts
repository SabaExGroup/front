import defaults from './data/settings.defaults.json';
import { SettingsFieldConfig, SettingsSectionConfig } from './settings-field-config';

/** UI schema only — field discovery and labels. Never used as runtime setting values. */
const SETTINGS_UI_SCHEMA = defaults as Record<string, unknown>;

const SPECIAL_KEYS = new Set([
  'peakWindows',
  'fundingPairs',
  'networkPriority',
  'chatIds',
  'telegramChatIds',
  'social',
  'blockedHoursUtc',
  'allowedDestinationAddresses',
  'networks',
  'tokenLabels',
  'providerPriority',
  'profileProviderBaseUrls',
  /** Shown on General tab as the main system on/off switch */
  'automationEnabled',
  /** docs §۶ — backend does not implement includeMainFeeWallet */
  'includeMainFeeWalletByDefault',
]);

const SECTION_TITLES: Record<string, string> = {
  strategy: 'Blitz & Ignition',
  'strategy.visibility': 'Visibility & Bot Magnet',
  'strategy.profitExtract': 'Profit Extract',
  'strategy.weights': 'Optimizer Weights',
  'strategy.cycleSchedule': 'Cycle Schedule',
  'strategy.trendFinder': 'Trend Finder',
  'strategy.trendFinder.social': 'Social Links (pools)',
  'strategy.emergencyBrake': 'Emergency Brake',
  'strategy.distribution': 'Token Distribution',
  'strategy.botCascade': 'Bot Cascade',
  'strategy.organicTimeline': 'Organic Timeline',
  'integrations.runtime.customLaunch': 'Manual Launchpad (Custom Raydium)',
  'integrations.runtime.gmgn': 'GMGN Runtime',
  'integrations.runtime.changeNow': 'ChangeNOW Runtime',
  'integrations.runtime.pumpFun': 'Pump.fun Runtime',
  'integrations.runtime.fourMeme': 'FourMeme Runtime',
  'integrations.runtime.letsBonk': 'LetsBonk Runtime',
  'integrations.runtime.openai': 'OpenAI Runtime',
  'integrations.runtime.http': 'HTTP Defaults',
  'integrations.runtime.solanaRpc': 'Solana RPC Runtime',
  'integrations.runtime.bscRpc': 'BSC RPC Runtime',
  'integrations.runtime.ethereumRpc': 'Ethereum RPC Runtime',
  'integrations.runtime.trade': 'Trade Runtime',
  'integrations.runtime.dexScreener': 'DexScreener Runtime',
  'integrations.runtime.jupiter': 'Jupiter Runtime',
  'integrations.runtime.xTwitter': 'X / FxTwitter Runtime',
  'integrations.runtime.explorer': 'Explorer Runtime',
  'treasury.replenish': 'Replenish',
};

const ENUM_FIELDS: Record<string, { value: string; label: string }[]> = {
  marketWalletUsageMode: [
    { value: 'SINGLE_USE', label: 'Single use' },
    { value: 'MULTI_USE', label: 'Multi use' },
  ],
  trendStyleDefault: [
    { value: 'controversial', label: 'Controversial' },
    { value: 'viral', label: 'Viral' },
    { value: 'meme', label: 'Meme' },
  ],
  mode: [{ value: 'BLITZ', label: 'BLITZ' }],
  style: [
    { value: 'controversial', label: 'Controversial' },
    { value: 'viral', label: 'Viral' },
    { value: 'meme', label: 'Meme' },
  ],
  defaultConvertTo: [
    { value: 'NATIVE', label: 'NATIVE' },
    { value: 'USDC', label: 'USDC' },
  ],
  defaultDrainConvertTo: [
    { value: 'USDC', label: 'USDC' },
    { value: 'NATIVE', label: 'NATIVE' },
  ],
  defaultWalletPoolStrategy: [
    { value: 'AUTO', label: 'AUTO' },
    { value: 'FRESH', label: 'FRESH' },
    { value: 'REUSE', label: 'REUSE' },
  ],
  defaultSourceAsset: [
    { value: 'USDC', label: 'USDC' },
    { value: 'ETH', label: 'ETH' },
  ],
  convertTo: [
    { value: 'NATIVE', label: 'NATIVE' },
    { value: 'USDC', label: 'USDC' },
  ],
  sellMode: [
    { value: 'TWAP', label: 'TWAP (staggered sells)' },
    { value: 'DUMP', label: 'DUMP (instant parallel sell-off)' },
  ],
  defaultLaunchpad: [
    { value: 'CUSTOM_RAYDIUM', label: 'Custom Raydium (system default)' },
    { value: 'PUMP_FUN', label: 'Pump.fun' },
    { value: 'LETS_BONK', label: 'letsbonk' },
    { value: 'FOUR_MEME', label: 'Four.meme' },
    { value: 'AUTO', label: 'Auto (GMGN score-based)' },
  ],
};

const FIELD_HINTS: Record<string, string> = {
  'strategy.profitExtract.sellInRed': 'Never enable in production',
  'strategy.tokenOwnerReuseEnabled': 'Reuse TOKEN_OWNER wallet across cycles instead of generating a fresh one each time',
  'strategy.defaultLaunchpad': 'Launchpad used for cycles without forceLaunchpad (incl. cron). System default is CUSTOM_RAYDIUM — set to AUTO to restore legacy GMGN score-based auto-selection',
  'strategy.liquidityWalletFundingSol': 'Most important CUSTOM_RAYDIUM field — must cover pool seed + rent + protocol fee + emergency gas buffer. Must stay above integrations.runtime.customLaunch.initialLiquiditySol',
  'strategy.liquidityWalletReuseEnabled': 'LIQUIDITY wallets are never pooled/reused per-cycle today — reserved for future use',
  'integrations.runtime.customLaunch.totalSupply': 'Raw base units decimal string, e.g. "1000000000000000". Human supply = totalSupply / 10^decimals. Only affects future launches',
  'integrations.runtime.customLaunch.decimals': 'Only affects future launches — already-launched tokens keep their own token.decimals',
  'integrations.runtime.customLaunch.initialLiquiditySol': 'SOL seeded into the Raydium pool at launch — must stay below strategy.liquidityWalletFundingSol',
  'integrations.runtime.customLaunch.initialLiquidityTokenPercent': '% of total supply that enters the pool (1-100) — remainder goes to TOKEN_OWNER (dev buy / distribution)',
  'integrations.runtime.customLaunch.devBuySol': 'Initial TOKEN_OWNER buy right after launch (best-effort) — 0 disables dev buy',
  'strategy.emergencyBrake.sellConcurrency': 'Max parallel sell txs during TWAP brake',
  'strategy.emergencyBrake.sellStaggerMsMin': 'Min delay between sell batches (ms)',
  'strategy.emergencyBrake.sellStaggerMsMax': 'Max delay between sell batches (ms)',
  'strategy.emergencyBrake.sellOwnerLast': 'Sell TOKEN_OWNER wallet after market wallets',
  'strategy.distribution.telegramChatIds': 'Distribution channels — separate from alert chat IDs',
  'strategy.distribution.webhookUrl': 'n8n webhook for token distribution posts',
  'strategy.distribution.postOnBotMagnet': 'Post when bot magnet visibility threshold is reached',
  'strategy.distribution.launchDelaySeconds': 'Delay before posting after token launch',
  'strategy.botCascade.tradesPerMinuteMultiplier': 'Multiplier applied to targetTradesPerMinute during cascade',
  'strategy.botCascade.buyBiasBoostPercent': 'Extra buy bias % while cascade is active',
  'strategy.botCascade.pauseSellsSeconds': 'Pause market sells for this many seconds at cascade start',
  'integrations.runtime.xTwitter.profileProviderBaseUrls': 'FxTwitter then VxTwitter fallback — one URL per line (DevOps)',
  'integrations.mainFeeWalletEvmPrivateKey': 'Must match GET /main-fee-wallet fundingAddress',
  'integrations.runtime.trade.providerPriority': 'gmgn, dexscreener, changenow',
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getNodeAtPath(path: string): unknown {
  let node: unknown = SETTINGS_UI_SCHEMA;
  for (const seg of path.split('.')) {
    if (!isPlainObject(node)) return undefined;
    node = node[seg];
  }
  return node;
}

function humanize(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\bUsd\b/g, 'USD')
    .replace(/\bBps\b/g, 'BPS')
    .replace(/\bRpc\b/g, 'RPC')
    .replace(/\bBnb\b/g, 'BNB')
    .replace(/\bSol\b/g, 'SOL')
    .replace(/\bEth\b/g, 'ETH')
    .replace(/^./, (c) => c.toUpperCase());
}

function inferFieldType(fullPath: string, value: unknown): SettingsFieldConfig['type'] {
  const key = fullPath.split('.').pop() ?? fullPath;
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (ENUM_FIELDS[key]) return 'select';
  if (/cron/i.test(fullPath)) return 'cron';
  if (typeof value === 'string' && (value.length > 80 || fullPath.includes('Base64'))) return 'textarea';
  return 'text';
}

function buildFieldsForObject(obj: Record<string, unknown>, basePath: string): SettingsFieldConfig[] {
  const fields: SettingsFieldConfig[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (SPECIAL_KEYS.has(key)) continue;
    if (isPlainObject(value)) continue;

    const fullPath = basePath ? `${basePath}.${key}` : key;
    const enumOptions = ENUM_FIELDS[key];
    const type = enumOptions ? 'select' : inferFieldType(fullPath, value);

    const field: SettingsFieldConfig = {
      key,
      label: humanize(key),
      type,
      col: type === 'boolean' ? 4 : type === 'number' ? 4 : 6,
      options: enumOptions,
      hint: FIELD_HINTS[fullPath],
    };

    if (type === 'number') {
      if (key.includes('Percent') || key.includes('Ratio') || key.startsWith('w_')) {
        field.step = key.includes('Ratio') || key.startsWith('w_') ? 0.01 : 0.1;
      }
      if (key === 'securityMinScore' || key.includes('Percent')) {
        field.min = 0;
        if (key === 'securityMinScore') field.max = 100;
      }
      if (key === 'marketWalletCount') {
        field.min = 50;
        field.max = 300;
      }
    }

    fields.push(field);
  }

  return fields;
}

function isNestedObjectMap(obj: Record<string, unknown>): boolean {
  return Object.values(obj).every((v) => isPlainObject(v));
}

export function generateSectionsFromPath(basePath: string): SettingsSectionConfig[] {
  const node = getNodeAtPath(basePath);
  if (!isPlainObject(node)) return [];

  const sections: SettingsSectionConfig[] = [];
  const directFields = buildFieldsForObject(node, basePath);

  if (directFields.length > 0) {
    const segment = basePath.split('.').pop() ?? basePath;
    sections.push({
      id: basePath.replace(/\./g, '-'),
      title: SECTION_TITLES[basePath] ?? humanize(segment),
      path: basePath,
      fields: directFields,
    });
  }

  for (const [key, value] of Object.entries(node)) {
    if (SPECIAL_KEYS.has(key)) continue;
    if (!isPlainObject(value)) continue;
    if (isNestedObjectMap(value)) continue;
    sections.push(...generateSectionsFromPath(`${basePath}.${key}`));
  }

  return sections;
}

export function generateStrategySections(): SettingsSectionConfig[] {
  return generateSectionsFromPath('strategy');
}

export function generateRuntimeSections(): SettingsSectionConfig[] {
  return generateSectionsFromPath('integrations.runtime');
}

export function generateTreasurySections(): SettingsSectionConfig[] {
  return generateSectionsFromPath('treasury');
}

export function getDefaultsSnapshot(): Record<string, unknown> {
  return structuredClone(SETTINGS_UI_SCHEMA);
}
