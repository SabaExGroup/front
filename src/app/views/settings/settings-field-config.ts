export type SettingsFieldType = 'text' | 'text' | 'number' | 'boolean' | 'select' | 'textarea' | 'cron';

export interface SettingsFieldConfig {
  key: string;
  label: string;
  type: SettingsFieldType;
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  col?: 3 | 4 | 6 | 12;
}

export interface SettingsSectionConfig {
  id: string;
  title: string;
  description?: string;
  path: string;
  fields: SettingsFieldConfig[];
}

export const SETTINGS_TABS = [
  { id: 'general', label: 'General', icon: 'cilSettings' },
  { id: 'strategy', label: 'Strategy', icon: 'cilChart' },
  { id: 'integrations', label: 'Integrations', icon: 'cilPuzzle' },
  { id: 'treasury', label: 'Treasury', icon: 'cilDollar' },
  { id: 'notifications', label: 'Telegram & Proxy', icon: 'cilBell' },
] as const;

export type SettingsTabId = (typeof SETTINGS_TABS)[number]['id'];

export const GENERAL_FIELDS: SettingsFieldConfig[] = [
  { key: 'cronExpression', label: 'Cron expression', type: 'cron', col: 6, hint: 'Cycle scheduler cron, e.g. */15 * * * *' },
  { key: 'maxInvestmentUsd', label: 'Max investment (USD)', type: 'number', min: 0, col: 6 },
  { key: 'minTradeAmountUsd', label: 'Min trade amount (USD)', type: 'number', min: 0, col: 4 },
  { key: 'minMarketCapUsd', label: 'Min market cap (USD)', type: 'number', min: 0, col: 4 },
  { key: 'minLiquidityUsd', label: 'Min liquidity (USD)', type: 'number', min: 0, col: 4 },
  { key: 'marketWalletCount', label: 'Market wallet count', type: 'number', min: 50, max: 300, col: 4 },
  {
    key: 'marketWalletUsageMode',
    label: 'Wallet usage mode',
    type: 'select',
    col: 6,
    options: [
      { value: 'SINGLE_USE', label: 'Single use (fresh each cycle)' },
      { value: 'MULTI_USE', label: 'Multi use (reuse pool)' },
    ],
  },
  { key: 'securityMinScore', label: 'Security min score', type: 'number', min: 0, max: 100, col: 6 },
  { key: 'openaiModel', label: 'OpenAI model', type: 'text', col: 6 },
];

