import {
  HttpErrorResponseDto,
  LiquidityUnlockPreviewResponseDto,
  ManualSellPreviewResponseDto,
} from '../models/api.types';
import { extractErrorMessage, getHttpStatus } from './error.util';

/** docs/manual-sell-liquidity-frontend.md §2.5 — reads body.error.message.code from the Angular HttpErrorResponse. */
export function extractManualOpsErrorCode(error: unknown): string | undefined {
  const errObj = error as { error?: HttpErrorResponseDto };
  const message = errObj?.error?.message;
  if (message && typeof message === 'object' && 'code' in message) {
    return (message as { code?: string }).code;
  }
  return undefined;
}

/** docs §6 — full error table shared by all three Manual Ops cycles. */
export function formatManualOpsApiError(error: unknown): string {
  const code = extractManualOpsErrorCode(error);
  const status = getHttpStatus(error);

  switch (code) {
    case 'SYSTEM_HALTED':
      return 'System is halted — resume on the Emergency page before running Manual Ops.';
    case 'FEATURE_DISABLED':
      return 'This feature is disabled in Settings (strategy.manualSell / manualLiquidityUnlock.enabled).';
    case 'ALREADY_IN_PROGRESS':
      return 'Another operation is already in progress on this wallet/target — wait for it to finish.';
    case 'CONFIRMATION_MISMATCH':
      return 'Inputs changed since preview — please preview again.';
    case 'INVALID_CONFIRMATION':
      return 'Confirmation token is invalid — please preview again.';
    case 'NO_ELIGIBLE_WALLETS':
      return 'Nothing eligible to sell/unlock — all target wallets have a zero balance.';
    case 'UNSUPPORTED_LAUNCHPAD':
      return 'Liquidity unlock is only available for CUSTOM_RAYDIUM tokens with a Raydium pool.';
    default:
      break;
  }

  if (status === 404) {
    return 'Cycle or job not found.';
  }

  return extractErrorMessage(error);
}

/** docs §2.2/§6 — STALE_CONFIRMATION / CONFIRMATION_ALREADY_USED → caller should silently re-preview. */
export function isStaleConfirmationError(error: unknown): boolean {
  const code = extractManualOpsErrorCode(error);
  return code === 'STALE_CONFIRMATION' || code === 'CONFIRMATION_ALREADY_USED';
}

function formatTokenAmount(raw: string): string {
  const value = Number(raw);
  if (!Number.isFinite(value)) return raw;
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** docs §9 — confirm() dialog text for manual sell (MARKET/TOKEN_OWNER), mirrors formatMarketMakingStartConfirm style. */
export function formatManualSellConfirmMessage(preview: ManualSellPreviewResponseDto): string {
  const usd = preview.estimatedUsdValue != null ? ` (~$${preview.estimatedUsdValue.toFixed(2)})` : '';
  const label = preview.resource === 'MARKET' ? 'market wallets' : 'the token owner wallet';
  return (
    `Sell ${preview.percent}% of ${label}?\n\n` +
    `Amount: ${formatTokenAmount(preview.targetTokens)} tokens${usd}\n` +
    `Wallets: ${preview.walletsEligible}\n` +
    `Slippage: ${(preview.slippageBps / 100).toFixed(2)}%\n\n` +
    'This does not halt the system and cannot be undone.'
  );
}

/** docs §9 — confirm() dialog text for liquidity unlock (POOL/OWNER/BOTH/AUTO), breakdown-aware. */
export function formatLiquidityUnlockConfirmMessage(preview: LiquidityUnlockPreviewResponseDto): string {
  const legLines = preview.breakdown
    .map(
      (leg) =>
        `  · ${leg.target}: ${leg.estimatedSolOut.toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL + ` +
        `${formatTokenAmount(String(leg.estimatedTokenOut))} tokens`
    )
    .join('\n');

  return (
    `Unlock ${preview.percent}% of liquidity (${preview.requestedTarget})?\n\n` +
    `${legLines}\n\n` +
    `Total: ${preview.totalEstimatedSolOut.toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL + ` +
    `${formatTokenAmount(String(preview.totalEstimatedTokenOut))} tokens\n` +
    `Slippage: ${(preview.slippageBps / 100).toFixed(2)}%\n\n` +
    'This does not halt the system and cannot be undone.'
  );
}
