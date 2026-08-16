export interface LeaderboardRow {
  player_id: string;
  display_name: string | null;
  best_score: number;
  best_wave: number;
  best_max_tile: number;
  achieved_at: number;
}

export interface PlayerBestRow extends LeaderboardRow {
  total_players: number;
  rank: number;
}

export async function listLeaderboard(
  db: D1Database,
  rulesetVersion: number,
  limit: number,
): Promise<LeaderboardRow[]> {
  const result = await db
    .prepare(
      `SELECT player_id, display_name, best_score, best_wave, best_max_tile, achieved_at
       FROM leaderboard
       WHERE ruleset_version = ?
       ORDER BY best_score DESC, best_wave DESC, best_max_tile DESC, achieved_at ASC
       LIMIT ?`,
    )
    .bind(rulesetVersion, limit)
    .all<LeaderboardRow>();
  return result.results;
}

export async function getPlayerBest(
  db: D1Database,
  rulesetVersion: number,
  playerId: string,
): Promise<PlayerBestRow | null> {
  return db
    .prepare(
      `SELECT target.player_id, target.display_name, target.best_score,
              target.best_wave, target.best_max_tile, target.achieved_at,
              (SELECT COUNT(*) FROM leaderboard WHERE ruleset_version = ?) AS total_players,
              1 + (
                SELECT COUNT(*) FROM leaderboard other
                WHERE other.ruleset_version = target.ruleset_version
                  AND (
                    other.best_score > target.best_score OR
                    (other.best_score = target.best_score AND other.best_wave > target.best_wave) OR
                    (other.best_score = target.best_score AND other.best_wave = target.best_wave
                      AND other.best_max_tile > target.best_max_tile) OR
                    (other.best_score = target.best_score AND other.best_wave = target.best_wave
                      AND other.best_max_tile = target.best_max_tile
                      AND other.achieved_at < target.achieved_at)
                  )
              ) AS rank
       FROM leaderboard target
       WHERE target.ruleset_version = ? AND target.player_id = ?`,
    )
    .bind(rulesetVersion, rulesetVersion, playerId)
    .first<PlayerBestRow>();
}
