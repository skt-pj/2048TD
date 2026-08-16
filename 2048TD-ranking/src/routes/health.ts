import { json } from "../http";

export function health(): Response {
  return json({ ok: true, service: "2048td-ranking", apiVersion: 1 });
}
