import { describe, expect, it } from 'vitest';
import { computeKeeperOption } from '../index';
import type { LineageEntry } from '../types';

describe('rule 3: rounds 1-3 exemption', () => {
  const round1Draft: LineageEntry = {
    playerId: 'p1',
    seasonYear: 2025,
    slotRound: 1,
    origin: 'drafted',
    lockedForever: false,
  };

  it('is ineligible without a qualifying injury exemption', () => {
    const result = computeKeeperOption(
      { playerId: 'p1', history: [round1Draft] },
      { rosterContinuityEligible: true, gamesMissed: 3, injuryExemptionApproved: false },
    );
    expect(result.eligible).toBe(false);
    expect(result.ineligibleReason).toBe('rounds_1_3_not_exempt');
  });

  it('is ineligible if games missed is under 8, even if the commissioner "approved" it', () => {
    const result = computeKeeperOption(
      { playerId: 'p1', history: [round1Draft] },
      { rosterContinuityEligible: true, gamesMissed: 7, injuryExemptionApproved: true },
    );
    expect(result.eligible).toBe(false);
    expect(result.ineligibleReason).toBe('rounds_1_3_not_exempt');
  });

  it('worked example: round 1 pick in 2025, missed 9 games, kept round 1 in 2026', () => {
    const result = computeKeeperOption(
      { playerId: 'p1', history: [round1Draft] },
      { rosterContinuityEligible: true, gamesMissed: 9, injuryExemptionApproved: true },
    );
    expect(result.eligible).toBe(true);
    expect(result.keeperSlotRound).toBe(1);
    expect(result.usesInjuryExemptionSlot).toBe(true);
    expect(result.lockedForever).toBe(true);
  });

  it('stays locked at round 1 the following year without re-qualifying for the exemption', () => {
    const lockedRound1: LineageEntry = {
      playerId: 'p1',
      seasonYear: 2026,
      slotRound: 1,
      origin: 'kept_injury_exempt',
      lockedForever: true,
    };
    const result = computeKeeperOption(
      { playerId: 'p1', history: [round1Draft, lockedRound1] },
      { rosterContinuityEligible: true, gamesMissed: 0, injuryExemptionApproved: false },
    );
    expect(result.eligible).toBe(true);
    expect(result.keeperSlotRound).toBe(1);
    expect(result.usesInjuryExemptionSlot).toBe(true);
    expect(result.lockedForever).toBe(true);
  });

  it('round 2 and round 3 picks require the exemption too', () => {
    for (const round of [2, 3]) {
      const entry: LineageEntry = { ...round1Draft, slotRound: round };
      const noExemption = computeKeeperOption(
        { playerId: 'p1', history: [entry] },
        { rosterContinuityEligible: true, gamesMissed: 0, injuryExemptionApproved: false },
      );
      expect(noExemption.eligible).toBe(false);

      const withExemption = computeKeeperOption(
        { playerId: 'p1', history: [entry] },
        { rosterContinuityEligible: true, gamesMissed: 8, injuryExemptionApproved: true },
      );
      expect(withExemption.eligible).toBe(true);
      expect(withExemption.keeperSlotRound).toBe(round);
    }
  });
});
