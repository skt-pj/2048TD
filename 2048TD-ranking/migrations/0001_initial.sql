CREATE TABLE runs (
    run_id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    display_name TEXT,
    ruleset_version INTEGER NOT NULL,
    app_version TEXT NOT NULL,
    version_code INTEGER NOT NULL,
    started_at INTEGER NOT NULL,
    finished_at INTEGER,
    score INTEGER,
    wave INTEGER,
    max_tile INTEGER,
    elapsed_ms INTEGER,
    game_over_reason TEXT,
    status TEXT NOT NULL DEFAULT 'STARTED'
        CHECK(status IN ('STARTED', 'FINISHED', 'REJECTED'))
);

CREATE TABLE leaderboard (
    ruleset_version INTEGER NOT NULL,
    player_id TEXT NOT NULL,
    display_name TEXT,
    best_score INTEGER NOT NULL,
    best_wave INTEGER NOT NULL,
    best_max_tile INTEGER NOT NULL,
    best_run_id TEXT NOT NULL,
    achieved_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (ruleset_version, player_id)
);

CREATE INDEX idx_leaderboard_rank
ON leaderboard (
    ruleset_version,
    best_score DESC,
    best_wave DESC,
    best_max_tile DESC,
    achieved_at ASC
);

CREATE INDEX idx_runs_player
ON runs (
    player_id,
    started_at DESC
);