export const STRATEGY_SECTIONS: SettingsSectionConfig[] = [
  {
    id: 'blitz',
    title: 'Blitz & Ignition',
    path: 'strategy',
    fields: [
      { key: 'ownerLaunchFundingUsd', label: 'Owner launch funding (USD)', type: 'number', min: 0, col: 4 },
      { key: 'tokenOwnerReuseEnabled', label: 'Token owner reuse', type: 'boolean', col: 4, hint: 'Reuse TOKEN_OWNER wallet across cycles' },
      { key: 'mode', label: 'Mode', type: 'select', col: 4, options: [{ value: 'BLITZ', label: 'BLITZ' }] },
      { key: 'targetPriceChangePercent', label: 'Target price change %', type: 'number', col: 4 },
      { key: 'targetPriceChangePercentMin', label: 'Min target price change %', type: 'number', col: 4 },
      { key: 'maxIgnitionDurationSeconds', label: 'Max ignition (sec)', type: 'number', col: 4 },
      { key: 'targetTradesPerMinute', label: 'Target trades/min', type: 'number', col: 4 },
      { key: 'ignitionDurationMinutes', label: 'Ignition duration (min)', type: 'number', step: 0.1, col: 4 },
      { key: 'buyBiasPercent', label: 'Buy bias %', type: 'number', min: 0, max: 100, col: 4 },
      { key: 'jitoBundleAtLaunch', label: 'Jito bundle at launch', type: 'boolean', col: 4 },
      { key: 'preFundWallets', label: 'Pre-fund wallets', type: 'boolean', col: 4 },
    ],
  },
  {
    id: 'visibility',
    title: 'Visibility & Bot Magnet',
    path: 'strategy.visibility',
    fields: [
      { key: 'enabled', label: 'Enabled', type: 'boolean', col: 4 },
      { key: 'minUniqueWallets5m', label: 'Min unique wallets (5m)', type: 'number', col: 4 },
      { key: 'minTxCount5m', label: 'Min tx count (5m)', type: 'number', col: 4 },
      { key: 'minHolderCount', label: 'Min holder count', type: 'number', col: 4 },
      { key: 'minBuySellRatio', label: 'Min buy/sell ratio', type: 'number', step: 0.1, col: 4 },
      { key: 'dexScreenerPollSeconds', label: 'DexScreener poll (sec)', type: 'number', col: 4 },
      { key: 'gmgnPollSeconds', label: 'GMGN poll (sec)', type: 'number', col: 4 },
      { key: 'antiWashEnabled', label: 'Anti-wash enabled', type: 'boolean', col: 4 },
      { key: 'tradeAmountJitterPercent', label: 'Trade amount jitter %', type: 'number', col: 4 },
      { key: 'tradeDelayMsMin', label: 'Trade delay min (ms)', type: 'number', col: 4 },
      { key: 'tradeDelayMsMax', label: 'Trade delay max (ms)', type: 'number', col: 4 },
      { key: 'maxTradesPerWallet', label: 'Max trades per wallet', type: 'number', col: 4 },
      { key: 'walletCooldownSeconds', label: 'Wallet cooldown (sec)', type: 'number', col: 4 },
    ],
  },
  {
    id: 'profit',
    title: 'Profit Extract',
    path: 'strategy.profitExtract',
    fields: [
      { key: 'enabled', label: 'Enabled', type: 'boolean', col: 4 },
      { key: 'marketProfitTaking', label: 'Market profit taking', type: 'boolean', col: 4 },
      { key: 'minMarketHoldPercent', label: 'Min market hold %', type: 'number', col: 4 },
      { key: 'sellBatchRatio', label: 'Sell batch ratio', type: 'number', step: 0.01, col: 4 },
      { key: 'maxSellBatchPercent', label: 'Max sell batch %', type: 'number', step: 0.1, col: 4 },
      { key: 'sellBatchIntervalMinSec', label: 'Batch interval min (sec)', type: 'number', col: 4 },
      { key: 'sellBatchIntervalMaxSec', label: 'Batch interval max (sec)', type: 'number', col: 4 },
      { key: 'sellInRed', label: 'Sell in red (dangerous)', type: 'boolean', col: 4, hint: 'Never enable in production' },
      { key: 'slippageBps', label: 'Slippage (bps)', type: 'number', col: 4 },
      { key: 'sweepNativeToWithdrawal', label: 'Sweep native to withdrawal', type: 'boolean', col: 4 },
    ],
  },
  {
    id: 'weights',
    title: 'Optimizer Weights',
    path: 'strategy.weights',
    fields: [
      { key: 'w_marketCap', label: 'Weight: market cap', type: 'number', step: 0.01, col: 3 },
      { key: 'w_volume', label: 'Weight: volume', type: 'number', step: 0.01, col: 3 },
      { key: 'w_liquidity', label: 'Weight: liquidity', type: 'number', step: 0.01, col: 3 },
      { key: 'w_organic', label: 'Weight: organic', type: 'number', step: 0.01, col: 3 },
    ],
  },
  {
    id: 'schedule',
    title: 'Cycle Schedule',
    path: 'strategy.cycleSchedule',
    fields: [
      { key: 'enabled', label: 'Scheduler enabled', type: 'boolean', col: 4 },
      { key: 'schedulerTickCron', label: 'Scheduler tick cron', type: 'cron', col: 4 },
      { key: 'peakOnly', label: 'Peak hours only', type: 'boolean', col: 4 },
      { key: 'skipLowLiquidityHours', label: 'Skip low-liquidity hours', type: 'boolean', col: 4 },
      { key: 'minMinutesBetweenCycles', label: 'Min minutes between cycles', type: 'number', col: 4 },
      { key: 'maxCyclesPerDay', label: 'Max cycles per day', type: 'number', col: 4 },
    ],
  },
  {
    id: 'trend',
    title: 'Trend Finder',
    path: 'strategy.trendFinder',
    fields: [
      { key: 'symbolLookbackDays', label: 'Symbol lookback (days)', type: 'number', col: 4 },
      { key: 'logoMaxAttempts', label: 'Logo max attempts', type: 'number', col: 4 },
      { key: 'maxIdentityRegenerations', label: 'Max identity regenerations', type: 'number', col: 4 },
      { key: 'style', label: 'Style', type: 'select', col: 4, options: [
        { value: 'controversial', label: 'Controversial' },
        { value: 'viral', label: 'Viral' },
        { value: 'meme', label: 'Meme' },
      ]},
    ],
  },
  {
    id: 'distribution',
    title: 'Token Distribution',
    path: 'strategy.distribution',
    fields: [
      { key: 'enabled', label: 'Enabled', type: 'boolean', col: 4 },
      { key: 'postOnLaunch', label: 'Post on launch', type: 'boolean', col: 4 },
      { key: 'postOnBotMagnet', label: 'Post on bot magnet', type: 'boolean', col: 4 },
      { key: 'launchDelaySeconds', label: 'Launch delay (sec)', type: 'number', min: 0, col: 4 },
      { key: 'includeChartLinks', label: 'Include chart links', type: 'boolean', col: 4 },
      { key: 'webhookUrl', label: 'Webhook URL', type: 'text', col: 12, hint: 'n8n webhook for token distribution posts' },
    ],
  },
  {
    id: 'bot-cascade',
    title: 'Bot Cascade',
    path: 'strategy.botCascade',
    fields: [
      { key: 'enabled', label: 'Enabled', type: 'boolean', col: 4 },
      { key: 'tradesPerMinuteMultiplier', label: 'Trades/min multiplier', type: 'number', step: 0.1, min: 0, col: 4 },
      { key: 'buyBiasBoostPercent', label: 'Buy bias boost %', type: 'number', min: 0, max: 100, col: 4 },
      { key: 'pauseSellsSeconds', label: 'Pause sells (sec)', type: 'number', min: 0, col: 4 },
    ],
  },
];

