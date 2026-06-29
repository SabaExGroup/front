import {
  canManualStartMarketMaking,
  canStopMarketMaking,
  isManualMarketMakingAllowedCycleStatus,
  marketStartButtonLabel,
} from './market-making.util';
import { CycleStatus } from '../models/enums';

describe('market-making.util', () => {
  const baseStart = {
    hasTokenId: true,
    sessionStatus: null as string | null,
    isHalted: false,
    opsLoading: false,
  };

  it('allows start on COMPLETED when token exists and not running', () => {
    expect(
      canManualStartMarketMaking({
        ...baseStart,
        cycleStatus: 'COMPLETED',
      }),
    ).toBe(true);
  });

  it('blocks start while session is RUNNING', () => {
    expect(
      canManualStartMarketMaking({
        ...baseStart,
        cycleStatus: 'COMPLETED',
        sessionStatus: 'RUNNING',
      }),
    ).toBe(false);
  });

  it('blocks start when system is halted', () => {
    expect(
      canManualStartMarketMaking({
        ...baseStart,
        cycleStatus: 'COMPLETED',
        isHalted: true,
      }),
    ).toBe(false);
  });

  it('allows stop only while RUNNING', () => {
    expect(
      canStopMarketMaking({
        hasTokenId: true,
        opsLoading: false,
        sessionStatus: 'RUNNING',
      }),
    ).toBe(true);
    expect(
      canStopMarketMaking({
        hasTokenId: true,
        opsLoading: false,
        sessionStatus: 'COMPLETED',
      }),
    ).toBe(false);
  });

  it('uses Restart label after completed session', () => {
    expect(marketStartButtonLabel('COMPLETED')).toBe('Restart');
    expect(marketStartButtonLabel(null)).toBe('Start');
  });

  it('rejects PENDING and allows MONITORING', () => {
    expect(isManualMarketMakingAllowedCycleStatus('PENDING' as CycleStatus)).toBe(false);
    expect(isManualMarketMakingAllowedCycleStatus('MONITORING')).toBe(true);
  });
});
