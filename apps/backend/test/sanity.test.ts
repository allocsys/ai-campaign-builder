import { env } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";
import { applyMigrations, makeAppRequest } from "./helpers";

describe("Test Infrastructure & Setup", () => {
  beforeAll(async () => {
    await applyMigrations();
  });

  it("should have migrated all D1 tables", async () => {
    const tables = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const names = tables.results.map((t: any) => t.name);
    expect(names).toContain("business_owners");
    expect(names).toContain("customers");
    expect(names).toContain("campaigns");
    expect(names).toContain("task_submissions");
  });

  it("should respond to health endpoint", async () => {
    const res = await makeAppRequest("/health");
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string; service: string };
    expect(body.status).toBe("ok");
    expect(body.service).toBe("ai-campaign-builder-backend");
  });
});