export const INTEGRATION_WITHDRAWAL_FIELDS: SettingsFieldConfig[] = [
  {
    key: 'nativeWithdrawalSolanaAddress',
    label: 'Withdrawal Solana address',
    type: 'text',
    col: 6,
    hint: 'Profit sweep destination on Solana',
  },
  {
    key: 'nativeWithdrawalBscAddress',
    label: 'Withdrawal BSC address',
    type: 'text',
    col: 6,
    hint: 'Profit sweep destination on BSC',
  },
  {
    key: 'withdrawalUsdtProfitAddress',
    label: 'Withdrawal USDT profit address',
    type: 'text',
    col: 6,
    hint: 'USDT/USDC profit sweep destination (EVM)',
  },
  {
    key: 'nativeWithdrawalSolanaPrivateKey',
    label: 'Withdrawal Solana private key',
    type: 'text',
    col: 6,
    hint: 'Required for convertTo USDC on Solana withdrawal wallet',
  },
  {
    key: 'nativeWithdrawalBscPrivateKey',
    label: 'Withdrawal BSC private key',
    type: 'text',
    col: 6,
    hint: 'Required for convertTo USDC on BSC',
  },
];

export const INTEGRATION_JUPITER_FIELDS: SettingsFieldConfig[] = [
  {
    key: 'jupiterApiKey',
    label: 'Jupiter API Key',
    type: 'text',
    col: 12,
    hint: 'Required for convertTo USDC on Solana withdrawal wallet',
  },
];

