import { getPlayerBest, listLeaderboard } from "../db/leaderboard";
import { error, json } from "../http";
import type { Env } from "../types/api";
import { isUuidV4 } from "../validation/player";
import { isPositiveInteger } from "../validation/score";

function parsePositiveInteger(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return isPositiveInteger(parsed) ? parsed : null;
}

export async function leaderboard(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const rulesetVersion = parsePositiveInteger(url.searchParams.get("rulesetVersion"));
  if (rulesetVersion === null) {
    return error(400, "INVALID_REQUEST", "rulesetVersion is invalid");
  }

  const rawLimit = url.searchParams.get("limit");
  const parsedLimit = rawLimit === null ? 100 : parsePositiveInteger(rawLimit);
  if (parsedLimit === null) return error(400, "INVALID_REQUEST", "limit is invalid");
  const limit = Math.min(parsedLimit, 100);

  const rate = await env.LEADERBOARD_RATE_LIMITER.limit({
    key: `${url.pathname}:${rulesetVersion}`,
  });
  if (!rate.success) return error(429, "RATE_LIMITED", "rate limit exceeded");

  const rows = await listLeaderboard(env.DB, rulesetVersion, limit);
  return json({
    ok: true,
    rulesetVersion,
    entries: rows.map((row, index) => ({
      rank: index + 1,
      playerId: row.player_id,
      displayName: row.display_name ?? "Anonymous",
      score: row.best_score,
      wave: row.best_wave,
      maxTile: row.best_max_tile,
      achievedAt: new Date(row.achieved_at).toISOString(),
    })),
  });
}

export async function playerRank(
  request: Request,
  env: Env,
  playerId: string,
): Promise<Response> {
  if (!isUuidV4(playerId)) return error(400, "INVALID_PLAYER_ID", "playerId is invalid");
  const rulesetVersion = parsePositiveInteger(
    new URL(request.url).searchParams.get("rulesetVersion"),
  );
  if (rulesetVersion === null) {
    return error(400, "INVALID_REQUEST", "rulesetVersion is invalid");
  }

  const best = await getPlayerBest(env.DB, rulesetVersion, playerId);
  if (best === null) return json({ ok: true, rank: null, bestScore: null });
  return json({
    ok: true,
    rank: best.rank,
    totalPlayers: best.total_players,
    bestScore: best.best_score,
    wave: best.best_wave,
    maxTile: best.best_max_tile,
  });
}
