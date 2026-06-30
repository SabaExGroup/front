import {
  ConvertTo,
  CycleStatus,
  CycleStep,
  EmergencyBrakeScope,
  EmergencyBrakeSellMode,
  JobStatus,
  Launchpad,
  Network,
  RetryMode,
  TokenSentiment,
  TreasuryPhase,
  WalletPoolStrategy,
  WalletType,
  ConsolidateJobStatus,
} from './enums';

export interface HttpErrorMessageDto {
  message: string | string[];
  error?: string;
  statusCode?: number;
}

export interface HttpErrorResponseDto {
  statusCode: number;
  message: string | HttpErrorMessageDto;
  timestamp: string;
}

export interface CycleResponseDto {
  id: string;
  status: CycleStatus;
  network: Network;
  launchpad?: Launchpad | null;
  startedAt: string;
}

export interface CycleLogEntryDto {
  step: string;
  message: string;
  at: string;
}

export interface CycleTokenInfo {
  address?: string;
  name?: string;
  symbol?: string;
}

export interface CycleTrendPackage {
  name?: string;
  symbol?: string;
  logoUrl?: string;
  trendTopic?: string;
  socialSlug?: string;
  twitterUrl?: string;
  telegramUrl?: string;
  websiteUrl?: string;
}

export interface CycleMarketSession {
  status?: string;
  tradesExecuted?: number;
}

export interface CycleDetailResponseDto extends CycleResponseDto {
  tokenId?: string | null;
  trendPackageId?: string | null;
  marketSessionId?: string | null;
  token?: CycleTokenInfo | null;
  trendPackage?: CycleTrendPackage | null;
  marketSession?: CycleMarketSession | null;
  cycleLogs: CycleLogEntryDto[];
}

export interface CycleListResponseDto {
  total: number;
  page: number;
  limit: number;
  data: CycleResponseDto[];
}

export interface CycleResumeSnapshotResponseDto {
  cycleId: string;
  status: CycleStatus;
  failedAtStep?: CycleStep | null;
  suggestedResumeStep?: CycleStep | null;
  canResume: boolean;
}

export interface StartCycleDto {
  network?: Network;
  forceLaunchpad?: Launchpad;
  dryRun?: boolean;
  ignorePeakSchedule?: boolean;
}

export interface RetryCycleDto {
  force?: boolean;
  mode?: RetryMode;
  fromStep?: CycleStep;
  regenerateTrend?: boolean;
  dryRun?: boolean;
}

export interface CycleRetryResponseDto {
  id: string;
  status: CycleStatus;
  mode: RetryMode;
  resumeFromStep?: CycleStep | null;
  failedAtStep?: CycleStep | null;
  regeneratedTrend: boolean;
}

export interface ListCyclesQuery {
  page?: number;
  limit?: number;
  status?: CycleStatus;
}

export interface HealthResponseDto {
  status: 'ok' | 'degraded';
  checkedAt: string;
  postgres: 'up' | 'down';
  redis: 'up' | 'down';
  bullmq: 'up' | 'down';
  objectStorage: string;
  processRole: string;
}

export interface IntegrationProbeResultDto {
  status: 'up' | 'down' | 'degraded';
  latencyMs?: number;
  message?: string;
}

export interface IntegrationsHealthResponseDto {
  status: 'ok' | 'degraded' | 'down';
  checkedAt: string;
  configValid: boolean;
  configError?: string;
  providers: Record<string, IntegrationProbeResultDto>;
}

export interface RpcChainHealthDto {
  provider?: string;
  status: 'up' | 'down';
  latencyMs?: number;
  endpointHost?: string;
  slot?: number;
  blockNumber?: number;
  chainId?: number;
  version?: string;
  message?: string;
}

export interface RpcHealthResponseDto {
  status: 'ok' | 'degraded' | 'down';
  checkedAt: string;
  solana: RpcChainHealthDto;
  bsc: RpcChainHealthDto;
  ethereum: RpcChainHealthDto;
}

