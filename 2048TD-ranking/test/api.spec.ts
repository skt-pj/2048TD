import { env as runtimeEnv } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import worker from "../src/index";
import type { Env, RateLimiter } from "../src/types/api";

const PLAYER_A = "39bf127f-ec68-4c82-94e3-5f09b32242ba";
const PLAYER_B = "a01f6052-bf92-47b7-8603-ce456dcbca9d";
const MISSING_RUN = "be04ad51-bbca-45cb-8ba3-6b101671ac75";
const db = (runtimeEnv as unknown as { DB: D1Database }).DB;

class TestLimiter implements RateLimiter {
  constructor(private readonly allowed = Number.POSITIVE_INFINITY) {}
  private calls = 0;
  async limit(): Promise<{ success: boolean }> {
    this.calls += 1;
    return { success: this.calls <= this.allowed };
  }
}

function testEnv(limiter = new TestLimiter()): Env {
  return {
    DB: db,
    START_RATE_LIMITER: limiter,
    FINISH_RATE_LIMITER: limiter,
    LEADERBOARD_RATE_LIMITER: limiter,
  };
}

async function call(request: Request, env = testEnv()): Promise<Response> {
  return worker.fetch(
    request as Request<unknown, IncomingRequestCfProperties>,
    env,
  );
}

