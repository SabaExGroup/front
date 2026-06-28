import {
  IntegrationsHealthResponseDto,
  MainFeeWalletResponseDto,
} from '../models/api.types';
import { ConvertTo } from '../models/enums';

/** docs/frontend-emergency-treasury.md §58 */
export const WITHDRAWAL_USD_DISCLAIMER =
  'After convertTo: USDC, USDC is on withdrawal wallets (SPL / BEP-20) but withdrawalTotalUsd still counts native only — the USD figure may be understated.';

export function fundingTotalUsd(wallet: MainFeeWalletResponseDto): number {
  return wallet.fundingTotalUsd ?? wallet.totalUsd;
}

export function withdrawalSolanaAddress(wallet: MainFeeWalletResponseDto): string {
  return wallet.nativeWithdrawalSolanaAddress ?? wallet.solanaAddress ?? '—';
}

function normalizeEvmAddress(address: string): string {
  return address.trim().toLowerCase();
}

/** docs §344 — consolidate destination must not be funding EVM address */
export function isFundingEvmAddress(address: string, wallet: MainFeeWalletResponseDto): boolean {
  const normalized = normalizeEvmAddress(address);
  if (!normalized.startsWith('0x')) return false;
  const candidates = [wallet.fundingAddress, wallet.bscAddress, wallet.ethAddress]
    .filter((a): a is string => !!a?.trim())
    .map(normalizeEvmAddress);
  return candidates.includes(normalized);
}

export function validateConsolidateDestinations(
  destination: string | { SOLANA?: string; BSC?: string },
  wallet: MainFeeWalletResponseDto | null
): string | null {
  if (!wallet) return null;

  const checkEvm = (addr: string | undefined, label: string): string | null => {
    if (!addr?.trim()) return null;
    if (isFundingEvmAddress(addr, wallet)) {
      return `${label} cannot be the funding wallet (${wallet.fundingAddress}) — sweep never goes to funding.`;
    }
    return null;
  };

  if (typeof destination === 'string') {
    return checkEvm(destination, 'Destination');
  }

  return checkEvm(destination.BSC, 'BSC destination');
}

/** docs §7 — warn when convertTo USDC and jupiter/changenow unhealthy */
export function usdcConvertHealthWarnings(
  health: IntegrationsHealthResponseDto | null | undefined
): string[] {
  if (!health?.providers) return [];

  const warnings: string[] = [];
  const jupiter = health.providers['jupiter'];
  const changenow = health.providers['changenow'];

  if (jupiter && (jupiter.status === 'down' || jupiter.status === 'degraded')) {
    warnings.push(`Jupiter is ${jupiter.status} — Solana USDC convert may be skipped.`);
  }
  if (changenow && (changenow.status === 'down' || changenow.status === 'degraded')) {
    warnings.push(`ChangeNOW is ${changenow.status} — BSC USDC convert may be skipped.`);
  }

  return warnings;
}

export function confirmUsdcConvertWarnings(
  convertTo: ConvertTo | undefined,
  warnings: string[]
): boolean {
  if (convertTo !== 'USDC' || warnings.length === 0) return true;
  return confirm(
    `USDC convert — integration health warning:\n\n${warnings.join('\n')}\n\nContinue anyway?`
  );
}

/** docs §10 — convert skipped in job logs */
export function looksLikeConvertSkipped(text: string | undefined): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return (
    (lower.includes('convert') && (lower.includes('skip') || lower.includes('skipped'))) ||
    (lower.includes('jupiter') && lower.includes('missing')) ||
    (lower.includes('withdrawal') && lower.includes('private key'))
  );
}
