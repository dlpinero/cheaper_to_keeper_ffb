import { describe, expect, it } from 'vitest';
import { escalateRound } from '../escalation';
import { computeKeeperOption } from '../index';
import type { LineageEntry } from '../types';

describe('rules 4/5: escalation brackets', () => {
  it('rounds 4-7 move up exactly one round', () => {
    expect(escalateRound(4)).toBe(3);
    expect(escalateRound(5)).toBe(4);
    expect(escalateRound(6)).toBe(5);
    expect(escalateRound(7)).toBe(6);
  });

  it('rounds 8+ move up exactly two rounds', () => {
    expect(escalateRound(8)).toBe(6);
    expect(escalateRound(9)).toBe(7);
    expect(escalateRound(12)).toBe(10);
  });

  it('throws if called with a round <= 3 (should never happen — that path is gated upstream)', () => {
    expect(() => escalateRound(3)).toThrow();
  });

  it('worked example: round 7 pick in 2026 slots as a round 6 keeper in 2027', () => {
    const entry: LineageEntry = {
      playerId: 'p1',
      seasonYear: 2026,
      slotRound: 7,
      origin: 'drafted',
      lockedForever: false,
    };
    const result = computeKeeperOption(
      { playerId: 'p1', history: [entry] },
      { rosterContinuityEligible: true, gamesMissed: 0, injuryExemptionApproved: false },
    );
    expect(result.keeperSlotRound).toBe(6);
  });

  it('worked example: round 8 pick in 2026 slots as a round 6 keeper in 2027', () => {
    const entry: LineageEntry = {
      playerId: 'p2',
      seasonYear: 2026,
      slotRound: 8,
      origin: 'drafted',
      lockedForever: false,
    };
    const result = computeKeeperOption(
      { playerId: 'p2', history: [entry] },
      { rosterContinuityEligible: true, gamesMissed: 0, injuryExemptionApproved: false },
    );
    expect(result.keeperSlotRound).toBe(6);
  });
});
