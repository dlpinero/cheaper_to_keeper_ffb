import { describe, expect, it } from 'vitest';
import { computeKeeperOption } from '../index';
import { qualifiesForInjuryExemption } from '../injuryExemption';
import { validateKeeperSelection } from '../validateSelection';
import type { SelectionPick } from '../validateSelection';
import type { LineageEntry } from '../types';

describe('rule 6: injury exemption', () => {
  it('qualifies at exactly 8 games missed, not below', () => {
    expect(qualifiesForInjuryExemption(7)).toBe(false);
    expect(qualifiesForInjuryExemption(8)).toBe(true);
    expect(qualifiesForInjuryExemption(9)).toBe(true);
  });

  it('2 normal keepers is always allowed with no exemption involved', () => {
    const picks: SelectionPick[] = [
      { playerId: 'a', eligible: true, usesInjuryExemptionSlot: false },
      { playerId: 'b', eligible: true, usesInjuryExemptionSlot: false },
    ];
    expect(validateKeeperSelection(picks).valid).toBe(true);
  });

  it('3 keepers with none using the exemption slot is invalid', () => {
    const picks: SelectionPick[] = [
      { playerId: 'a', eligible: true, usesInjuryExemptionSlot: false },
      { playerId: 'b', eligible: true, usesInjuryExemptionSlot: false },
      { playerId: 'c', eligible: true, usesInjuryExemptionSlot: false },
    ];
    const result = validateKeeperSelection(picks);
    expect(result.valid).toBe(false);
    expect(result.errors.join()).toMatch(/injury exemption/i);
  });

  it('3 keepers with exactly one using the exemption slot is valid', () => {
    const picks: SelectionPick[] = [
      { playerId: 'a', eligible: true, usesInjuryExemptionSlot: false },
      { playerId: 'b', eligible: true, usesInjuryExemptionSlot: false },
      { playerId: 'c', eligible: true, usesInjuryExemptionSlot: true },
    ];
    expect(validateKeeperSelection(picks).valid).toBe(true);
  });

  it('the exemption is not capped to a single player — all 3 kept players can independently qualify', () => {
    const picks: SelectionPick[] = [
      { playerId: 'a', eligible: true, usesInjuryExemptionSlot: true },
      { playerId: 'b', eligible: true, usesInjuryExemptionSlot: true },
      { playerId: 'c', eligible: true, usesInjuryExemptionSlot: true },
    ];
    expect(validateKeeperSelection(picks).valid).toBe(true);
  });

  it('a 4th keeper is never allowed, even with multiple qualifying players', () => {
    const picks: SelectionPick[] = [
      { playerId: 'a', eligible: true, usesInjuryExemptionSlot: true },
      { playerId: 'b', eligible: true, usesInjuryExemptionSlot: true },
      { playerId: 'c', eligible: true, usesInjuryExemptionSlot: true },
      { playerId: 'd', eligible: true, usesInjuryExemptionSlot: true },
    ];
    const result = validateKeeperSelection(picks);
    expect(result.valid).toBe(false);
    expect(result.errors.join()).toMatch(/cannot keep more than 3/i);
  });

  it('a round 4+ exemption freezes the round for one year, then escalation resumes next year off that round', () => {
    const draftedRound4: LineageEntry = {
      playerId: 'x',
      seasonYear: 2025,
      slotRound: 4,
      origin: 'drafted',
      lockedForever: false,
    };

    // 2025 season: 9 games missed, exemption approved -> 2026 slot is frozen at round 4,
    // not escalated to round 3.
    const kept2026 = computeKeeperOption(
      { playerId: 'x', history: [draftedRound4] },
      { rosterContinuityEligible: true, gamesMissed: 9, injuryExemptionApproved: true },
    );
    expect(kept2026.eligible).toBe(true);
    expect(kept2026.keeperSlotRound).toBe(4);
    expect(kept2026.usesInjuryExemptionSlot).toBe(true);
    expect(kept2026.lockedForever).toBe(false);

    const lineage2026: LineageEntry = {
      playerId: 'x',
      seasonYear: 2026,
      slotRound: 4,
      origin: 'kept_injury_exempt',
      lockedForever: false,
    };

    // 2026 season: no games missed, no exemption -> 2027 escalates normally off the frozen
    // round 4 (rule 4/5 bracket), landing on round 3.
    const kept2027 = computeKeeperOption(
      { playerId: 'x', history: [draftedRound4, lineage2026] },
      { rosterContinuityEligible: true, gamesMissed: 0, injuryExemptionApproved: false },
    );
    expect(kept2027.eligible).toBe(true);
    expect(kept2027.keeperSlotRound).toBe(3);
    expect(kept2027.usesInjuryExemptionSlot).toBe(false);
  });
});
