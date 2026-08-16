import { getPlayerBest } from "../db/leaderboard";
import { findRun, insertRun } from "../db/runs";
import { error, json, readJsonObject } from "../http";
import type { Env, FinishRunRequest, StartRunRequest } from "../types/api";
import { isDisplayName, isUuidV4 } from "../validation/player";
import {
  isAppVersion,
  isGameOverReason,
  isMaxTile,
  isNonNegativeInteger,
  isPositiveInteger,
  isScore,
} from "../validation/score";

function parseStart(body: Record<string, unknown>): StartRunRequest | Response {
  if (!isUuidV4(body.playerId)) {
    return error(400, "INVALID_PLAYER_ID", "playerId is invalid");
  }
  if (!isDisplayName(body.displayName)) {
    return error(400, "INVALID_REQUEST", "displayName is invalid");
  }
  if (
    !isAppVersion(body.appVersion) ||
    !isPositiveInteger(body.versionCode) ||
    !isPositiveInteger(body.rulesetVersion)
  ) {
    return error(400, "INVALID_REQUEST", "request is invalid");
  }
  return {
    playerId: body.playerId,
    displayName: body.displayName,
    appVersion: body.appVersion,
    versionCode: body.versionCode,
    rulesetVersion: body.rulesetVersion,
  };
}

function validateFinishValues(body: Record<string, unknown>): FinishRunRequest | Response {
  if (!isScore(body.score)) {
    return error(400, "INVALID_SCORE", "score is invalid");
  }
  if (!isMaxTile(body.maxTile)) {
    return error(400, "INVALID_MAX_TILE", "maxTile is invalid");
  }
  if (
    !isPositiveInteger(body.wave) ||
    !isNonNegativeInteger(body.elapsedMs) ||
    !isGameOverReason(body.gameOverReason) ||
    !isAppVersion(body.appVersion) ||
    !isPositiveInteger(body.versionCode)
  ) {
    return error(400, "INVALID_REQUEST", "request is invalid");
  }
  return body as unknown as FinishRunRequest;
}

export async function startRun(request: Request, env: Env): Promise<Response> {
  const body = await readJsonObject(request);
  if (body === null) return error(400, "INVALID_REQUEST", "request is invalid");
  const parsed = parseStart(body);
  if (parsed instanceof Response) return parsed;

  const rate = await env.START_RATE_LIMITER.limit({ key: parsed.playerId });
  if (!rate.success) return error(429, "RATE_LIMITED", "rate limit exceeded");

  const runId = crypto.randomUUID();
  const startedAt = Date.now();
  await insertRun(env.DB, {
    runId,
    playerId: parsed.playerId,
    displayName: parsed.displayName ?? null,
    rulesetVersion: parsed.rulesetVersion,
    appVersion: parsed.appVersion,
    versionCode: parsed.versionCode,
    startedAt,
  });

  return json(
    {
      ok: true,
      runId,
      startedAt: new Date(startedAt).toISOString(),
      rulesetVersion: parsed.rulesetVersion,
    },
    201,
  );
}

export async function finishRun(request: Request, env: Env): Promise<Response> {
  const body = await readJsonObject(request);
  if (body === null) return error(400, "INVALID_REQUEST", "request is invalid");
  if (!isUuidV4(body.runId)) return error(400, "INVALID_RUN_ID", "runId is invalid");

  const rateKey = typeof body.playerId === "string" ? body.playerId : "invalid-player";
  const rate = await env.FINISH_RATE_LIMITER.limit({ key: rateKey });
  if (!rate.success) return error(429, "RATE_LIMITED", "rate limit exceeded");

  const run = await findRun(env.DB, body.runId);
  if (run === null) return error(404, "RUN_NOT_FOUND", "run was not found");
  if (run.status !== "STARTED") {
    return error(409, "RUN_ALREADY_FINISHED", "run is already finished");
  }
  if (body.playerId !== run.player_id) {
    return error(403, "PLAYER_MISMATCH", "playerId does not match run");
  }
  if (!isUuidV4(body.playerId)) {
    return error(400, "INVALID_PLAYER_ID", "playerId is invalid");
  }
  if (!isPositiveInteger(body.rulesetVersion)) {
    return error(400, "INVALID_REQUEST", "rulesetVersion is invalid");
  }
  if (body.rulesetVersion !== run.ruleset_version) {
    return error(409, "RULESET_MISMATCH", "rulesetVersion does not match run");
  }
  const parsed = validateFinishValues(body);
  if (parsed instanceof Response) return parsed;

  const finishedAt = Date.now();
  const updateRun = env.DB.prepare(
    `UPDATE runs
     SET finished_at = ?, score = ?, wave = ?, max_tile = ?, elapsed_ms = ?,
         game_over_reason = ?, status = 'FINISHED'
     WHERE run_id = ? AND status = 'STARTED'`,
  ).bind(
    finishedAt,
    parsed.score,
    parsed.wave,
    parsed.maxTile,
    parsed.elapsedMs,
    parsed.gameOverReason,
    parsed.runId,
  );
  const upsertBest = env.DB.prepare(
    `INSERT INTO leaderboard (
       ruleset_version, player_id, display_name, best_score, best_wave,
       best_max_tile, best_run_id, achieved_at, updated_at
     )
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
     WHERE changes() = 1
     ON CONFLICT(ruleset_version, player_id) DO UPDATE SET
       display_name = excluded.display_name,
       best_score = excluded.best_score,
       best_wave = excluded.best_wave,
       best_max_tile = excluded.best_max_tile,
       best_run_id = excluded.best_run_id,
       achieved_at = excluded.achieved_at,
       updated_at = excluded.updated_at
     WHERE excluded.best_score > leaderboard.best_score
        OR (excluded.best_score = leaderboard.best_score
            AND excluded.best_wave > leaderboard.best_wave)
        OR (excluded.best_score = leaderboard.best_score
            AND excluded.best_wave = leaderboard.best_wave
            AND excluded.best_max_tile > leaderboard.best_max_tile)`,
  ).bind(
    parsed.rulesetVersion,
    parsed.playerId,
    run.display_name,
    parsed.score,
    parsed.wave,
    parsed.maxTile,
    parsed.runId,
    finishedAt,
    finishedAt,
  );

  const [runResult, bestResult] = await env.DB.batch([updateRun, upsertBest]);
  if (runResult === undefined || bestResult === undefined) {
    throw new Error("D1 batch returned an incomplete result");
  }
  if ((runResult.meta.changes ?? 0) !== 1) {
    return error(409, "RUN_ALREADY_FINISHED", "run is already finished");
  }

  const best = await getPlayerBest(env.DB, parsed.rulesetVersion, parsed.playerId);
  if (best === null) throw new Error("leaderboard update failed");

  return json({
    ok: true,
    accepted: true,
    bestUpdated: (bestResult.meta.changes ?? 0) === 1,
    score: parsed.score,
    bestScore: best.best_score,
    rank: best.rank,
  });
}
