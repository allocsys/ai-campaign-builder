import type { D1Database } from "@cloudflare/workers-types";

export function generateId(): string {
  return crypto.randomUUID();
}

export async function queryAll<T = Record<string, unknown>>(
  db: D1Database,
  query: string,
  params: unknown[] = []
): Promise<T[]> {
  const stmt = db.prepare(query);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt;
  const result = await bound.all<T>();
  return result.results || [];
}

export async function queryFirst<T = Record<string, unknown>>(
  db: D1Database,
  query: string,
  params: unknown[] = []
): Promise<T | null> {
  const stmt = db.prepare(query);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt;
  const result = await bound.first<T>();
  return result ?? null;
}

export async function execute(
  db: D1Database,
  query: string,
  params: unknown[] = []
): Promise<D1Result> {
  const stmt = db.prepare(query);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt;
  return await bound.run();
}
