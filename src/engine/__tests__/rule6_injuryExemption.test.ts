import { describe, expect, it } from 'vitest';
import { qualifiesForInjuryExemption } from '../injuryExemption';
import { validateKeeperSelection } from '../validateSelection';
import type { SelectionPick } from '../validateSelection';

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
});
