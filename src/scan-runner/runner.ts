import { DurableObject } from "cloudflare:workers";
import type { Env } from "../index";
import type { Finding } from "../types";
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

  async scanToFindings(
    language: string,
    files: { path: string; content: string }[],
  ): Promise<Finding[]> {
    const raw = await this.scanFn(files, language);
    return normalizeSemgrep(raw);
  }

  // Full orchestration entrypoint (wired in Task 12).
  async runScan(_scanId: string): Promise<void> {
    // Implemented incrementally; Task 12 fills the R2 load + triage + report calls.
    throw new Error("runScan wired in Task 12");
  }

  // Stub: replaced by Container.containerFetch in production.
  protected containerFetch(_req: Request): Promise<Response> {
    throw new Error("containerFetch not available (no container runtime in test env)");
  }
}
