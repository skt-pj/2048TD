const RANKING_API_BASE = "https://2048td-ranking.yukigbr3100.workers.dev";
const QUEUE_KEY = "2048td-ranking-pending-v1";
const MAX_QUEUE = 16;
const STALE_START_MS = 24 * 60 * 60 * 1000;

const nativeFetch = globalThis.fetch?.bind(globalThis);
let flushPromise = null;

function createUuidV4() {
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

function readJsonBody(options) {
  if (typeof options?.body !== "string") return null;
  try {
    const value = JSON.parse(options.body);
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function loadQueue() {
  try {
    const raw = globalThis.localStorage?.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed.filter((item) => {
      if (!item || typeof item !== "object") return false;
      if (typeof item.localRunId !== "string") return false;
      if (!item.finishBody && now - (Number(item.createdAt) || 0) > STALE_START_MS) return false;
      return true;
    }).slice(-MAX_QUEUE);
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  try {
    globalThis.localStorage?.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
  } catch {
    // Best effort. The normal ranking controller still reports the network failure.
  }
}

function queuedStartResponse(localRunId, startBody) {
  return new Response(JSON.stringify({
    ok: true,
    runId: localRunId,
    startedAt: new Date().toISOString(),
    rulesetVersion: Number(startBody?.rulesetVersion) || 1,
    queued: true,
  }), {
    status: 201,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

async function readResponseJson(response) {
  try { return await response.clone().json(); } catch { return null; }
}

function apiPath(input) {
  try {
    const raw = input instanceof Request ? input.url : String(input);
    const url = new URL(raw, globalThis.location?.href);
    if (url.origin !== RANKING_API_BASE) return null;
    return url.pathname + url.search;
  } catch {
    return null;
  }
}

function queueStart(startBody) {
  const queue = loadQueue();
  const localRunId = createUuidV4();
  queue.push({
    localRunId,
    serverRunId: null,
    startBody,
    finishBody: null,
    createdAt: Date.now(),
  });
  saveQueue(queue);
  return localRunId;
}

function queueFinish(finishBody) {
  const queue = loadQueue();
  const runId = String(finishBody?.runId ?? "");
  if (!runId) return;
  let item = queue.find((entry) => entry.localRunId === runId || entry.serverRunId === runId);
  if (!item) {
    item = {
      localRunId: runId,
      serverRunId: runId,
      startBody: null,
      finishBody: null,
      createdAt: Date.now(),
    };
    queue.push(item);
  }
  item.finishBody = { ...finishBody };
  saveQueue(queue);
}

async function replayEntry(entry) {
  if (!nativeFetch || !entry.finishBody) return false;

  if (!entry.serverRunId) {
    if (!entry.startBody) return false;
    const startResponse = await nativeFetch(`${RANKING_API_BASE}/v1/runs/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry.startBody),
    });
    const startJson = await readResponseJson(startResponse);
    if (!startResponse.ok || startJson?.ok !== true || typeof startJson.runId !== "string") return false;
    entry.serverRunId = startJson.runId;
  }

  const finishBody = { ...entry.finishBody, runId: entry.serverRunId };
  const finishResponse = await nativeFetch(`${RANKING_API_BASE}/v1/runs/finish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(finishBody),
  });
  const finishJson = await readResponseJson(finishResponse);
  if (finishResponse.ok && finishJson?.ok === true) return true;
  if (finishResponse.status === 409 && finishJson?.error?.code === "RUN_ALREADY_FINISHED") return true;
  return false;
}

export function flushPendingRankingScores() {
  if (!nativeFetch) return Promise.resolve(false);
  if (flushPromise) return flushPromise;

  flushPromise = (async () => {
    const queue = loadQueue();
    let changed = false;
    while (queue.length) {
      const entry = queue[0];
      if (!entry.finishBody) break;
      try {
        const completed = await replayEntry(entry);
        if (!completed) break;
      } catch {
        break;
      }
      queue.shift();
      changed = true;
      saveQueue(queue);
    }
    if (changed) saveQueue(queue);
    return changed;
  })().finally(() => {
    flushPromise = null;
  });

  return flushPromise;
}

if (nativeFetch) {
  globalThis.fetch = async (input, options = {}) => {
    const path = apiPath(input);
    if (path === null) return nativeFetch(input, options);

    const method = String(options?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

    if (method === "POST" && path.startsWith("/v1/runs/start")) {
      try {
        return await nativeFetch(input, options);
      } catch (error) {
        const startBody = readJsonBody(options);
        if (!startBody) throw error;
        const localRunId = queueStart(startBody);
        return queuedStartResponse(localRunId, startBody);
      }
    }

    if (method === "POST" && path.startsWith("/v1/runs/finish")) {
      const finishBody = readJsonBody(options);
      const queue = loadQueue();
      const runId = String(finishBody?.runId ?? "");
      const locallyStarted = queue.some((entry) => entry.localRunId === runId && !entry.serverRunId);
      if (locallyStarted && finishBody) {
        queueFinish(finishBody);
        void flushPendingRankingScores();
        throw new TypeError("RANKING_SCORE_QUEUED_FOR_SYNC");
      }
      try {
        return await nativeFetch(input, options);
      } catch (error) {
        if (finishBody) {
          queueFinish(finishBody);
          void flushPendingRankingScores();
        }
        throw error;
      }
    }

    if (method === "GET") await flushPendingRankingScores();
    return nativeFetch(input, options);
  };

  globalThis.addEventListener?.("online", () => { void flushPendingRankingScores(); });
  setTimeout(() => { void flushPendingRankingScores(); }, 0);
}
