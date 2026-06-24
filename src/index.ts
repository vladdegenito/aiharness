import { Hono } from "hono";
import { api } from "./orchestrator/routes";

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

app.route("/api", api);
app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw)); // serve the UI

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<{ scanId: string }>, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      const stub = env.SCAN_RUNNER.get(env.SCAN_RUNNER.idFromName(msg.body.scanId));
      await stub.runScan(msg.body.scanId);
      msg.ack();
    }
  },
};
