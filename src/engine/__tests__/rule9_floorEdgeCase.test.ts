import { describe, expect, it } from 'vitest';
import { computeKeeperOption } from '../index';
import type { LineageEntry } from '../types';

// Confirmed by the user: once ordinary escalation (rules 4/5) computes a round of exactly 3,
// that keeper is eligible at round 3 for that year with no exemption needed — but starting the
// *following* year, that round-3 slot falls under rule 3's rounds-1-3 rules, same as any other
// rounds 1-3 pick: requalify for the injury exemption every year, or it's not a keeper option
// that year. There is no permanent "floor lock" — this is just rule 3 applying naturally once
// the reference round reaches 3.
describe('rule 9 (superseded): escalating into round 3', () => {
  it('a round 4 keeper escalates to round 3 with no exemption needed for that transition', () => {
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
    expect(result.eligible).toBe(true);
    expect(result.keeperSlotRound).toBe(3);
    expect(result.usesInjuryExemptionSlot).toBe(false);
    expect(result.lockedForever).toBe(false);
  });

  it('the following year, that round-3 slot requires the injury exemption like any rounds 1-3 pick', () => {
    const atRoundThree: LineageEntry = {
      playerId: 'p1',
      seasonYear: 2027,
      slotRound: 3,
      origin: 'kept_normal',
      lockedForever: false,
    };

    const withoutExemption = computeKeeperOption(
      { playerId: 'p1', history: [atRoundThree] },
      { rosterContinuityEligible: true, gamesMissed: 0, injuryExemptionApproved: false },
    );
    expect(withoutExemption.eligible).toBe(false);
    expect(withoutExemption.ineligibleReason).toBe('rounds_1_3_not_exempt');

    const withExemption = computeKeeperOption(
      { playerId: 'p1', history: [atRoundThree] },
      { rosterContinuityEligible: true, gamesMissed: 9, injuryExemptionApproved: true },
    );
    expect(withExemption.eligible).toBe(true);
    expect(withExemption.keeperSlotRound).toBe(3);
    expect(withExemption.usesInjuryExemptionSlot).toBe(true);
    expect(withExemption.lockedForever).toBe(false);
  });
});
