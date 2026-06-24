import { DurableObject } from "cloudflare:workers";
import type { Env } from "../index";
import type { Finding } from "../types";
import type { ModelAdapter } from "../adapters/model-adapter";
import { ClaudeAdapter } from "../adapters/claude";
import { normalizeSemgrep } from "./semgrep-normalize";

// NOTE (minimal adjustment, per task brief): ScanRunner extends DurableObject rather
// than @cloudflare/containers Container because the Container constructor throws
// "Container is not enabled" when ctx.container is undefined — which is always
// the case under vitest-pool-workers.  In production (real workerd with containers
// enabled) this class should extend Container<Env> and remove the stub containerFetch.
// All public surface area is identical for tests: scanFn is overridable, scanToFindings
// normalizes output, runScan is the Task-12 placeholder.

export class ScanRunner extends DurableObject<Env> {
  defaultPort = 8080;
  sleepAfter = "2m";

  // Production implementation calls the Semgrep container.
  // Tests override this property before calling scanToFindings.
  scanFn = async (
    files: { path: string; content: string }[],
    language: string,
  ): Promise<unknown> => {
    // Calls the container's /scan endpoint (production path).
    const res = await this.containerFetch(
      new Request("http://container/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language, files }),
      }),
    );
    return res.json();
  };

  // overridable in tests — model adapter factory
  makeAdapter: (apiKey: string) => ModelAdapter = (apiKey) => new ClaudeAdapter(apiKey);

  async scanToFindings(
    language: string,
    files: { path: string; content: string }[],
  ): Promise<Finding[]> {
    const raw = await this.scanFn(files, language);
    return normalizeSemgrep(raw);
  }

  async runScan(scanId: string): Promise<void> {
    const { getScan, setScanStatus, setScanSarifKey, insertFindings, getJobKey, deleteJobKey } = await import("../db/queries");
    const { decryptKey } = await import("../crypto/envelope");
    const { triageFindings } = await import("../triage/engine");
    const { buildSarif } = await import("../report/sarif");
    const { recordAudit, hashPrompt } = await import("../report/audit");
    const { SYSTEM_PROMPT } = await import("../adapters/model-adapter");

    const env = this.env;
    try {
      const scan = await getScan(env.DB, scanId);
      if (!scan) throw new Error("scan not found");
      await setScanStatus(env.DB, scanId, "scanning");

      const obj = await env.SOURCE.get(scan.sourceKey);
      const { language, files } = JSON.parse(await obj!.text());

      const findings = await this.scanToFindings(language, files);

      await setScanStatus(env.DB, scanId, "triaging");
      const envelope = await getJobKey(env.DB, scanId);
      const apiKey = await decryptKey(env.KEK, envelope!);
      const adapter = this.makeAdapter(apiKey);
      const triaged = await triageFindings(findings, adapter, (f) => f.snippet);

      await insertFindings(env.DB, scanId, triaged);
      const sarif = buildSarif(triaged, { toolVersion: "0.0.1" });
      const sarifKey = `sarif/${scanId}.json`;
      await env.SOURCE.put(sarifKey, JSON.stringify(sarif));
      await setScanSarifKey(env.DB, scanId, sarifKey);

      await recordAudit(env.DB, scanId, {
        modelId: "claude", modelVersion: scan.modelVersion,
        promptHash: await hashPrompt(SYSTEM_PROMPT), rulesetVersion: "p/default",
      });
    } finally {
      await deleteJobKey(env.DB, scanId);                 // always shred the key
      await setScanStatus(env.DB, scanId, "completed");
      await env.SOURCE.delete(`source/${scanId}.json`).catch(() => {});  // TTL: drop source
    }
  }

  // Stub: replaced by Container.containerFetch in production.
  protected containerFetch(_req: Request): Promise<Response> {
    throw new Error("containerFetch not available (no container runtime in test env)");
  }
}
