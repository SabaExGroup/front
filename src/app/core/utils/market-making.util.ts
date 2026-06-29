import {
  CycleStatus,
  MANUAL_MARKET_MAKING_ALLOWED_CYCLE_STATUSES,
  MarketSessionStatus,
} from '../models/enums';
import { CycleMarketSession } from '../models/api.types';
import { getHttpStatus, extractErrorMessage } from './error.util';

export const MARKET_MAKING_POLL_INTERVAL_MS = 2_500;

export const NEW_CYCLE_WALLET_DETACH_WARNING =
  'Starting a new cycle will detach wallets from any COMPLETED cycle and assign them to the new cycle. ' +
  'Manual market making on the previous cycle will no longer use the same wallets.';

export function isManualMarketMakingLive(
  cycleStatus: CycleStatus | string,
  sessionStatus: string | null | undefined,
): boolean {
  return cycleStatus === 'MARKET_MAKING' && sessionStatus === 'RUNNING';
}

export function isMarketSessionRunning(sessionStatus: string | null | undefined): boolean {
  return sessionStatus === 'RUNNING';
}

export function isManualMarketMakingAllowedCycleStatus(
  cycleStatus: CycleStatus | string,
  options?: { canResumeAborted?: boolean },
): boolean {
  if ((MANUAL_MARKET_MAKING_ALLOWED_CYCLE_STATUSES as readonly string[]).includes(cycleStatus)) {
    return true;
  }
  return cycleStatus === 'ABORTED' && !!options?.canResumeAborted;
}

export function canManualStartMarketMaking(params: {
  cycleStatus: CycleStatus | string;
  hasTokenId: boolean;
  sessionStatus: string | null;
  isHalted: boolean;
  opsLoading: boolean;
  canResumeAborted?: boolean;
}): boolean {
  if (params.opsLoading || !params.hasTokenId || params.isHalted) {
    return false;
  }
  if (isMarketSessionRunning(params.sessionStatus)) {
    return false;
  }
  return isManualMarketMakingAllowedCycleStatus(params.cycleStatus, {
    canResumeAborted: params.canResumeAborted,
  });
}

export function canStopMarketMaking(params: {
  sessionStatus: string | null;
  hasTokenId: boolean;
  opsLoading: boolean;
}): boolean {
  if (params.opsLoading || !params.hasTokenId) {
    return false;
  }
  return isMarketSessionRunning(params.sessionStatus);
}

export function marketStartButtonLabel(sessionStatus: string | null): 'Start' | 'Restart' {
  if (sessionStatus === 'COMPLETED' || sessionStatus === 'STOPPED') {
    return 'Restart';
  }
  return 'Start';
}

export function resolveMarketSessionStatus(
  detail: { status?: string } | null | undefined,
  fallback?: CycleMarketSession | null,
): string | null {
  return detail?.status ?? fallback?.status ?? null;
}

export function resolveMarketTradesExecuted(
  detail: { tradesExecuted?: number } | null | undefined,
  fallback?: CycleMarketSession | null,
): number {
  return detail?.tradesExecuted ?? fallback?.tradesExecuted ?? 0;
}

export function resolveMarketTradesPerMinute(
  detail: { tpm?: number; tradesPerMinute?: number } | null | undefined,
): number | null {
  if (!detail) return null;
  const tpm = detail.tpm ?? detail.tradesPerMinute;
  return tpm != null ? tpm : null;
}

export function manualMarketMakingDisabledReason(params: {
  cycleStatus: CycleStatus | string;
  hasTokenId: boolean;
  sessionStatus: string | null;
  isHalted: boolean;
  opsLoading: boolean;
  canResumeAborted?: boolean;
}): string | null {
  if (params.opsLoading) {
    return 'Operation in progress…';
  }
  if (!params.hasTokenId) {
    return 'Token not launched yet — start is unavailable.';
  }
  if (params.isHalted) {
    return 'System is halted — resume on the Emergency page before starting market making.';
  }
  if (isMarketSessionRunning(params.sessionStatus)) {
    return 'Session is running — stop it before restarting.';
  }
  if (!isManualMarketMakingAllowedCycleStatus(params.cycleStatus, { canResumeAborted: params.canResumeAborted })) {
    if (params.cycleStatus === 'ABORTED') {
      return 'Cycle is aborted — retry the cycle before manual market making.';
    }
    return `Manual market making is not allowed while cycle is ${params.cycleStatus}.`;
  }
  return null;
}

export function formatMarketMakingStartConfirm(
  isRestart: boolean,
  priorTrades: number,
): string {
  if (isRestart && priorTrades > 0) {
    return (
      `Restart market making? Trade counter will continue from ${priorTrades} prior session trade(s) ` +
      '(manual MM does not reset tradesExecuted).'
    );
  }
  return 'Start manual market making on this cycle?';
}

export function formatMarketMakingStopConfirm(): string {
  return (
    'Stop market making session? Queued trades will drain and cycle status will return to its ' +
    'previous state (e.g. COMPLETED or MONITORING).'
  );
}

export function formatMarketMakingStartToast(isRestart: boolean, priorTrades: number): string {
  if (isRestart && priorTrades > 0) {
    return `Manual market making restarted — continuing from ${priorTrades} prior session trade(s)`;
  }
  return 'Manual market making started';
}

export function formatMarketMakingApiError(error: unknown): string {
  const status = getHttpStatus(error);
  const message = extractErrorMessage(error);
  const lower = message.toLowerCase();

  if (status === 404) {
    return 'Cycle or token not found — cycle must have a launched token.';
  }
  if (status === 409) {
    if (lower.includes('halt')) {
      return 'System is halted — resume on the Emergency page before starting market making.';
    }
    if (lower.includes('automated') || lower.includes('in progress')) {
      return 'Automated market making is in progress — wait or abort the cycle.';
    }
    if (lower.includes('not allowed')) {
      return message;
    }
    return message || 'Conflict — cycle state does not allow this operation.';
  }
  return message;
}

export function isTerminalMarketSessionStatus(status: MarketSessionStatus | string): boolean {
  return status !== 'RUNNING';
}
