import { describe, expect, it } from 'vitest';
import { computeKeeperOption } from '../index';
import type { LineageEntry } from '../types';

describe('rule 1: roster continuity gate', () => {
  const draftedRound5: LineageEntry = {
    playerId: 'p1',
    seasonYear: 2026,
    slotRound: 5,
    origin: 'drafted',
    lockedForever: false,
  };

  it('is eligible when continuously rostered through the end of playoffs', () => {
    const result = computeKeeperOption(
      { playerId: 'p1', history: [draftedRound5] },
      { rosterContinuityEligible: true, gamesMissed: 0, injuryExemptionApproved: false },
    );
    expect(result.eligible).toBe(true);
    expect(result.keeperSlotRound).toBe(4);
  });

  it('is ineligible if dropped during the playoffs window, regardless of round', () => {
    const result = computeKeeperOption(
      { playerId: 'p1', history: [draftedRound5] },
      { rosterContinuityEligible: false, gamesMissed: 0, injuryExemptionApproved: false },
    );
    expect(result.eligible).toBe(false);
    expect(result.ineligibleReason).toBe('not_roster_continuous');
    expect(result.keeperSlotRound).toBeNull();
  });

  it('continuity gate overrides even a qualifying injury exemption', () => {
    const round1: LineageEntry = { ...draftedRound5, slotRound: 1 };
    const result = computeKeeperOption(
      { playerId: 'p1', history: [round1] },
      { rosterContinuityEligible: false, gamesMissed: 9, injuryExemptionApproved: true },
    );
    expect(result.eligible).toBe(false);
    expect(result.ineligibleReason).toBe('not_roster_continuous');
  });
});
