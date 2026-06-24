import { env, applyD1Migrations } from "cloudflare:test";
import { beforeAll, describe, it, expect } from "vitest";
import { createScan, getScan, setScanStatus, storeJobKey, getJobKey, deleteJobKey } from "../../src/db/queries";

beforeAll(async () => {
  // @ts-expect-error provided by vitest-pool-workers test bindings
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe("db queries", () => {
  it("creates and reads a scan, updates status", async () => {
    await createScan(env.DB, {
      id: "s1", language: "python", status: "queued",
      sourceKey: "src/s1.tar", modelId: "claude", modelVersion: "claude-opus-4-8",
    });
    let scan = await getScan(env.DB, "s1");
    expect(scan?.status).toBe("queued");
    await setScanStatus(env.DB, "s1", "scanning");
    scan = await getScan(env.DB, "s1");
    expect(scan?.status).toBe("scanning");
  });

  it("stores, reads, and deletes a job key", async () => {
    await createScan(env.DB, {
      id: "s2", language: "python", status: "queued",
      sourceKey: "src/s2.tar", modelId: "claude", modelVersion: "claude-opus-4-8",
    });
    await storeJobKey(env.DB, "s2", "CIPHERTEXT");
    expect(await getJobKey(env.DB, "s2")).toBe("CIPHERTEXT");
    await deleteJobKey(env.DB, "s2");
    expect(await getJobKey(env.DB, "s2")).toBeNull();
  });
});