export interface NativeUsdPricesResponseDto {
  solUsd: number;
  bnbUsd: number;
  sources: { sol?: string; bnb?: string };
  providers?: { sol?: Record<string, unknown>; bnb?: Record<string, unknown> };
  fetchedAt: string;
  cached: boolean;
}

export interface EmergencyHaltInfo {
  jobId?: string;
  reason?: string;
  since?: string;
}

export interface EmergencyHaltStatusResponseDto {
  halted: boolean;
  halt?: EmergencyHaltInfo;
  emergencyLock?: string;
}

export interface ManualBrakeDto {
  scope: EmergencyBrakeScope;
  cycleId?: string;
  sellMode?: EmergencyBrakeSellMode;
  convertTo?: ConvertTo;
  fullDrain?: boolean;
  reason: string;
}

export interface EmergencyBrakeProgressDto {
  walletsProcessed?: number;
  walletsSold?: number;
  walletsFailed?: number;
}

export interface EmergencyBrakeResponseDto {
  jobId: string;
  drainJobId?: string;
  status: string;
  mode?: string;
  sellMode?: EmergencyBrakeSellMode;
  scope?: EmergencyBrakeScope;
  cycleId?: string;
  convertTo?: ConvertTo;
  fullDrain?: boolean;
  walletsAffected?: number;
  systemHalted?: boolean;
  message?: string;
}

export interface EmergencyBrakeJobDetailDto {
  jobId: string;
  status: string;
  mode?: string;
  sellMode?: EmergencyBrakeSellMode;
  scope?: EmergencyBrakeScope;
  cycleId?: string;
  drainJobId?: string;
  walletsAffected?: number;
  systemHalted?: boolean;
  message?: string;
  progress?: EmergencyBrakeProgressDto;
  usdRecovered?: number;
  durationMs?: number;
}

export interface ResumeSystemDto {
  jobId: string;
}

export interface ResumeSystemResponseDto {
  jobId: string;
  status: string;
  message?: string;
}

export interface MainFeeWalletResponseDto {
  fundingAddress: string;
  ethAddress: string;
  bscAddress: string;
  nativeWithdrawalSolanaAddress: string;
  nativeWithdrawalBscAddress: string;
  /** @deprecated use nativeWithdrawalSolanaAddress */
  solanaAddress?: string;
  balanceSol: string;
  balanceBnb: string;
  balanceUsdc: string;
  balanceEth: string;
  fundingTotalUsd: number;
  withdrawalTotalUsd: number;
  /** Same as fundingTotalUsd — funding wallet on Ethereum (USDC+ETH) */
  totalUsd: number;
  lowBalanceThresholdUsd?: number;
  isLowBalance: boolean;
  isReadyForRearm: boolean;
  minRearmBalanceUsd: number;
  balancesRefreshedAt: string;
}

export interface FundWalletsDto {
  cycleId: string;
  walletIds?: string[];
  sourceAsset?: string;
  targetNetwork?: Network;
  amountPerWalletUsd?: number;
}

export interface FundingJobResponseDto {
  jobId: string;
  status: string;
  walletCount?: number;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
  fundingConcurrency?: number;
}

export interface WalletSummaryDto {
  id: string;
  address: string;
  network: Network;
  type: WalletType;
  balanceNative?: string;
  balanceUsd?: number;
  isActive?: boolean;
}

export interface WalletListResponseDto {
  data: WalletSummaryDto[];
  total: number;
}

export interface ListWalletsQuery {
  page?: number;
  limit?: number;
  cycleId?: string;
  network?: Network;
  type?: WalletType;
}

export interface WalletDetailResponseDto extends WalletSummaryDto {
  cycleId?: string | null;
  tokenId?: string | null;
  createdAt?: string;
  usageMode?: 'MULTI_USE' | 'SINGLE_USE';
}

export interface WalletBalanceResponseDto {
  walletId: string;
  address: string;
  balanceNative: string;
  balanceUsd?: number;
  isLaunchReady?: boolean;
  refreshedAt?: string;
}

