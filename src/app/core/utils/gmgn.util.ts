export type GmgnLinkKind = 'wallet' | 'token';

export type GmgnChainSlug = 'sol' | 'bsc' | 'eth' | 'base';

export function gmgnChainSlug(network: string): GmgnChainSlug | null {
  switch (network?.toUpperCase()) {
    case 'SOLANA':
    case 'SOL':
      return 'sol';
    case 'BSC':
    case 'BNB':
      return 'bsc';
    case 'ETH':
    case 'ETHEREUM':
      return 'eth';
    case 'BASE':
      return 'base';
    default:
      return null;
  }
}

export function gmgnUrl(network: string, address: string, kind: GmgnLinkKind): string | null {
  const trimmed = address?.trim();
  if (!trimmed) return null;
  const chain = gmgnChainSlug(network);
  if (!chain) return null;
  const segment = kind === 'token' ? 'token' : 'address';
  return `https://gmgn.ai/${chain}/${segment}/${trimmed}`;
}
