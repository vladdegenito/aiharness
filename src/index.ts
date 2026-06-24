import { Hono } from "hono";

export { ScanRunner } from "./scan-runner/runner";

export interface Env {
  DB: D1Database;
  SOURCE: R2Bucket;
  SCAN_QUEUE: Queue;
  SCAN_RUNNER: DurableObjectNamespace;
  ASSETS: Fetcher;
  KEK: string;
}

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ status: "ok" }));

export default {
  fetch: app.fetch,
};
