import { error } from "./http";
import { health } from "./routes/health";
import { leaderboard, playerRank } from "./routes/leaderboard";
import { finishRun, startRun } from "./routes/runs";
import type { Env } from "./types/api";

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/v1/health") return health();
  if (request.method === "POST" && url.pathname === "/v1/runs/start") {
    return startRun(request, env);
  }
  if (request.method === "POST" && url.pathname === "/v1/runs/finish") {
    return finishRun(request, env);
  }
  if (request.method === "GET" && url.pathname === "/v1/leaderboard") {
    return leaderboard(request, env);
  }
  const rankMatch = /^\/v1\/players\/([^/]+)\/rank$/.exec(url.pathname);
  if (request.method === "GET" && rankMatch?.[1] !== undefined) {
    return playerRank(request, env, decodeURIComponent(rankMatch[1]));
  }
  return error(404, "INVALID_REQUEST", "route was not found");
}

export default {
  async fetch(request, env): Promise<Response> {
    try {
      return await route(request, env);
    } catch {
      return error(500, "INTERNAL_ERROR", "internal server error");
    }
  },
} satisfies ExportedHandler<Env>;
