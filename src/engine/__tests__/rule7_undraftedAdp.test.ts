import { describe, expect, it } from 'vitest';
import { computeKeeperOption } from '../index';
import type { LineageEntry } from '../types';

describe('rule 7: undrafted players', () => {
  it('worked example: undrafted, ADP round 2 for next draft, slots as round 4 keeper', () => {
    const result = computeKeeperOption(
      { playerId: 'p1', history: [], adpRoundForNextDraft: 2 },
      { rosterContinuityEligible: true, gamesMissed: 0, injuryExemptionApproved: false },
    );
    expect(result.eligible).toBe(true);
    expect(result.keeperSlotRound).toBe(4);
    expect(result.lockedForever).toBe(false);
  });

  it('is ineligible with no lineage and no ADP (never drafted, no ADP data)', () => {
    const result = computeKeeperOption(
      { playerId: 'p1', history: [] },
      { rosterContinuityEligible: true, gamesMissed: 0, injuryExemptionApproved: false },
    );
    expect(result.eligible).toBe(false);
    expect(result.ineligibleReason).toBe('no_lineage_history');
  });

  it('once kept, subsequent years escalate normally off the slot round, not ADP again', () => {
    const keptFromAdp: LineageEntry = {
      playerId: 'p1',
      seasonYear: 2027,
      slotRound: 4,
      origin: 'kept_normal',
      lockedForever: false,
    };
    // Even if adpRoundForNextDraft were passed again, history should take priority.
    const result = computeKeeperOption(
      { playerId: 'p1', history: [keptFromAdp], adpRoundForNextDraft: 1 },
      { rosterContinuityEligible: true, gamesMissed: 0, injuryExemptionApproved: false },
    );
    // Round 4 -> escalates to 3 and locks (rule 9 floor), NOT re-derived from ADP (1 + 2 = 3
    // would coincidentally match here, so this also covers the "history takes priority" case
    // via the lockedForever flag it produces).
    expect(result.keeperSlotRound).toBe(3);
    expect(result.lockedForever).toBe(true);
  });
});
