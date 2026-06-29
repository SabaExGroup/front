import { gmgnChainSlug, gmgnUrl } from './gmgn.util';

describe('gmgn.util', () => {
  it('maps networks to GMGN chain slugs', () => {
    expect(gmgnChainSlug('SOLANA')).toBe('sol');
    expect(gmgnChainSlug('BSC')).toBe('bsc');
    expect(gmgnChainSlug('ETHEREUM')).toBe('eth');
    expect(gmgnChainSlug('UNKNOWN')).toBeNull();
  });

  it('builds wallet and token URLs', () => {
    const wallet = '3DZNVBQxpaowav4Prz5fwyTG8ReNW6aL118Mod8fJxrg';
    const token = 'Cc2ARNpZNWs6vo4weJ79xPdAUxDUxCtYfAuHjDuZpump';
    expect(gmgnUrl('SOLANA', wallet, 'wallet')).toBe(`https://gmgn.ai/sol/address/${wallet}`);
    expect(gmgnUrl('SOLANA', token, 'token')).toBe(`https://gmgn.ai/sol/token/${token}`);
    expect(gmgnUrl('BSC', '0xabc', 'token')).toBe('https://gmgn.ai/bsc/token/0xabc');
  });
});