export const INTEGRATION_KEY_FIELDS: SettingsFieldConfig[] = [
  { key: 'openaiApiKey', label: 'OpenAI API Key', type: 'text', col: 6 },
  { key: 'gmgnApiKey', label: 'GMGN API Key', type: 'text', col: 6 },
  { key: 'gmgnPrivateKey', label: 'GMGN Private Key', type: 'text', col: 6 },
  { key: 'changeNowApiKey', label: 'ChangeNOW API Key', type: 'text', col: 6 },
  {
    key: 'mainFeeWalletEvmPrivateKey',
    label: 'Main Fee Wallet EVM Private Key',
    type: 'text',
    col: 12,
    hint: 'Must match GET /main-fee-wallet fundingAddress',
  },
  { key: 'pumpPortalApiKey', label: 'PumpPortal API Key', type: 'text', col: 6 },
  { key: 'pumpFunJwtToken', label: 'Pump.fun JWT Token', type: 'text', col: 6 },
  { key: 'pinataApiKey', label: 'Pinata API Key', type: 'text', col: 4 },
  { key: 'pinataApiSecret', label: 'Pinata API Secret', type: 'text', col: 4 },
  { key: 'pinataJwt', label: 'Pinata JWT', type: 'text', col: 4 },
  { key: 'etherscanApiKey', label: 'Etherscan API Key', type: 'text', col: 6 },
  { key: 'solanaScanApiKey', label: 'Solscan API Key', type: 'text', col: 6 },
  {
    key: 'xBearerToken',
    label: 'X API Bearer Token (optional)',
    type: 'text',
    col: 12,
    hint: 'Fallback only when FxTwitter auto-search finds no account',
  },
];

export const INTEGRATION_RPC_FIELDS: SettingsFieldConfig[] = [
  { key: 'ethereumRpcUrl', label: 'Ethereum RPC URL', type: 'text', col: 12 },
  { key: 'solanaRpcUrl', label: 'Solana RPC URL', type: 'text', col: 12 },
  { key: 'solanaRpcWsUrl', label: 'Solana RPC WebSocket URL', type: 'text', col: 12 },
  { key: 'evmRpcUrl', label: 'BSC / EVM RPC URL', type: 'text', col: 12 },
];

export const INTEGRATION_ENDPOINT_FIELDS: SettingsFieldConfig[] = [
  { key: 'gmgnBaseUrl', label: 'GMGN base URL', type: 'text', col: 6 },
  { key: 'changeNowBaseUrlV1', label: 'ChangeNOW v1 URL', type: 'text', col: 6 },
  { key: 'changeNowBaseUrlV2', label: 'ChangeNOW v2 URL', type: 'text', col: 6 },
  { key: 'pumpFunApiV3Url', label: 'Pump.fun API v3 URL', type: 'text', col: 6 },
  { key: 'pumpPortalApiUrl', label: 'PumpPortal API URL', type: 'text', col: 6 },
  { key: 'fourMemeApiUrl', label: 'FourMeme API URL', type: 'text', col: 6 },
  { key: 'openaiBaseUrl', label: 'OpenAI base URL', type: 'text', col: 6 },
  { key: 'dexScreenerBaseUrl', label: 'DexScreener base URL', type: 'text', col: 6 },
  { key: 'dexScreenerBoostsUrl', label: 'DexScreener boosts URL', type: 'text', col: 6 },
  { key: 'etherscanBaseUrl', label: 'Etherscan base URL', type: 'text', col: 6 },
  { key: 'solanaScanBaseUrl', label: 'Solscan base URL', type: 'text', col: 6 },
  { key: 'jupiterQuoteApiUrl', label: 'Jupiter quote API URL', type: 'text', col: 6 },
  { key: 'fxTwitterBaseUrl', label: 'FxTwitter base URL', type: 'text', col: 6 },
  { key: 'xApiBaseUrl', label: 'X API base URL', type: 'text', col: 6 },
];

