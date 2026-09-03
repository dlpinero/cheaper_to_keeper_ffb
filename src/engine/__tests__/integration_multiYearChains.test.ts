import { describe, expect, it } from 'vitest';
import { computeKeeperOption } from '../index';
import type { LineageEntry } from '../types';

const eligible = { rosterContinuityEligible: true, gamesMissed: 0, injuryExemptionApproved: false };

function keepAnotherYear(playerId: string, history: LineageEntry[], nextYear: number): LineageEntry[] {
  const result = computeKeeperOption({ playerId, history }, eligible);
  const entry: LineageEntry = {
    playerId,
    seasonYear: nextYear,
    slotRound: result.keeperSlotRound!,
    origin: result.usesInjuryExemptionSlot ? 'kept_injury_exempt' : 'kept_normal',
    lockedForever: result.lockedForever,
  };
  return [...history, entry];
}

describe('integration: multi-year keeper chains', () => {
  it('round 5 pick escalates every year, then falls under rounds 1-3 rules once it reaches round 3', () => {
    let history: LineageEntry[] = [
      { playerId: 'p1', seasonYear: 2025, slotRound: 5, origin: 'drafted', lockedForever: false },
    ];

    history = keepAnotherYear('p1', history, 2026); // 5 -> 4
    expect(history.at(-1)?.slotRound).toBe(4);

    history = keepAnotherYear('p1', history, 2027); // 4 -> 3, no exemption needed for this step
    expect(history.at(-1)?.slotRound).toBe(3);
    expect(history.at(-1)?.lockedForever).toBe(false);

    // 2028: now referencing a round-3 slot, so rule 3 kicks in — no exemption means ineligible.
    const noExemption2028 = computeKeeperOption({ playerId: 'p1', history }, eligible);
    expect(noExemption2028.eligible).toBe(false);
    expect(noExemption2028.ineligibleReason).toBe('rounds_1_3_not_exempt');

    // Qualifying for the exemption in 2028 instead keeps him at round 3.
    const withExemption2028 = computeKeeperOption(
      { playerId: 'p1', history },
      { rosterContinuityEligible: true, gamesMissed: 8, injuryExemptionApproved: true },
    );
    expect(withExemption2028.eligible).toBe(true);
    expect(withExemption2028.keeperSlotRound).toBe(3);
  });

  it('a round 1 pick stays at round 1 only for as long as it requalifies for the exemption every year', () => {
    let history: LineageEntry[] = [
      { playerId: 'p1', seasonYear: 2025, slotRound: 1, origin: 'drafted', lockedForever: false },
    ];
    const exempt = { rosterContinuityEligible: true, gamesMissed: 9, injuryExemptionApproved: true };

    const firstKeep = computeKeeperOption({ playerId: 'p1', history }, exempt);
    expect(firstKeep.keeperSlotRound).toBe(1);
    expect(firstKeep.lockedForever).toBe(false);
    history = [
      ...history,
      { playerId: 'p1', seasonYear: 2026, slotRound: 1, origin: 'kept_injury_exempt', lockedForever: false },
    ];

    // Requalifies again for 2027 and 2028 — still round 1, still not a permanent lock.
    for (const year of [2027, 2028]) {
      const result = computeKeeperOption({ playerId: 'p1', history }, exempt);
      expect(result.keeperSlotRound).toBe(1);
      expect(result.lockedForever).toBe(false);
      history = [
        ...history,
        { playerId: 'p1', seasonYear: year, slotRound: 1, origin: 'kept_injury_exempt', lockedForever: false },
      ];
    }

    // No exemption for 2029 — the prior years' exemptions don't carry forward, so he's simply
    // not keeper-eligible this year (not dropped, not locked out forever — just not this year).
    const notExempt = computeKeeperOption(
      { playerId: 'p1', history },
      { rosterContinuityEligible: true, gamesMissed: 0, injuryExemptionApproved: false },
    );
    expect(notExempt.eligible).toBe(false);
    expect(notExempt.ineligibleReason).toBe('rounds_1_3_not_exempt');
  });

  it('an undrafted pickup escalates normally once kept, same as any other keeper', () => {
    const firstKeep = computeKeeperOption(
      { playerId: 'p1', history: [], adpRoundForNextDraft: 5 },
      eligible,
    );
    expect(firstKeep.keeperSlotRound).toBe(7); // 5 + 2

    let history: LineageEntry[] = [
      { playerId: 'p1', seasonYear: 2026, slotRound: 7, origin: 'kept_normal', lockedForever: false },
    ];
    history = keepAnotherYear('p1', history, 2027); // 7 -> 6 (4-7 bracket)
    expect(history.at(-1)?.slotRound).toBe(6);
    history = keepAnotherYear('p1', history, 2028); // 6 -> 5
    expect(history.at(-1)?.slotRound).toBe(5);
  });
});
