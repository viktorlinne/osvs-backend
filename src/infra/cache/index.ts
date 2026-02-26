type CacheEntry = {
  value: string;
  expiresAt: number | null;
};

const cache = new Map<string, CacheEntry>();

function nowMs(): number {
  return Date.now();
}

function isExpired(entry: CacheEntry): boolean {
  return entry.expiresAt !== null && entry.expiresAt <= nowMs();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function patternToRegex(pattern: string): RegExp {
  const escaped = escapeRegex(pattern).replace(/\\\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

export async function getCached(key: string): Promise<unknown | null> {
  try {
    const entry = cache.get(key);
    if (!entry) return null;
    if (isExpired(entry)) {
      cache.delete(key);
      return null;
    }
    return JSON.parse(entry.value) as unknown;
  } catch {
    // swallow cache errors to avoid failing requests
    return null;
  }
}

export async function setCached(
  key: string,
  value: unknown,
  ttlSeconds = Number(process.env.CACHE_TTL_SECONDS)
): Promise<void> {
  try {
    const raw = JSON.stringify(value);
    const safeTtlSeconds = Number.isFinite(ttlSeconds) ? ttlSeconds : 60;
    const expiresAt =
      safeTtlSeconds > 0 ? nowMs() + safeTtlSeconds * 1000 : null;
    cache.set(key, { value: raw, expiresAt });
  } catch {
    // ignore cache write errors
  }
}

export async function delCached(key: string): Promise<void> {
  try {
    cache.delete(key);
  } catch {
    // ignore
  }
}

export async function delPattern(pattern: string): Promise<void> {
  try {
    const matcher = patternToRegex(pattern);
    for (const key of cache.keys()) {
      if (matcher.test(key)) {
        cache.delete(key);
      }
    }
  } catch {
    // ignore
  }
}