async function post(path: string, body: unknown, env = testEnv()): Promise<Response> {
  return call(
    new Request(`http://example.com${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    env,
  );
}

function startBody(playerId = PLAYER_A, rulesetVersion = 1): Record<string, unknown> {
  return {
    playerId,
    displayName: "プレイヤー",
    appVersion: "0.1.5",
    versionCode: 6,
    rulesetVersion,
  };
}

function finishBody(
  runId: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    runId,
    playerId: PLAYER_A,
    score: 18_432,
    wave: 17,
    maxTile: 512,
    elapsedMs: 463_221,
    gameOverReason: "HP_ZERO",
    appVersion: "0.1.5",
    versionCode: 6,
    rulesetVersion: 1,
    ...overrides,
  };
}

async function start(
  playerId = PLAYER_A,
  rulesetVersion = 1,
): Promise<{ response: Response; runId: string }> {
  const response = await post("/v1/runs/start", startBody(playerId, rulesetVersion));
  const body = (await response.clone().json()) as { runId: string };
  return { response, runId: body.runId };
}

async function finish(
  runId: string,
  overrides: Record<string, unknown> = {},
): Promise<Response> {
  return post("/v1/runs/finish", finishBody(runId, overrides));
}

beforeEach(async () => {
  await db.batch([
    db.prepare("DELETE FROM leaderboard"),
    db.prepare("DELETE FROM runs"),
  ]);
});

describe("2048TD ranking API", () => {
  it("returns the specified health response", async () => {
    const response = await call(new Request("http://example.com/v1/health"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      service: "2048td-ranking",
      apiVersion: 1,
    });
  });

  it("starts a run with 201 and stores it in D1", async () => {
    const { response, runId } = await start();
    expect(response.status).toBe(201);
    expect(runId).toMatch(/^[0-9a-f-]{36}$/);
    const row = await db.prepare("SELECT status FROM runs WHERE run_id = ?")
      .bind(runId)
      .first<{ status: string }>();
    expect(row?.status).toBe("STARTED");
  });

  it("finishes a run and creates the first best", async () => {
    const { runId } = await start();
    const response = await finish(runId);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      accepted: true,
      bestUpdated: true,
      score: 18_432,
      bestScore: 18_432,
      rank: 1,
    });
  });

  it("rejects duplicate finish with 409", async () => {
    const { runId } = await start();
    expect((await finish(runId)).status).toBe(200);
    const duplicate = await finish(runId);
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toMatchObject({ error: { code: "RUN_ALREADY_FINISHED" } });
  });

  it("returns 404 for a missing run", async () => {
    const response = await finish(MISSING_RUN);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: "RUN_NOT_FOUND" } });
  });

  it("returns 403 when playerId differs from the started run", async () => {
    const { runId } = await start();
    const response = await finish(runId, { playerId: PLAYER_B });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "PLAYER_MISMATCH" } });
  });

  it("returns 409 when rulesetVersion differs from the started run", async () => {
    const { runId } = await start();
    const response = await finish(runId, { rulesetVersion: 2 });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "RULESET_MISMATCH" } });
  });

  it.each([
    ["negative score", { score: -1 }, "INVALID_SCORE"],
    ["score above the maximum", { score: 2_147_483_648 }, "INVALID_SCORE"],
    ["non-power-of-two maxTile", { maxTile: 123 }, "INVALID_MAX_TILE"],
  ])("rejects %s", async (_name, override, code) => {
    const { runId } = await start();
    const response = await finish(runId, override);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code } });
  });

  it("accepts maxTile 0", async () => {
    const { runId } = await start();
    expect((await finish(runId, { maxTile: 0 })).status).toBe(200);
  });

  it("keeps a lower score and updates a higher score", async () => {
    const first = await start();
    await finish(first.runId, { score: 100, wave: 10, maxTile: 64 });
    const lower = await start();
    const lowerResponse = await finish(lower.runId, { score: 99, wave: 99, maxTile: 4096 });
    expect(await lowerResponse.json()).toMatchObject({ bestUpdated: false, bestScore: 100 });
    const higher = await start();
    const higherResponse = await finish(higher.runId, { score: 101, wave: 1, maxTile: 0 });
    expect(await higherResponse.json()).toMatchObject({ bestUpdated: true, bestScore: 101 });
  });

  it("updates ties only for higher wave then higher maxTile", async () => {
    const first = await start();
    await finish(first.runId, { score: 100, wave: 10, maxTile: 64 });
    const wave = await start();
    expect(
      await (await finish(wave.runId, { score: 100, wave: 11, maxTile: 32 })).json(),
    ).toMatchObject({ bestUpdated: true });
    const tile = await start();
    expect(
      await (await finish(tile.runId, { score: 100, wave: 11, maxTile: 128 })).json(),
    ).toMatchObject({ bestUpdated: true });
  });

  it("keeps achievedAt for a completely equal result", async () => {
    const first = await start();
    await finish(first.runId, { score: 100, wave: 10, maxTile: 64 });
    const before = await db.prepare(
      "SELECT achieved_at FROM leaderboard WHERE ruleset_version = ? AND player_id = ?",
    ).bind(1, PLAYER_A).first<{ achieved_at: number }>();
    const equal = await start();
    const response = await finish(equal.runId, { score: 100, wave: 10, maxTile: 64 });
    expect(await response.json()).toMatchObject({ bestUpdated: false });
    const after = await db.prepare(
      "SELECT achieved_at FROM leaderboard WHERE ruleset_version = ? AND player_id = ?",
    ).bind(1, PLAYER_A).first<{ achieved_at: number }>();
    expect(after?.achieved_at).toBe(before?.achieved_at);
  });

  it("separates leaderboard records by rulesetVersion", async () => {
    const one = await start(PLAYER_A, 1);
    await finish(one.runId, { score: 100, rulesetVersion: 1 });
    const two = await start(PLAYER_A, 2);
    await finish(two.runId, { score: 200, rulesetVersion: 2 });
    const response = await call(new Request("http://example.com/v1/leaderboard?rulesetVersion=1"));
    const body = (await response.json()) as { entries: Array<{ score: number }> };
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0]?.score).toBe(100);
  });

  it("orders by score, wave, maxTile, then achievedAt", async () => {
    const ids = [1, 2, 3, 4, 5].map(
      (n) => `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`,
    );
    const values = [
      [ids[0], 200, 1, 2, 5000],
      [ids[1], 100, 20, 2, 4000],
      [ids[2], 100, 10, 128, 3000],
      [ids[3], 100, 10, 64, 2000],
      [ids[4], 100, 10, 64, 1000],
    ] as const;
    await db.batch(
      values.map(([id, score, wave, tile, at]) =>
        db.prepare(
          `INSERT INTO leaderboard
           (ruleset_version, player_id, best_score, best_wave, best_max_tile,
            best_run_id, achieved_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(1, id, score, wave, tile, id, at, at),
      ),
    );
    const response = await call(new Request("http://example.com/v1/leaderboard?rulesetVersion=1"));
    const body = (await response.json()) as { entries: Array<{ playerId: string; rank: number }> };
    expect(body.entries.map((entry) => entry.playerId)).toEqual([
      ids[0],
      ids[1],
      ids[2],
      ids[4],
      ids[3],
    ]);
    expect(body.entries.map((entry) => entry.rank)).toEqual([1, 2, 3, 4, 5]);
  });

  it("defaults limit to 100 and caps values above 100", async () => {
    const statements = Array.from({ length: 101 }, (_, index) => {
      const id = `00000000-0000-4000-8000-${(index + 1).toString().padStart(12, "0")}`;
      return db.prepare(
        `INSERT INTO leaderboard
         (ruleset_version, player_id, best_score, best_wave, best_max_tile,
          best_run_id, achieved_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(1, id, index, 1, 0, id, index, index);
    });
    await db.batch(statements);
    for (const suffix of ["", "&limit=1000"]) {
      const response = await call(
        new Request(`http://example.com/v1/leaderboard?rulesetVersion=1${suffix}`),
      );
      const body = (await response.json()) as { entries: unknown[] };
      expect(body.entries).toHaveLength(100);
    }
  });

  it("returns the player's rank and returns null for an unregistered player", async () => {
    const { runId } = await start();
    await finish(runId);
    const ranked = await call(
      new Request(`http://example.com/v1/players/${PLAYER_A}/rank?rulesetVersion=1`),
    );
    expect(await ranked.json()).toMatchObject({
      rank: 1,
      totalPlayers: 1,
      bestScore: 18_432,
      wave: 17,
      maxTile: 512,
    });
    const missing = await call(
      new Request(`http://example.com/v1/players/${PLAYER_B}/rank?rulesetVersion=1`),
    );
    expect(await missing.json()).toEqual({ ok: true, rank: null, bestScore: null });
  });

  it("rejects invalid UUID and SQL injection input without executing it", async () => {
    const invalid = await post("/v1/runs/start", startBody("not-a-uuid"));
    expect(invalid.status).toBe(400);
    const injection = await post("/v1/runs/start", startBody("' OR 1=1; DROP TABLE runs;--"));
    expect(injection.status).toBe(400);
    const table = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type = ? AND name = ?",
    ).bind("table", "runs").first<{ name: string }>();
    expect(table?.name).toBe("runs");
  });

  it("returns 429 when a configured rate limiter rejects the request", async () => {
    const response = await post("/v1/runs/start", startBody(), testEnv(new TestLimiter(0)));
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ error: { code: "RATE_LIMITED" } });
  });

  it("does not expose stack traces, SQL, or binding names on internal errors", async () => {
    const brokenDb = {
      prepare(): never {
        throw new Error("SECRET SQL FROM DB binding stack");
      },
    } as unknown as D1Database;
    const response = await post("/v1/runs/start", startBody(), {
      ...testEnv(),
      DB: brokenDb,
    });
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).toBe(
      JSON.stringify({
        ok: false,
        error: { code: "INTERNAL_ERROR", message: "internal server error" },
      }),
    );
    expect(text).not.toContain("SECRET");
    expect(text).not.toContain("stack");
    expect(text).not.toContain("binding");
  });
});
