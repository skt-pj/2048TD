export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  DB: D1Database;
  START_RATE_LIMITER: RateLimiter;
  FINISH_RATE_LIMITER: RateLimiter;
  LEADERBOARD_RATE_LIMITER: RateLimiter;
}

export type ApiErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_PLAYER_ID"
  | "INVALID_RUN_ID"
  | "INVALID_SCORE"
  | "INVALID_MAX_TILE"
  | "RUN_NOT_FOUND"
  | "RUN_ALREADY_FINISHED"
  | "PLAYER_MISMATCH"
  | "RULESET_MISMATCH"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export interface StartRunRequest {
  playerId: string;
  displayName?: string | null;
  appVersion: string;
  versionCode: number;
  rulesetVersion: number;
}

export interface FinishRunRequest {
  runId: string;
  playerId: string;
  score: number;
  wave: number;
  maxTile: number;
  elapsedMs: number;
  gameOverReason: "HP_ZERO" | "BOARD_STUCK";
  appVersion: string;
  versionCode: number;
  rulesetVersion: number;
}