export const RUNTIME_SECTIONS: SettingsSectionConfig[] = [
  {
    id: 'changenow',
    title: 'ChangeNOW Runtime',
    path: 'integrations.runtime.changeNow',
    fields: [
      { key: 'pollIntervalMs', label: 'Poll interval (ms)', type: 'number', col: 4 },
      { key: 'pollTimeoutMs', label: 'Poll timeout (ms)', type: 'number', col: 4 },
      { key: 'fundingConcurrency', label: 'Funding concurrency', type: 'number', col: 4 },
      { key: 'fundingAmountBuffer', label: 'Funding amount buffer', type: 'number', step: 0.01, col: 4 },
      { key: 'fundingReceivedTolerance', label: 'Funding received tolerance', type: 'number', step: 0.001, col: 4 },
      { key: 'fundingSettlePollIntervalMs', label: 'Funding settle poll (ms)', type: 'number', col: 4 },
      { key: 'exchangeRetryAttempts', label: 'Exchange retry attempts', type: 'number', col: 4 },
      { key: 'depositRetryAttempts', label: 'Deposit retry attempts', type: 'number', col: 4 },
      { key: 'usdcEthereumContract', label: 'USDC Ethereum contract', type: 'text', col: 6 },
      { key: 'httpTimeoutMs', label: 'HTTP timeout (ms)', type: 'number', col: 4 },
      { key: 'httpRetries', label: 'HTTP retries', type: 'number', col: 4 },
    ],
  },
  {
    id: 'pumpfun',
    title: 'Pump.fun Runtime',
    path: 'integrations.runtime.pumpFun',
    fields: [
      { key: 'slippagePercent', label: 'Slippage %', type: 'number', col: 4 },
      { key: 'emergencySlippagePercent', label: 'Emergency slippage %', type: 'number', col: 4 },
      { key: 'priorityFeeSol', label: 'Priority fee (SOL)', type: 'number', step: 0.0001, col: 4 },
      { key: 'emergencyPriorityFeeSol', label: 'Emergency priority fee (SOL)', type: 'number', step: 0.0001, col: 4 },
      { key: 'devBuySol', label: 'Dev buy (SOL)', type: 'number', step: 0.01, col: 4 },
      { key: 'pool', label: 'Pool', type: 'text', col: 4 },
      { key: 'httpTimeoutMs', label: 'HTTP timeout (ms)', type: 'number', col: 4 },
      { key: 'tradeBundleTimeoutMs', label: 'Trade bundle timeout (ms)', type: 'number', col: 4 },
    ],
  },
  {
    id: 'fourmeme',
    title: 'FourMeme Runtime',
    path: 'integrations.runtime.fourMeme',
    fields: [
      { key: 'tokenManagerV2Address', label: 'TokenManager V2 address', type: 'text', col: 6 },
      { key: 'tokenManagerHelperV3Address', label: 'TokenManager Helper V3 address', type: 'text', col: 6 },
      { key: 'raisedAmount', label: 'Raised amount', type: 'number', col: 4 },
      { key: 'creationFeeBnb', label: 'Creation fee (BNB)', type: 'text', col: 4 },
      { key: 'buyDefaultFundsBnb', label: 'Default buy funds (BNB)', type: 'text', col: 4 },
      { key: 'httpTimeoutMs', label: 'HTTP timeout (ms)', type: 'number', col: 4 },
      { key: 'tokenLabels', label: 'Token labels (one per line)', type: 'textarea', col: 12 },
    ],
  },
  {
    id: 'letsbonk',
    title: 'LetsBonk Runtime',
    path: 'integrations.runtime.letsBonk',
    fields: [
      { key: 'launchLabProgramId', label: 'LaunchLab program ID', type: 'text', col: 12 },
      { key: 'platformConfigAddress', label: 'Platform config address', type: 'text', col: 12 },
      { key: 'slippageBps', label: 'Slippage (bps)', type: 'number', col: 4 },
      { key: 'emergencySlippageBps', label: 'Emergency slippage (bps)', type: 'number', col: 4 },
      { key: 'devBuySol', label: 'Dev buy (SOL)', type: 'number', step: 0.01, col: 4 },
      { key: 'defaultBuySol', label: 'Default buy (SOL)', type: 'number', step: 0.01, col: 4 },
      { key: 'priorityFeeSol', label: 'Priority fee (SOL)', type: 'number', step: 0.0001, col: 4 },
    ],
  },
  {
    id: 'openai-runtime',
    title: 'OpenAI Runtime',
    path: 'integrations.runtime.openai',
    fields: [
      { key: 'chatTimeoutMs', label: 'Chat timeout (ms)', type: 'number', col: 4 },
      { key: 'imageTimeoutMs', label: 'Image timeout (ms)', type: 'number', col: 4 },
      { key: 'defaultChatModel', label: 'Default chat model', type: 'text', col: 4 },
      { key: 'imageModel', label: 'Image model', type: 'text', col: 4 },
      { key: 'imageSize', label: 'Image size', type: 'text', col: 4 },
      { key: 'imageQuality', label: 'Image quality', type: 'text', col: 4 },
      { key: 'imageOutputFormat', label: 'Image output format', type: 'text', col: 4 },
      { key: 'temperature', label: 'Temperature', type: 'number', step: 0.1, col: 4 },
    ],
  },
  {
    id: 'solana-rpc',
    title: 'Solana RPC Runtime',
    path: 'integrations.runtime.solanaRpc',
    fields: [
      { key: 'provider', label: 'Provider', type: 'text', col: 4 },
      { key: 'commitment', label: 'Commitment', type: 'text', col: 4 },
      { key: 'confirmTimeoutMs', label: 'Confirm timeout (ms)', type: 'number', col: 4 },
      { key: 'sendRetries', label: 'Send retries', type: 'number', col: 4 },
      { key: 'maxSendRetries', label: 'Max send retries', type: 'number', col: 4 },
    ],
  },
  {
    id: 'trade',
    title: 'Trade Runtime',
    path: 'integrations.runtime.trade',
    fields: [
      { key: 'priceCacheSeconds', label: 'Price cache (sec)', type: 'number', col: 4 },
      { key: 'stalePriceMaxAgeSeconds', label: 'Stale price max age (sec)', type: 'number', col: 4 },
      { key: 'priceConsensusTolerancePercent', label: 'Price consensus tolerance %', type: 'number', col: 4 },
      { key: 'simulatedTokenPriceUsd', label: 'Simulated token price (USD)', type: 'number', step: 0.01, col: 4 },
      { key: 'providerPriority', label: 'Provider priority (comma-separated)', type: 'text', col: 12, hint: 'gmgn, dexscreener, changenow' },
    ],
  },
  {
    id: 'gmgn-runtime',
    title: 'GMGN Runtime',
    path: 'integrations.runtime.gmgn',
    fields: [
      { key: 'defaultTimeoutMs', label: 'Default timeout (ms)', type: 'number', col: 4 },
      { key: 'criticalTimeoutMs', label: 'Critical timeout (ms)', type: 'number', col: 4 },
      { key: 'rateLimitMaxWaitMs', label: 'Rate limit max wait (ms)', type: 'number', col: 4 },
      { key: 'httpRetries', label: 'HTTP retries', type: 'number', col: 4 },
    ],
  },
  {
    id: 'jupiter',
    title: 'Jupiter Runtime',
    path: 'integrations.runtime.jupiter',
    fields: [
      { key: 'slippageBps', label: 'Slippage (bps)', type: 'number', col: 4 },
      { key: 'minSwapSolReserve', label: 'Min swap SOL reserve', type: 'number', step: 0.01, col: 4 },
      { key: 'wrappedSolMint', label: 'Wrapped SOL mint', type: 'text', col: 6 },
      { key: 'usdcMint', label: 'USDC mint', type: 'text', col: 6 },
      { key: 'usdcDecimals', label: 'USDC decimals', type: 'number', col: 4 },
      { key: 'httpTimeoutMs', label: 'HTTP timeout (ms)', type: 'number', col: 4 },
      { key: 'httpRetries', label: 'HTTP retries', type: 'number', col: 4 },
    ],
  },
  {
    id: 'http-runtime',
    title: 'HTTP Defaults',
    path: 'integrations.runtime.http',
    fields: [
      { key: 'defaultTimeoutMs', label: 'Default timeout (ms)', type: 'number', col: 6 },
      { key: 'defaultRetries', label: 'Default retries', type: 'number', col: 6 },
    ],
  },
];

