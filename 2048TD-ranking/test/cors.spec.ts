import { describe, expect, it } from "vitest";
import worker from "../src/index";
import type { Env } from "../src/types/api";

const env = {} as Env;

async function call(request: Request): Promise<Response> {
  return worker.fetch(
    request as Request<unknown, IncomingRequestCfProperties>,
    env,
  );
}

describe("ranking API CORS", () => {
  it("answers browser preflight requests", async () => {
    const response = await call(new Request("http://example.com/v1/runs/start", {
      method: "OPTIONS",
      headers: {
        Origin: "https://skt-pj.github.io",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    }));

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Content-Type");
  });

  it("adds CORS headers to normal responses", async () => {
    const response = await call(new Request("http://example.com/v1/health", {
      headers: { Origin: "https://skt-pj.github.io" },
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
