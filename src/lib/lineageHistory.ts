import type { LineageEntry } from '../engine/types';
import type { KeeperLineage } from '../types/database';

/** Groups keeper_lineage rows into per-player history, sorted oldest-to-newest, the shape
 *  the engine's computeKeeperOption expects. Shared by the commissioner preview and the
 *  manager keeper portal so both compute eligibility the same way. */
export function buildLineageHistory(
  lineage: KeeperLineage[],
  seasonYearById: Map<string, number>,
): Map<string, LineageEntry[]> {
  const historyByPlayer = new Map<string, LineageEntry[]>();
  for (const entry of lineage) {
    const year = seasonYearById.get(entry.season_id);
    if (year === undefined) continue;
    const mapped: LineageEntry = {
      playerId: entry.player_id,
      seasonYear: year,
      slotRound: entry.slot_round,
      origin: entry.origin,
      lockedForever: entry.locked_forever,
    };
    const list = historyByPlayer.get(entry.player_id) ?? [];
    list.push(mapped);
    historyByPlayer.set(entry.player_id, list);
  }
  for (const list of historyByPlayer.values()) {
    list.sort((a, b) => a.seasonYear - b.seasonYear);
  }
  return historyByPlayer;
}
