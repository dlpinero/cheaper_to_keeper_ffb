export const INJURY_EXEMPTION_MIN_GAMES_MISSED = 8;

/** Rule 6: missing 8+ games in the regular season is the games-missed half of exemption
 *  eligibility. Commissioner approval (the other half) is passed in separately by the caller. */
export function qualifiesForInjuryExemption(gamesMissed: number): boolean {
  return gamesMissed >= INJURY_EXEMPTION_MIN_GAMES_MISSED;
}
