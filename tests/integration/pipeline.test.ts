import { env, runInDurableObject, applyD1Migrations } from "cloudflare:test";
import { beforeAll, describe, it, expect } from "vitest";
import semgrep from "../../fixtures/semgrep-output.json";
import type { ModelAdapter } from "../../src/adapters/model-adapter";

beforeAll(async () => {
  // @ts-expect-error test migrations
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

const fakeAdapter: ModelAdapter = {
  id: "fake",
  capabilities: { maxContextTokens: 1000, supportsStructuredOutput: true, supportsSeed: false },
  analyze: async () => ({ verdict: "confirmed", severity: "high", explanation: "ok", remediation: "fix it" }),
};

describe("end-to-end pipeline (mocked container + model)", () => {
  it("scans, triages, persists findings, deletes the key, writes SARIF", async () => {
    const { createScan, storeJobKey, getFindings, getJobKey } = await import("../../src/db/queries");
    const { encryptKey } = await import("../../src/crypto/envelope");

    const id = "int1";
    await env.SOURCE.put(`source/${id}.json`, JSON.stringify({ language: "python", files: [{ path: "app.py", content: "subprocess.call(cmd, shell=True)" }] }));
    await createScan(env.DB, { id, language: "python", status: "queued", sourceKey: `source/${id}.json`, modelId: "claude", modelVersion: "claude-opus-4-8" });
    await storeJobKey(env.DB, id, await encryptKey(env.KEK, "sk-ant-test"));

    const stub = env.SCAN_RUNNER.get(env.SCAN_RUNNER.idFromName(id));
    await runInDurableObject(stub, async (instance: any) => {
      instance.scanFn = async () => semgrep;          // fake container
      instance.makeAdapter = () => fakeAdapter;       // fake model, no network
      await instance.runScan(id);
    });

    const findings = await getFindings(env.DB, id);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(await getJobKey(env.DB, id)).toBeNull();                  // key shredded
    const sarif = await env.SOURCE.get(`sarif/${id}.json`);
    expect(sarif).not.toBeNull();
  });
});
