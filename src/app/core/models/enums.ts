export const CYCLE_STATUSES = [
  'PENDING',
  'TREND_GENERATION',
  'LAUNCHPAD_SELECTION',
  'WALLET_GENERATION',
  'SECURITY_CHECK',
  'FUNDING',
  'TOKEN_LAUNCH',
  'MARKET_MAKING',
  'MONITORING',
  'COMPLETED',
  'FAILED',
  'ABORTED',
] as const;

export type CycleStatus = (typeof CYCLE_STATUSES)[number];

export const TERMINAL_CYCLE_STATUSES: readonly CycleStatus[] = [
  'COMPLETED',
  'FAILED',
  'ABORTED',
];

export const NETWORKS = ['SOLANA', 'BSC'] as const;
export type Network = (typeof NETWORKS)[number];

export const TOKEN_SENTIMENTS = ['BULLISH', 'BEARISH', 'NEUTRAL'] as const;
export type TokenSentiment = (typeof TOKEN_SENTIMENTS)[number];

export const LAUNCHPADS = ['PUMP_FUN', 'FOUR_MEME', 'LETS_BONK', 'CUSTOM_RAYDIUM'] as const;
export type Launchpad = (typeof LAUNCHPADS)[number];

/** `strategy.defaultLaunchpad` accepts every real Launchpad plus `AUTO` (score-based auto-selection). */
export const DEFAULT_LAUNCHPAD_MODES = [...LAUNCHPADS, 'AUTO'] as const;
export type DefaultLaunchpadMode = (typeof DEFAULT_LAUNCHPAD_MODES)[number];

/** CUSTOM_RAYDIUM is our own pool — only Solana is supported (no BSC equivalent). */
export const LAUNCHPAD_NETWORKS: Record<Launchpad, readonly Network[]> = {
  PUMP_FUN: ['SOLANA'],
  LETS_BONK: ['SOLANA'],
  CUSTOM_RAYDIUM: ['SOLANA'],
  FOUR_MEME: ['BSC'],
};

export function isLaunchpadSupportedOnNetwork(launchpad: Launchpad, network: Network): boolean {
  return LAUNCHPAD_NETWORKS[launchpad]?.includes(network) ?? true;
}

export const EMERGENCY_BRAKE_SCOPES = ['GLOBAL', 'CYCLE'] as const;
export type EmergencyBrakeScope = (typeof EMERGENCY_BRAKE_SCOPES)[number];

export const EMERGENCY_BRAKE_SELL_MODES = ['TWAP', 'DUMP'] as const;
export type EmergencyBrakeSellMode = (typeof EMERGENCY_BRAKE_SELL_MODES)[number];

export const CONVERT_TO = ['NATIVE', 'USDC'] as const;
export type ConvertTo = (typeof CONVERT_TO)[number];

export const TREASURY_PHASES = [
  'DRAINING',
  'WAITING_DEPOSIT',
  'REARMING',
  'READY',
  'FAILED',
] as const;
export type TreasuryPhase = (typeof TREASURY_PHASES)[number];

export const JOB_STATUSES = ['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'READY'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const BRAKE_JOB_TERMINAL = [
  'COMPLETED',
  'PARTIAL',
  'FAILED',
  'DRAINED_HALTED',
] as const;

/** LIQUIDITY only appears on cycles launched with launchpad=CUSTOM_RAYDIUM (custodial LP holder, 1 per cycle). */
export const WALLET_TYPES = ['TOKEN_OWNER', 'MARKET', 'LIQUIDITY'] as const;
export type WalletType = (typeof WALLET_TYPES)[number];

export function walletTypeBadgeColor(type: WalletType): string {
  switch (type) {
    case 'TOKEN_OWNER':
      return 'info';
    case 'MARKET':
      return 'secondary';
    case 'LIQUIDITY':
      return 'primary';
    default:
      return 'secondary';
  }
}

export const WALLET_POOL_STRATEGIES = ['FRESH', 'REUSE', 'AUTO'] as const;
export type WalletPoolStrategy = (typeof WALLET_POOL_STRATEGIES)[number];