export const TREASURY_SECTIONS: SettingsSectionConfig[] = [
  {
    id: 'consolidate',
    title: 'Consolidate',
    path: 'treasury.consolidate',
    fields: [
      { key: 'enabled', label: 'Enabled', type: 'boolean', col: 4 },
      { key: 'defaultConvertTo', label: 'Default convert to', type: 'select', col: 4, options: [
        { value: 'NATIVE', label: 'NATIVE' }, { value: 'USDC', label: 'USDC' },
      ]},
      { key: 'defaultSlippageBps', label: 'Default slippage (bps)', type: 'number', col: 4 },
      { key: 'minGasReserveSol', label: 'Min gas reserve (SOL)', type: 'number', step: 0.001, col: 4 },
      { key: 'minGasReserveBnb', label: 'Min gas reserve (BNB)', type: 'number', step: 0.001, col: 4 },
      { key: 'minSweepUsd', label: 'Min sweep (USD)', type: 'number', step: 0.1, col: 4 },
      { key: 'requireDestinationConfirm', label: 'Require destination confirm', type: 'boolean', col: 4 },
      { key: 'maxConcurrentJobs', label: 'Max concurrent jobs', type: 'number', col: 4 },
      { key: 'telegramNotifyOnComplete', label: 'Telegram notify on complete', type: 'boolean', col: 4 },
    ],
  },
  {
    id: 'lifecycle',
    title: 'Lifecycle',
    path: 'treasury.lifecycle',
    fields: [
      { key: 'enabled', label: 'Enabled', type: 'boolean', col: 4 },
      { key: 'defaultDrainConvertTo', label: 'Default drain convert to', type: 'select', col: 4, options: [
        { value: 'USDC', label: 'USDC' }, { value: 'NATIVE', label: 'NATIVE' },
      ]},
      { key: 'defaultWalletPoolStrategy', label: 'Wallet pool strategy', type: 'select', col: 4, options: [
        { value: 'AUTO', label: 'AUTO' }, { value: 'FRESH', label: 'FRESH' }, { value: 'REUSE', label: 'REUSE' },
      ]},
      { key: 'minRearmBalanceUsd', label: 'Min rearm balance (USD)', type: 'number', col: 4 },
      { key: 'depositPollSeconds', label: 'Deposit poll (sec)', type: 'number', col: 4 },
      { key: 'defaultAmountPerWalletUsd', label: 'Amount per wallet (USD)', type: 'number', step: 0.01, col: 4 },
      { key: 'defaultSourceAsset', label: 'Default source asset', type: 'select', col: 4, options: [
        { value: 'USDC', label: 'USDC' }, { value: 'ETH', label: 'ETH' },
      ]},
      { key: 'allowForceReuseOnSingleUse', label: 'Allow force reuse on single-use', type: 'boolean', col: 4 },
      { key: 'autoPauseCyclesOnDrain', label: 'Auto-pause cycles on drain', type: 'boolean', col: 4 },
      { key: 'telegramNotifyOnComplete', label: 'Telegram notify on complete', type: 'boolean', col: 4 },
      { key: 'lifecycleRunTimeoutMinutes', label: 'Lifecycle timeout (min)', type: 'number', col: 4 },
    ],
  },
  {
    id: 'auto-drain',
    title: 'Auto Drain',
    path: 'treasury.lifecycle.autoDrain',
    fields: [
      { key: 'enabled', label: 'Enabled', type: 'boolean', col: 4 },
      { key: 'everyNCycles', label: 'Every N cycles', type: 'number', col: 4 },
      { key: 'convertTo', label: 'Convert to', type: 'select', col: 4, options: [
        { value: 'NATIVE', label: 'NATIVE' }, { value: 'USDC', label: 'USDC' },
      ]},
      { key: 'includeOwnerWallets', label: 'Include owner wallets', type: 'boolean', col: 4 },
      { key: 'fallbackCron', label: 'Fallback cron', type: 'cron', col: 6 },
    ],
  },
];
