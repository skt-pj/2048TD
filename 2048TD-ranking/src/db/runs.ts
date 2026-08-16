export interface RunRow {
  run_id: string;
  player_id: string;
  display_name: string | null;
  ruleset_version: number;
  status: "STARTED" | "FINISHED" | "REJECTED";
}

export async function insertRun(
  db: D1Database,
  values: {
    runId: string;
    playerId: string;
    displayName: string | null;
    rulesetVersion: number;
    appVersion: string;
    versionCode: number;
    startedAt: number;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO runs (
        run_id, player_id, display_name, ruleset_version,
        app_version, version_code, started_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      values.runId,
      values.playerId,
      values.displayName,
      values.rulesetVersion,
      values.appVersion,
      values.versionCode,
      values.startedAt,
    )
    .run();
}

export async function findRun(db: D1Database, runId: string): Promise<RunRow | null> {
  return db
    .prepare(
      `SELECT run_id, player_id, display_name, ruleset_version, status
       FROM runs WHERE run_id = ?`,
    )
    .bind(runId)
    .first<RunRow>();
}
