import pool from "../config/db";
import type { PoolConnection } from "mysql2/promise";

type GeocodeCacheRow = {
  query_hash?: unknown;
  query_text?: unknown;
  lat?: unknown;
  lng?: unknown;
  status?: unknown;
  raw_json?: unknown;
  updated_at?: unknown;
};

export type GeocodeCacheStatus = "OK" | "FAILED";

function asRows<T>(rows: unknown): T[] {
  return Array.isArray(rows) ? (rows as T[]) : [];
}

async function exec(
  sql: string,
  params: unknown[] = [],
  conn?: PoolConnection,
): Promise<[unknown, unknown]> {
  if (conn) return conn.execute(sql, params);
  return pool.execute(sql, params);
}

export async function findByQueryHash(queryHash: string) {
  const [rows] = await exec(
    "SELECT query_hash, query_text, lat, lng, status, raw_json, updated_at FROM geocode_cache WHERE query_hash = ? LIMIT 1",
    [queryHash],
  );
  const arr = asRows<GeocodeCacheRow>(rows);
  return arr.length > 0 ? arr[0] : undefined;
}

export async function upsertGeocodeCacheEntry(input: {
  queryHash: string;
  queryText: string;
  lat: number | null;
  lng: number | null;
  status: GeocodeCacheStatus;
  rawJson: unknown;
}) {
  const rawJsonString =
    input.rawJson === null || typeof input.rawJson === "undefined"
      ? null
      : JSON.stringify(input.rawJson);

  const sql = `
    INSERT INTO geocode_cache
      (query_hash, query_text, lat, lng, status, raw_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      query_text = VALUES(query_text),
      lat = VALUES(lat),
      lng = VALUES(lng),
      status = VALUES(status),
      raw_json = VALUES(raw_json),
      updated_at = VALUES(updated_at)
  `;

  await exec(sql, [
    input.queryHash,
    input.queryText,
    input.lat,
    input.lng,
    input.status,
    rawJsonString,
  ]);
}

export default {
  findByQueryHash,
  upsertGeocodeCacheEntry,
};
