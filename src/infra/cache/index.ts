import redis from "./redisClient";

export async function getCached(key: string): Promise<unknown | null> {
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    // swallow cache errors to avoid failing requests
    return null;
  }
}

export async function setCached(
  key: string,
  value: unknown,
  ttlSeconds = Number(process.env.CACHE_TTL_SECONDS ?? 60)
): Promise<void> {
  try {
    const raw = JSON.stringify(value);
    await redis.set(key, raw, { EX: ttlSeconds });
  } catch {
    // ignore cache write errors
  }
}

export async function delCached(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch {
    // ignore
  }
}

export async function delPattern(pattern: string): Promise<void> {
  try {
    // Use SCAN to avoid blocking Redis on large keyspaces
    // Support different redis client return shapes and avoid spread typing issues
    let cursor: string | number = 0;
    do {
      const raw: any = await (redis as any).scan(cursor, {
        MATCH: pattern,
        COUNT: 100,
      });
      let keys: string[] = [];
      if (Array.isArray(raw)) {
        cursor = raw[0];
        keys = raw[1] ?? [];
      } else if (raw && typeof raw === "object") {
        cursor = raw.cursor ?? raw[0] ?? 0;
        keys = raw.keys ?? raw[1] ?? [];
      } else {
        break;
      }

      for (const k of keys) {
        try {
          await redis.del(k);
        } catch {
          // ignore individual delete errors
        }
      }

      if (typeof cursor === "string") cursor = Number(cursor);
    } while (Number(cursor) !== 0);
  } catch {
    // ignore
  }
}
