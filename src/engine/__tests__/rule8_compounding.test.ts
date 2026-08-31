import { describe, expect, it } from 'vitest';
import { computeKeeperOption } from '../index';
import type { LineageEntry } from '../types';

describe('rule 8: compounding escalates off last keeper slot, not the original draft round', () => {
  it('worked example: drafted round 8 (2024) -> kept round 6 (2025) -> kept round 5 (2026)', () => {
    const draftedIn2024: LineageEntry = {
      playerId: 'p1',
      seasonYear: 2024,
      slotRound: 8,
      origin: 'drafted',
      lockedForever: false,
    };

    const for2025 = computeKeeperOption(
      { playerId: 'p1', history: [draftedIn2024] },
      { rosterContinuityEligible: true, gamesMissed: 0, injuryExemptionApproved: false },
    );
    expect(for2025.keeperSlotRound).toBe(6); // 8 - 2, still in the 8+ bracket

    const keptIn2025: LineageEntry = {
      playerId: 'p1',
      seasonYear: 2025,
      slotRound: for2025.keeperSlotRound!,
      origin: 'kept_normal',
      lockedForever: false,
    };

    const for2026 = computeKeeperOption(
      // Deliberately include the original 2024 entry too — the engine must pick the most
      // recent one (2025, round 6) as the reference, not the original round 8.
      { playerId: 'p1', history: [draftedIn2024, keptIn2025] },
      { rosterContinuityEligible: true, gamesMissed: 0, injuryExemptionApproved: false },
    );
    // Reference round is now 6, which falls in the 4-7 bracket -> -1, not the 8+ bracket.
    expect(for2026.keeperSlotRound).toBe(5);
  });
});
