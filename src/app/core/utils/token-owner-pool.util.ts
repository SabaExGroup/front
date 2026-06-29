import { CycleLogEntryDto } from '../models/api.types';

export type TokenOwnerFundingStatus = 'ready' | 'partial' | 'empty' | 'in_use' | 'needs_prefund';

const TOKEN_OWNER_LOG_STEPS = new Set(['WALLET_GENERATION', 'FUNDING']);

export function readTokenOwnerReuseEnabled(settings: Record<string, unknown> | null | undefined): boolean {
  const strategy = settings?.['strategy'] as Record<string, unknown> | undefined;
  return strategy?.['tokenOwnerReuseEnabled'] !== false;
}

export function readOwnerLaunchFundingUsd(settings: Record<string, unknown> | null | undefined): number {
  const strategy = settings?.['strategy'] as Record<string, unknown> | undefined;
  const val = strategy?.['ownerLaunchFundingUsd'];
  return typeof val === 'number' && !Number.isNaN(val) ? val : 550;
}

export function computeOwnerFundingStatus(
  balanceUsd: number,
  targetUsd: number,
  cycleId: string | null,
  ageHours = 0,
): TokenOwnerFundingStatus {
  if (cycleId != null) {
    return 'in_use';
  }

  const minReady = targetUsd * 0.5;
  if (balanceUsd >= minReady) {
    return 'ready';
  }
  if (balanceUsd > 0) {
    return 'partial';
  }
  if (ageHours > 0) {
    return 'needs_prefund';
  }
  return 'empty';
}

export function ownerFundingStatusLabel(status: TokenOwnerFundingStatus): string {
  switch (status) {
    case 'ready':
      return 'Ready';
    case 'partial':
      return 'Partial';
    case 'empty':
      return 'Empty';
    case 'in_use':
      return 'In use';
    case 'needs_prefund':
      return 'Needs prefund';
  }
}

export function ownerFundingStatusBadgeColor(status: TokenOwnerFundingStatus): string {
  switch (status) {
    case 'ready':
      return 'success';
    case 'partial':
      return 'warning';
    case 'empty':
      return 'secondary';
    case 'in_use':
      return 'info';
    case 'needs_prefund':
      return 'danger';
  }
}

export function shortAddress(address: string, head = 6, tail = 4): string {
  if (!address || address.length <= head + tail + 3) {
    return address;
  }
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

export function walletExplorerUrl(network: string, address: string): string | null {
  if (!address) return null;
  switch (network) {
    case 'SOLANA':
      return `https://solscan.io/account/${address}`;
    case 'BSC':
      return `https://bscscan.com/address/${address}`;
    default:
      return null;
  }
}

export function isTokenOwnerReuseDisabledMessage(message: string): boolean {
  return /TOKEN_OWNER reuse is disabled/i.test(message);
}

export function isTokenOwnerLogHighlight(log: CycleLogEntryDto): boolean {
  if (!TOKEN_OWNER_LOG_STEPS.has(log.step)) {
    return false;
  }

  const msg = log.message.toLowerCase();
  return (
    msg.includes('reused token_owner') ||
    msg.includes('token_owner') ||
    msg.includes('top-up') ||
    msg.includes('prefunded') ||
    msg.includes('queued owner funding')
  );
}

export function formatPrefundToast(response: {
  alreadyFunded: boolean;
  balanceUsd: number;
  targetUsd: number;
  topUpSendUsd?: number;
  shortfallUsd?: number;
  ageHours: number;
}): string {
  if (response.alreadyFunded) {
    return `Launch ready — $${response.balanceUsd.toFixed(1)} (target $${response.targetUsd}), age ${response.ageHours.toFixed(1)}h`;
  }

  const topUp = response.topUpSendUsd;
  const shortfall = response.shortfallUsd;
  if (topUp != null && topUp > 0) {
    const shortfallPart =
      shortfall != null && shortfall > 0 ? `, shortfall was $${shortfall.toFixed(1)}` : '';
    return `Prefund complete — top-up $${topUp.toFixed(1)}${shortfallPart}, balance $${response.balanceUsd.toFixed(1)}`;
  }

  return `Prefund complete — balance $${response.balanceUsd.toFixed(1)} (target $${response.targetUsd})`;
}
