import { createHash } from "crypto";
import * as geocodeRepo from "../../repositories/geocode.repo";
import logger from "../../utils/logger";

export type GeocodeFailureReason =
  | "NO_RESULT"
  | "REQUEST_ERROR"
  | "INVALID_ADDRESS";

export type GeocodeLookupResult =
  | {
      ok: true;
      lat: number;
      lng: number;
      queryHash: string;
      queryText: string;
      fromCache: boolean;
    }
  | {
      ok: false;
      reason: GeocodeFailureReason;
      queryHash: string | null;
      queryText: string | null;
      fromCache: boolean;
    };

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const DEFAULT_USER_AGENT = "OSVS backend geocoder (+info@osvs.se)";
const MIN_INTERVAL_MS = Math.max(
  1000,
  Number(process.env.NOMINATIM_MIN_INTERVAL_MS ?? "1000"),
);
const TIMEOUT_MS = Math.max(
  2000,
  Number(process.env.NOMINATIM_TIMEOUT_MS ?? "10000"),
);

let queue: Promise<void> = Promise.resolve();
let lastOutboundAt = 0;

function normalizePart(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function buildSwedishAddressQuery(input: {
  address: string;
  zipcode: string;
  city: string;
}): string | null {
  const address = normalizePart(input.address);
  const zipcode = normalizePart(input.zipcode);
  const city = normalizePart(input.city);

  if (!address || !zipcode || !city) return null;

  const query = `${address}, ${zipcode} ${city}, sweden`;
  return query.slice(0, 255);
}

function hashQuery(queryText: string): string {
  return createHash("sha256").update(queryText).digest("hex");
}

async function enqueueNominatim<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const elapsed = Date.now() - lastOutboundAt;
    if (elapsed < MIN_INTERVAL_MS) {
      await new Promise((resolve) =>
        globalThis.setTimeout(resolve, MIN_INTERVAL_MS - elapsed),
      );
    }
    lastOutboundAt = Date.now();
    return task();
  });

  queue = run.then(
    () => undefined,
    () => undefined,
  );

  return run;
}

async function fetchNominatim(queryText: string): Promise<unknown[]> {
  const params = new globalThis.URLSearchParams({
    q: queryText,
    countrycodes: "se",
    limit: "1",
    format: "jsonv2",
  });

  const controller = new globalThis.AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await globalThis.fetch(
      `${NOMINATIM_URL}?${params.toString()}`,
      {
      method: "GET",
      headers: {
        "User-Agent": process.env.NOMINATIM_USER_AGENT?.trim() || DEFAULT_USER_AGENT,
        Accept: "application/json",
      },
      signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error(`Nominatim request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    return Array.isArray(payload) ? payload : [];
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export async function geocodeSwedishAddress(input: {
  address: string;
  zipcode: string;
  city: string;
}): Promise<GeocodeLookupResult> {
  const queryText = buildSwedishAddressQuery(input);
  if (!queryText) {
    return {
      ok: false,
      reason: "INVALID_ADDRESS",
      queryHash: null,
      queryText: null,
      fromCache: false,
    };
  }

  const queryHash = hashQuery(queryText);
  const cached = await geocodeRepo.findByQueryHash(queryHash);
  if (cached) {
    const status = String(cached.status ?? "").toUpperCase();
    if (status === "OK") {
      const lat = Number(cached.lat);
      const lng = Number(cached.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return {
          ok: true,
          lat,
          lng,
          queryHash,
          queryText,
          fromCache: true,
        };
      }
    }
    if (status === "FAILED") {
      return {
        ok: false,
        reason: "NO_RESULT",
        queryHash,
        queryText,
        fromCache: true,
      };
    }
  }

  let payload: unknown[];
  try {
    payload = await enqueueNominatim(() => fetchNominatim(queryText));
  } catch (err) {
    logger.warn({ err, queryHash }, "Nominatim lookup failed");
    return {
      ok: false,
      reason: "REQUEST_ERROR",
      queryHash,
      queryText,
      fromCache: false,
    };
  }

  const first = payload[0] as Record<string, unknown> | undefined;
  const lat = Number(first?.lat);
  const lng = Number(first?.lon);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    await geocodeRepo.upsertGeocodeCacheEntry({
      queryHash,
      queryText,
      lat,
      lng,
      status: "OK",
      rawJson: payload,
    });

    return {
      ok: true,
      lat,
      lng,
      queryHash,
      queryText,
      fromCache: false,
    };
  }

  await geocodeRepo.upsertGeocodeCacheEntry({
    queryHash,
    queryText,
    lat: null,
    lng: null,
    status: "FAILED",
    rawJson: payload,
  });

  return {
    ok: false,
    reason: "NO_RESULT",
    queryHash,
    queryText,
    fromCache: false,
  };
}
