import { error } from "./http";
import { health } from "./routes/health";
import { leaderboard, playerRank } from "./routes/leaderboard";
import { finishRun, startRun } from "./routes/runs";
import type { Env } from "./types/api";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(CORS_HEADERS)) headers.set(name, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

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
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    try {
      return withCors(await route(request, env));
    } catch {
      return withCors(error(500, "INTERNAL_ERROR", "internal server error"));
    }
  },
} satisfies ExportedHandler<Env>;