export interface TokenOwnerPoolWallet {
  id: string;
  address: string;
  network: Network;
  balanceUsd: number;
  cycleId: string | null;
  createdAt: string;
  ageHours: number;
  isAssignable: boolean;
  isLaunchReady?: boolean;
}

export interface ListTokenOwnerPoolQuery {
  network: Network;
  limit?: number;
}

export interface CreatePoolTokenOwnerDto {
  network: Network;
}

export interface CreatePoolTokenOwnerResponse {
  id: string;
  address: string;
  network: Network;
  type: 'TOKEN_OWNER';
  usageMode: 'MULTI_USE' | 'SINGLE_USE';
  balanceNative: string;
  balanceUsd: number;
  isActive: boolean;
  ageHours: number;
}

export interface PrefundTokenOwnerRequest {
  network: Network;
  walletId: string;
  wait?: boolean;
}

export interface PrefundTokenOwnerResponse {
  walletId: string;
  address: string;
  network: Network;
  balanceUsd: number;
  targetUsd: number;
  topUpSendUsd?: number;
  shortfallUsd?: number;
  alreadyFunded: boolean;
  status?: JobStatus;
  jobId?: string;
  poolCycleId?: string;
  waited?: boolean;
  ageHours: number;
}

export interface CycleMarketWalletBalanceRowDto {
  id: string;
  address: string;
  balanceNative: string;
  balanceUsd: number;
  isActive: boolean;
  refreshedAt?: string;
  fromCache?: boolean;
  syncError?: string;
}

export interface CycleMarketWalletBalancesResponseDto {
  cycleId: string;
  network: Network;
  walletCount: number;
  activeWalletCount: number;
  totalNative: string;
  totalUsd: number;
  syncedAt: string | null;
  failedSyncCount: number;
  wallets: CycleMarketWalletBalanceRowDto[];
}

export interface TelegramConfigDto {
  botToken?: string;
  chatIds?: string[];
  enabled?: boolean;
}

export interface ProxyConfigDto {
  enabled?: boolean;
  url?: string;
}

export interface IntegrationConfigDto {
  [key: string]: unknown;
}

export interface SettingsResponseDto {
  id: string;
  cronExpression: string;
  networkPriority: Network[];
  maxInvestmentUsd: number;
  minTradeAmountUsd?: number;
  minMarketCapUsd?: number;
  minLiquidityUsd?: number;
  marketWalletCount?: number;
  marketWalletUsageMode?: Record<string, unknown>;
  securityMinScore?: number;
  openaiModel?: string;
  strategy: Record<string, unknown>;
  treasury: Record<string, unknown>;
  telegram: TelegramConfigDto;
  proxy: ProxyConfigDto;
  integrations: IntegrationConfigDto;
  updatedAt: string;
}

