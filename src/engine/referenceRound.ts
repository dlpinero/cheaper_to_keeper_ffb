import type { LineageEntry } from './types';

/** Walks a player's lineage history back to the most recent entry — the reference point
 *  every escalation/lock decision is computed from (rule 8: never the original draft round). */
export function getReferenceLineageEntry(history: LineageEntry[]): LineageEntry | null {
  if (history.length === 0) return null;
  return history.reduce((latest, entry) => (entry.seasonYear > latest.seasonYear ? entry : latest));
}
