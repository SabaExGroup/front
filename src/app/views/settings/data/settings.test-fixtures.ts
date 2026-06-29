import { getDefaultsSnapshot } from '../settings-schema.util';
import { normalizeSettingsShape } from '../settings-form.util';

/** Backend mask for unchanged secrets — never use real credentials in tests. */
export const MASKED_SECRET = '***';

const SYNTHETIC_SOLANA_ADDRESS = '11111111111111111111111111111111';

/** Build a full settings API response for tests without embedding real secrets. */
export function buildSettingsApiResponse(
  overrides?: Record<string, unknown>
): Record<string, unknown> {
  const defaults = structuredClone(getDefaultsSnapshot());
  const integrations = {
    ...(defaults['integrations'] as Record<string, unknown>),
    openaiApiKey: MASKED_SECRET,
    gmgnApiKey: MASKED_SECRET,
    gmgnPrivateKey: MASKED_SECRET,
    changeNowApiKey: MASKED_SECRET,
    pumpPortalApiKey: MASKED_SECRET,
    pumpFunJwtToken: MASKED_SECRET,
    pinataApiKey: MASKED_SECRET,
    pinataApiSecret: MASKED_SECRET,
    pinataJwt: MASKED_SECRET,
    jupiterApiKey: MASKED_SECRET,
    etherscanApiKey: MASKED_SECRET,
    solanaScanApiKey: MASKED_SECRET,
    xBearerToken: MASKED_SECRET,
    mainFeeWalletEvmPrivateKey: MASKED_SECRET,
    nativeWithdrawalBscPrivateKey: MASKED_SECRET,
    nativeWithdrawalSolanaPrivateKey: MASKED_SECRET,
    nativeWithdrawalSolanaAddress: SYNTHETIC_SOLANA_ADDRESS,
    nativeWithdrawalBscAddress: '0x0000000000000000000000000000000000000001',
  };

  return normalizeSettingsShape({
    id: 'test-settings-id',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...defaults,
    integrations,
    telegram: {
      botToken: MASKED_SECRET,
      chatIds: ['-1000000000000'],
    },
    proxy: {
      enabled: true,
      url: MASKED_SECRET,
    },
    ...overrides,
  });
}
