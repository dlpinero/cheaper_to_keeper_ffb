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
  it('round 5 pick escalates every year until it floor-locks at round 3, then stays there', () => {
    let history: LineageEntry[] = [
      { playerId: 'p1', seasonYear: 2025, slotRound: 5, origin: 'drafted', lockedForever: false },
    ];

    history = keepAnotherYear('p1', history, 2026); // 5 -> 4
    expect(history.at(-1)?.slotRound).toBe(4);

    history = keepAnotherYear('p1', history, 2027); // 4 -> 3, locks
    expect(history.at(-1)?.slotRound).toBe(3);
    expect(history.at(-1)?.lockedForever).toBe(true);

    history = keepAnotherYear('p1', history, 2028); // stays at 3
    expect(history.at(-1)?.slotRound).toBe(3);

    history = keepAnotherYear('p1', history, 2029); // still 3
    expect(history.at(-1)?.slotRound).toBe(3);
  });

  it('a round 1 injury-exempt keeper stays locked at round 1 across many years', () => {
    let history: LineageEntry[] = [
      { playerId: 'p1', seasonYear: 2025, slotRound: 1, origin: 'drafted', lockedForever: false },
    ];

    const firstKeep = computeKeeperOption(
      { playerId: 'p1', history },
      { rosterContinuityEligible: true, gamesMissed: 9, injuryExemptionApproved: true },
    );
    expect(firstKeep.keeperSlotRound).toBe(1);
    history = [
      ...history,
      {
        playerId: 'p1',
        seasonYear: 2026,
        slotRound: 1,
        origin: 'kept_injury_exempt',
        lockedForever: true,
      },
    ];

    for (const year of [2027, 2028, 2029]) {
      history = keepAnotherYear('p1', history, year);
      expect(history.at(-1)?.slotRound).toBe(1);
      expect(history.at(-1)?.origin).toBe('kept_injury_exempt');
    }
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
