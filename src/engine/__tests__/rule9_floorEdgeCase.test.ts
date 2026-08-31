import { describe, expect, it } from 'vitest';
import { defaultFloorRule } from '../escalation';
import { computeKeeperOption } from '../index';
import type { FloorRule, LineageEntry } from '../types';

// Rule 9 is a FLAGGED ASSUMPTION, not directly confirmed by the user: when normal escalation
// (rules 4/5) computes a round <= 3, this engine locks it there permanently rather than
// continuing to escalate below round 3 in future years. If that assumption turns out to be
// wrong, only defaultFloorRule.apply needs to change — every caller is already parameterized
// on FloorRule.
describe('rule 9: escalation floor (flagged assumption)', () => {
  it('default floor rule locks at round 3 once escalation would go at or below it', () => {
    expect(defaultFloorRule.apply(3)).toEqual({ round: 3, locked: true });
    expect(defaultFloorRule.apply(2)).toEqual({ round: 3, locked: true });
    expect(defaultFloorRule.apply(4)).toEqual({ round: 4, locked: false });
  });

  it('a round 4 keeper escalates to round 3 and locks there', () => {
    const entry: LineageEntry = {
      playerId: 'p1',
      seasonYear: 2026,
      slotRound: 4,
      origin: 'kept_normal',
      lockedForever: false,
    };
    const result = computeKeeperOption(
      { playerId: 'p1', history: [entry] },
      { rosterContinuityEligible: true, gamesMissed: 0, injuryExemptionApproved: false },
    );
    expect(result.keeperSlotRound).toBe(3);
    expect(result.lockedForever).toBe(true);
  });

  it('once floor-locked, stays at round 3 forever and does not need the injury exemption', () => {
    const flooredEntry: LineageEntry = {
      playerId: 'p1',
      seasonYear: 2027,
      slotRound: 3,
      origin: 'kept_normal',
      lockedForever: true,
    };
    const result = computeKeeperOption(
      { playerId: 'p1', history: [flooredEntry] },
      { rosterContinuityEligible: true, gamesMissed: 0, injuryExemptionApproved: false },
    );
    expect(result.eligible).toBe(true);
    expect(result.keeperSlotRound).toBe(3);
    // Unlike a rounds-1-3 injury lock, a floor lock reached via ordinary rules 4/7 escalation
    // never required the exemption, so it must not silently consume the exemption cap slot.
    expect(result.usesInjuryExemptionSlot).toBe(false);
  });

  it('the floor rule is injectable, so an alternative policy can be swapped in without touching callers', () => {
    const noFloor: FloorRule = { apply: (round) => ({ round, locked: false }) };
    const entry: LineageEntry = {
      playerId: 'p1',
      seasonYear: 2026,
      slotRound: 4,
      origin: 'kept_normal',
      lockedForever: false,
    };
    const result = computeKeeperOption(
      { playerId: 'p1', history: [entry] },
      { rosterContinuityEligible: true, gamesMissed: 0, injuryExemptionApproved: false },
      noFloor,
    );
    expect(result.keeperSlotRound).toBe(3);
    expect(result.lockedForever).toBe(false);
  });
});