export interface SettingsUpdateDto {
  cronExpression?: string;
  networkPriority?: Network[];
  maxInvestmentUsd?: number;
  minTradeAmountUsd?: number;
  minMarketCapUsd?: number;
  minLiquidityUsd?: number;
  minLiquidityRatio?: number;
  minVolume5mUsd?: number;
  maxTokenHoldPercent?: number;
  marketWalletCount?: number;
  marketWalletUsageMode?: string;
  securityMinScore?: number;
  openaiModel?: string;
  telegram?: TelegramConfigDto;
  proxy?: ProxyConfigDto;
  integrations?: IntegrationConfigDto;
  strategy?: Record<string, unknown>;
  treasury?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ProxyTestResultDto {
  success: boolean;
  latencyMs?: number;
  message?: string;
}

export interface TelegramTestDto {
  message?: string;
}

export interface TelegramTestResultItemDto {
  chatId: string;
  delivered: boolean;
  error?: string;
}

export interface TelegramTestResponseDto {
  eventType: string;
  deliveredCount: number;
  failedCount: number;
  results: TelegramTestResultItemDto[];
}

export interface TreasuryDrainDto {
  scope?: EmergencyBrakeScope;
  cycleId?: string;
  networks?: Network[];
  convertTo?: ConvertTo;
  includeOwnerWallets?: boolean;
  reason?: string;
}

export interface TreasuryRearmDto {
  networks?: Network[];
  walletPoolStrategy?: WalletPoolStrategy;
  marketWalletCount?: number;
  forceReuse?: boolean;
  sourceAsset?: 'USDC' | 'ETH';
  amountPerWalletUsd?: number;
  skipIfBalanceInsufficient?: boolean;
  startCycleAfterRearm?: boolean;
}

export interface WaitForDepositDto {
  enabled?: boolean;
  minBalanceUsd?: number;
  timeoutMinutes?: number;
}

export interface TreasuryLifecycleRunDto {
  drain?: TreasuryDrainDto;
  waitForDeposit?: WaitForDepositDto;
  rearm?: TreasuryRearmDto;
  startCycleAfterRearm?: boolean;
}

export interface TreasuryLifecycleJobResponseDto {
  jobId: string;
  phase: TreasuryPhase;
  status: JobStatus;
  walletStrategy?: string;
  walletsCreated?: number;
  walletsReused?: number;
  mainFeeUsdBefore?: number;
  mainFeeUsdAfter?: number;
  errorMessage?: string;
  createdAt?: string;
  completedAt?: string;
}

export interface TreasuryConsolidateDto {
  scope: EmergencyBrakeScope;
  cycleId?: string;
  networks?: Network[];
  destinationAddress: string | { SOLANA?: string; BSC?: string };
  convertTo?: ConvertTo;
  includeMainFeeWallet?: boolean;
  sellAllTokens?: boolean;
  minSweepUsd?: number;
  slippageBps?: number;
  reason?: string;
}

export interface TreasuryConsolidateProgressDto {
  walletsTotal: number;
  walletsSold: number;
  walletsSwept: number;
  tokensSold: number;
  tokensSkipped: number;
}

export interface TreasuryConsolidateJobDetailDto {
  jobId: string;
  status: ConsolidateJobStatus;
  networks: string[];
  walletCount: number;
  estimatedDurationSeconds: number;
  destinations: Record<string, string>;
  progress: TreasuryConsolidateProgressDto;
  totals: Record<string, unknown>;
  destinationConfirmed: boolean;
  durationSeconds?: number;
}

export interface TreasuryConsolidateResponseDto {
  jobId: string;
  status: ConsolidateJobStatus;
  networks: string[];
  walletCount: number;
  estimatedDurationSeconds: number;
  destinations: Record<string, string>;
  message?: string;
}

export interface ProfitExtractorStatusResponseDto {
  cycleId: string;
  tokenAddress?: string;
  heldPercent?: number;
  maxPercent?: number;
  excessTokens?: string;
  totalSupply?: string;
  lastExtractionAt?: string;
  status?: 'UNAVAILABLE';
  reason?: string;
}

export interface ProfitExtractorRunDto {
  cycleId: string;
  force?: boolean;
}

export interface ProfitExtractorJobResponseDto {
  jobId?: string;
  status: string;
  heldPercent?: number;
  targetPercent?: number;
}

export interface ProfitExtractorLogDto {
  id?: string;
  cycleId?: string;
  status?: string;
  heldPercentBefore?: number;
  heldPercentAfter?: number;
  tokensSold?: string;
  usdRecovered?: number;
  createdAt?: string;
}

export interface ProfitExtractorLogListResponseDto {
  data: ProfitExtractorLogDto[];
  total: number;
  page: number;
  limit: number;
}

export interface ProfitLogsQuery {
  cycleId?: string;
  page?: number;
  limit?: number;
}

export interface SecurityReportResponseDto {
  score: number;
  isSafe: boolean;
  risks: Array<{ code?: string; severity?: string; description?: string }>;
  provider?: string;
  checkedAt?: string;
}

export interface TokenInfoResponseDto {
  tokenAddress: string;
  network: Network;
  marketCapUsd: number;
  volume24hUsd: number;
  liquidityUsd: number;
  buyCount: number;
  sellCount: number;
  sentiment: TokenSentiment;
  priceUsd: number;
  updatedAt: string;
  provider: string;
  raw?: Record<string, unknown>;
}

export interface LiquidityAnalysisResponseDto {
  address: string;
  totalLiquidityUsd?: number;
  pools?: unknown[];
  [key: string]: unknown;
}

export interface GenerateWalletsDto {
  network: Network;
  type: WalletType;
  count: number;
  cycleId?: string;
}

export interface TrendGenerateDto {
  network: Network;
  style?: string;
  cycleId?: string;
}

export interface LaunchTokenDto {
  cycleId: string;
  launchpad?: Launchpad;
  dryRun?: boolean;
}

export interface StartMarketMakingDto {
  cycleId: string;
  tokenId: string;
}

/** GET /market-generator/cycles/:cycleId/session */
export interface CycleMarketSessionResponseDto {
  id?: string;
  cycleId?: string;
  tokenId?: string;
  status: string;
  tradesExecuted: number;
  phase?: string;
  /** Trades per minute (new API field) */
  tpm?: number;
  /** Legacy alias for tpm */
  tradesPerMinute?: number;
  startedAt?: string;
  stoppedAt?: string | null;
  blitzMode?: boolean;
  blitzIndex?: number;
  strategyTargetTradesPerMinute?: number;
  baseTargetTradesPerMinute?: number;
  buyBiasPercent?: number;
  visibilityPhase?: string;
  botMagnetActive?: boolean;
  targetMarketCapUsd?: number;
  marketCapUsd?: number;
  volumeUsd?: number;
  priceChangePercent?: number;
  gasSpentUsd?: number;
}

export interface MarketSessionDetailResponseDto {
  id: string;
  cycleId: string;
  tokenId: string;
  status: string;
  startedAt: string;
  stoppedAt?: string | null;
  tradesExecuted: number;
  tradesPerMinute?: number;
  phase?: string;
  blitzMode?: boolean;
  marketCapUsd?: number;
  volumeUsd?: number;
  priceChangePercent?: number;
  gasSpentUsd?: number;
}

export interface MarketSessionResponseDto {
  id: string;
  cycleId: string;
  tokenId: string;
  status: string;
  startedAt: string;
  stoppedAt?: string | null;
}

export interface LaunchpadRecommendationDto {
  network: Network;
  launchpad: string;
  score: number;
  reasons: string[];
  metrics: Record<string, unknown>;
}

export interface TokenLaunchResponseDto {
  id: string;
  cycleId: string;
  network: Network;
  launchpad: string;
  address: string;
  name: string;
  symbol: string;
  ownerWalletId: string;
  txHash: string;
  dryRun: boolean;
  explorer?: { tokenUrl: string; txUrl: string; launchpadUrl?: string };
}

export interface TrendRegenerateDto {
  force?: boolean;
  style?: 'viral' | 'controversial' | 'meme';
}

export interface TrendSocialPoolsSnapshot {
  telegramUrlPool: string[];
  websiteUrlPool: string[];
  twitterUrlPool: string[];
  twitterSearchEnabled: boolean;
  twitterMinFollowers: number;
}

export interface TrendSocialPoolsUpdateDto {
  telegramUrlPool?: string[];
  websiteUrlPool?: string[];
  twitterUrlPool?: string[];
  twitterSearchEnabled?: boolean;
  twitterMinFollowers?: number;
}

export interface TrendPackageResponseDto {
  id: string;
  cycleId?: string | null;
  name: string;
  symbol: string;
  description: string;
  logoUrl: string;
  trendTopic: string;
  socialSlug?: string;
  twitterUrl?: string;
  telegramUrl?: string;
  websiteUrl?: string;
  viralAngle?: string;
  controversyLevel?: string;
  hashtags: string[];
  aiModelText: string;
  aiModelImage: string;
  provider: string;
  generationLatencyMs: number;
  generatedAt: string;
  createdAt?: string;
}

export type InflowConfidence = 'high' | 'medium' | 'low' | 'unavailable';
export type InflowMethod = 'volume_split' | 'liquidity_delta' | 'hybrid' | 'unavailable';
export type PoolMetricsSource = 'token_info_24h' | 'metric_snapshot' | 'visibility_5m' | 'unavailable';
export type NativeSource = 'live_rpc' | 'db_with_live_price' | 'partial';
export type TokenBalancesSource = 'on_chain' | 'unavailable';

export interface CycleAnalysisWalletDto {
  id: string;
  address: string;
  isActive: boolean;
  nativeUsd: number;
  tokenUsd: number;
  totalUsd: number;
  balanceNative: string;
  balanceToken: string;
  syncError?: string;
}

export interface CycleAnalysisWalletGroupDto {
  walletCount: number;
  nativeUsd: number;
  tokenUsd: number;
  totalUsd: number;
  totalNative: string;
  totalToken: string;
  failedSyncCount: number;
  wallets: CycleAnalysisWalletDto[];
}

export interface CycleAnalysisCombinedDto {
  nativeUsd: number;
  tokenUsd: number;
  totalUsd: number;
  freeNativeUsd: number;
  tiedInTokensUsd: number;
  tiedPercent: number;
}

export interface CycleAnalysisTradesDto {
  buyCount: number;
  sellCount: number;
  buyUsd: number;
  sellUsd: number;
  netBuyUsd: number;
}

export interface CycleAnalysisOrganicFlowDto {
  internalBuyUsd: number;
  internalSellUsd: number;
  externalBuyUsd: number;
  externalSellUsd: number;
  externalInflowUsd: number;
  liquidityDeltaUsd: number;
  marketCapDeltaUsd: number;
  organicWalletCount: number;
  holderCount: number;
  organicBuySharePercent: number;
  inflowConfidence: InflowConfidence;
  inflowMethod: InflowMethod;
  poolMetricsSource: PoolMetricsSource;
}

export interface CycleAnalysisEconomicsDto {
  totalInvestedUsd: number;
  currentPortfolioUsd: number;
  totalRealizedUsd: number;
  totalValueUsd: number;
  ecosystemImpactUsd: number;
  externalInflowUsd: number;
  profitLedgerDriftUsd: number;
  portfolioMultiple: number;
  profitMultiple: number;
  totalReturnMultiple: number;
  ecosystemImpactMultiple: number;
  externalInflowMultiple: number;
  liquidityMultiple: number;
  fundingUsd?: number;
  gasUsd?: number;
  profitOutUsd?: number;
  emergencyUsd?: number;
}

export interface CycleAnalysisDataQualityDto {
  nativeSource: NativeSource;
  tokenBalancesSource: TokenBalancesSource;
  organicInflowConfidence: InflowConfidence;
  organicInflowMethod: string;
  poolMetricsSource: string;
  failedNativeSyncCount: number;
  tokenBalanceError: string | null;
}

export interface CycleAnalysisTokenDto {
  symbol: string;
  name: string;
  address: string;
  priceUsd: number;
  liquidityUsd: number;
  marketCapUsd: number;
  priceSource: string;
}

export interface CycleAnalysisResponseDto {
  cycleId: string;
  network: Network;
  status: string;
  syncedAt: string | null;
  token: CycleAnalysisTokenDto | null;
  marketWallets: CycleAnalysisWalletGroupDto;
  tokenOwnerWallets: CycleAnalysisWalletGroupDto;
  combined: CycleAnalysisCombinedDto;
  trades: CycleAnalysisTradesDto;
  organicFlow: CycleAnalysisOrganicFlowDto | null;
  economics: CycleAnalysisEconomicsDto;
  dataQuality: CycleAnalysisDataQualityDto;
}

export type ExternalTraderPositionStatus = 'OPEN' | 'CLOSED' | 'NEVER_HELD';
export type ExitStrategy = 'MARK_TO_MARKET' | 'DUMP' | 'TWAP' | 'STEP_PROFIT';
export type ExternalTraderDataSource =
  | 'on_chain'
  | 'explorer_holders'
  | 'gmgn_holders'
  | 'gmgn_traders'
  | 'gmgn_activity';
export type ExternalTraderCompleteness = 'full' | 'partial' | 'unavailable';

export interface ExternalTraderSegmentSummaryDto {
  traderCount: number;
  buyUsd: number;
  sellUsd: number;
  netFlowUsd: number;
  openPositionUsd: number;
  tokenBalance: number;
  realizedPnlUsd: number;
}

export interface ExternalTraderRowDto {
  address: string;
  positionStatus: ExternalTraderPositionStatus;
  tokenBalance: number;
  tokenBalanceUsd: number;
  buyUsd: number;
  sellUsd: number;
  netFlowUsd: number;
  buyCount: number;
  sellCount: number;
  realizedPnlUsd: number;
  capitalDeployedUsd: number;
  dataComplete: boolean;
  missingFields: string[];
  sources: ExternalTraderDataSource[];
}

export interface ExitScenarioEstimateDto {
  strategy: ExitStrategy;
  label: string;
  tokenSold: number;
  tokenSoldUsdSpot: number;
  slippageUsd: number;
  slippagePercent: number;
  tokenProceedsUsd: number;
  freeNativeUsd: number;
  alreadyRealizedUsd: number;
  totalFinalUsd: number;
  batches: number;
  durationEstimateSec: number;
  remainingTokenUsd: number;
  assumptions: string[];
}

export interface ExternalTraderIntelligenceTokenDto {
  id: string;
  address: string;
  symbol: string;
  priceUsd: number;
  liquidityUsd: number;
  marketCapUsd: number;
  holderCount: number;
}

export interface ExternalTraderIntelligenceSummaryDto {
  all: ExternalTraderSegmentSummaryDto;
  openPositions: ExternalTraderSegmentSummaryDto;
  closedPositions: ExternalTraderSegmentSummaryDto;
  neverHeld: ExternalTraderSegmentSummaryDto;
  totalReportedHolders: number;
  identifiedExternalTraders: number;
  coveragePercent: number;
  internalWalletCount: number;
  excludedSystemAddresses: number;
}

export interface ExternalTraderOurPositionDto {
  freeNativeUsd: number;
  tokenHeld: number;
  tokenHeldUsd: number;
  alreadyRealizedUsd: number;
  markToMarketUsd: number;
  ownerHeldPercent: number;
  marketHeldPercent: number;
}

export interface ExternalTraderCoverageDto {
  onChainHolderCount: number;
  explorerHolderCount: number;
  gmgnHolderRows: number;
  gmgnTraderRows: number;
  gmgnActivityEnriched: number;
  mergedUniqueExternal: number;
  reportedHolderCount: number;
  coveragePercent: number;
  dataCompletePercent: number;
  completeness: ExternalTraderCompleteness;
  isReconciled: boolean;
  notes: string[];
}

export interface ExternalTraderReconciliationDto {
  aggregatedExternalBuyUsd: number;
  aggregatedExternalSellUsd: number;
  organicFlowExternalBuyUsd: number | null;
  organicFlowExternalSellUsd: number | null;
  buyUsdDelta: number | null;
  sellUsdDelta: number | null;
  incompleteTraderCount: number;
  incompleteOpenPositionCount: number;
  dataCompletePercent: number;
  isReconciled: boolean;
  notes: string[];
}

export interface ExternalTraderIntelligenceSnapshotDto {
  cycleId: string;
  network: Network;
  status: string;
  token: ExternalTraderIntelligenceTokenDto | null;
  summary: ExternalTraderIntelligenceSummaryDto;
  traders: ExternalTraderRowDto[];
  topOpenPositions: ExternalTraderRowDto[];
  topClosedTraders: ExternalTraderRowDto[];
  exitScenarios: ExitScenarioEstimateDto[];
  ourPosition: ExternalTraderOurPositionDto;
  coverage: ExternalTraderCoverageDto;
  reconciliation: ExternalTraderReconciliationDto;
  syncedAt: string;
}
