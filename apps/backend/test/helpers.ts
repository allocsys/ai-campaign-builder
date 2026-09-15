import { env } from "cloudflare:test";
import { signJWT } from "../src/middleware/auth";
import type { JWTPayload } from "../src/middleware/auth";
import app from "../src/index";

export const TEST_JWT_SECRET = "test-jwt-secret-key-32-chars-long!!";

const migrationFiles = import.meta.glob("../migrations/*.sql", { query: "?raw", import: "default", eager: true });

function parseSqlStatements(sql: string): string[] {
  const noBlockComments = sql.replace(/\/\*[\s\S]*?\*\//g, "");
  const lines = noBlockComments.split("\n");
  const cleanLines = lines.map((line) => {
    const commentIndex = line.indexOf("--");
    if (commentIndex !== -1) {
      return line.slice(0, commentIndex);
    }
    return line;
  });

  const fullText = cleanLines.join("\n");
  return fullText
    .split(";")
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0);
}

export async function applyMigrations(): Promise<void> {
  const sortedKeys = Object.keys(migrationFiles).sort();
  for (const key of sortedKeys) {
    const sql = migrationFiles[key] as string;
    const statements = parseSqlStatements(sql);
    for (const stmt of statements) {
      await env.DB.prepare(stmt).run();
    }
  }
}

export function getTestEnv() {
  return {
    ...env,
    JWT_SECRET: TEST_JWT_SECRET,
  };
}

export async function generateTestToken(payload: {
  sub: string;
  role: JWTPayload["role"];
  businessId?: string;
  campaignId?: string;
  isRoot?: boolean;
}): Promise<string> {
  return await signJWT(payload, TEST_JWT_SECRET);
}

export async function makeAppRequest(
  path: string,
  init?: RequestInit,
  customEnv?: Record<string, unknown>,
  executionCtx?: { waitUntil: (promise: Promise<unknown>) => void }
): Promise<Response> {
  const testEnv = customEnv ?? getTestEnv();
  const ctx = executionCtx ?? { waitUntil: (promise: Promise<unknown>) => { promise.catch(() => {}); } };
  return await app.request(path, init, testEnv as any, ctx as any);
}