export const RETRY_MODES = ['resume', 'restart'] as const;
export type RetryMode = (typeof RETRY_MODES)[number];

export const CYCLE_STEPS = [
  'TREND_GENERATION',
  'LAUNCHPAD_SELECTION',
  'WALLET_GENERATION',
  'SECURITY_CHECK',
  'FUNDING',
  'TOKEN_LAUNCH',
  'MARKET_MAKING',
  'MONITORING',
] as const;
export type CycleStep = (typeof CYCLE_STEPS)[number];

export function isTerminalCycleStatus(status: CycleStatus): boolean {
  return (TERMINAL_CYCLE_STATUSES as readonly string[]).includes(status);
}

export function cycleStatusBadgeColor(status: CycleStatus): string {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'FAILED':
    case 'ABORTED':
      return 'danger';
    case 'MONITORING':
    case 'MARKET_MAKING':
      return 'info';
    case 'PENDING':
      return 'secondary';
    default:
      return 'warning';
  }
}

export const CONSOLIDATE_JOB_STATUSES = ['QUEUED', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED'] as const;
export type ConsolidateJobStatus = (typeof CONSOLIDATE_JOB_STATUSES)[number];

/** docs/manual-sell-liquidity-frontend.md §3 — sell cycle 1 (MARKET) vs cycle 2 (TOKEN_OWNER). */
export const MANUAL_SELL_RESOURCES = ['MARKET', 'TOKEN_OWNER'] as const;
export type ManualSellResource = (typeof MANUAL_SELL_RESOURCES)[number];

/** docs/manual-sell-liquidity-frontend.md §5.1 — liquidity unlock cycle 3 target selector. */
export const LIQUIDITY_UNLOCK_TARGETS = ['POOL', 'OWNER', 'BOTH', 'AUTO'] as const;
export type LiquidityUnlockTarget = (typeof LIQUIDITY_UNLOCK_TARGETS)[number];

/** docs/manual-sell-liquidity-frontend.md §3.3/§5.4 — terminal statuses for sell + liquidity-unlock jobs. */
export const MANUAL_OPS_JOB_TERMINAL = ['COMPLETED', 'PARTIAL', 'FAILED'] as const;

export function jobStatusBadgeColor(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'FAILED':
      return 'danger';
    case 'PARTIAL':
      return 'warning';
    case 'RUNNING':
      return 'info';
    default:
      return 'secondary';
  }
}

export function tokenSentimentBadgeColor(sentiment: TokenSentiment): string {
  switch (sentiment) {
    case 'BULLISH':
      return 'success';
    case 'BEARISH':
      return 'danger';
    default:
      return 'secondary';
  }
}

/** Cycle statuses allowed for POST /market-generator/cycles/:id/start (manual MM). */
export const MANUAL_MARKET_MAKING_ALLOWED_CYCLE_STATUSES = [
  'SECURITY_CHECK',
  'MARKET_MAKING',
  'MONITORING',
  'COMPLETED',
  'FAILED',
] as const satisfies readonly CycleStatus[];

export const MARKET_SESSION_STATUSES = ['RUNNING', 'STOPPED', 'COMPLETED', 'FAILED'] as const;
export type MarketSessionStatus = (typeof MARKET_SESSION_STATUSES)[number];

export function marketSessionStatusBadgeColor(status: string): string {
  switch (status) {
    case 'RUNNING':
      return 'success';
    case 'COMPLETED':
      return 'secondary';
    case 'STOPPED':
      return 'warning';
    case 'FAILED':
      return 'danger';
    default:
      return 'info';
  }
}

export function treasuryPhaseBadgeColor(phase: TreasuryPhase): string {
  switch (phase) {
    case 'READY':
      return 'success';
    case 'FAILED':
      return 'danger';
    case 'DRAINING':
    case 'REARMING':
      return 'warning';
    case 'WAITING_DEPOSIT':
      return 'info';
    default:
      return 'secondary';
  }
}
