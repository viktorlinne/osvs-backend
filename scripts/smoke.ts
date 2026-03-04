import dotenv from "dotenv";
import { execSync } from "child_process";
import http from "http";
import type { AddressInfo } from "net";

type HealthResult = {
  status: number;
  body: string;
};

function runMigrateOrThrow(): void {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  try {
    execSync(`${npmCommand} run migrate`, {
      stdio: "inherit",
      env: {
        ...process.env,
        MIGRATE_ALLOW_DATA_RESET: process.env.MIGRATE_ALLOW_DATA_RESET ?? "true",
      },
    });
  } catch (err) {
    const e = err as {
      message?: string;
      stdout?: Buffer | string;
      stderr?: Buffer | string;
    };
    const out =
      typeof e.stdout === "string"
        ? e.stdout.trim()
        : Buffer.isBuffer(e.stdout)
          ? e.stdout.toString("utf8").trim()
          : "";
    const stderr =
      typeof e.stderr === "string"
        ? e.stderr.trim()
        : Buffer.isBuffer(e.stderr)
          ? e.stderr.toString("utf8").trim()
          : "";
    const details = [e.message ?? "", out, stderr]
      .filter((part) => part.length > 0)
      .join("\n");
    throw new Error(details ? `Migration failed\n${details}` : "Migration failed");
  }
}

function trimEnvValue(name: string): void {
  const current = process.env[name];
  if (typeof current === "string") {
    process.env[name] = current.trim();
  }
}

function normalizeCriticalEnv(): void {
  trimEnvValue("DB_HOST");
  trimEnvValue("DB_USER");
  trimEnvValue("DB_NAME");
  trimEnvValue("DB_PASS");
}

function waitForListening(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
}

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) return reject(err);
      return resolve();
    });
  });
}

async function requestHealth(url: string): Promise<HealthResult> {
  if (typeof globalThis.fetch === "function") {
    const response = await globalThis.fetch(url);
    const body = await response.text();
    return { status: response.status, body };
  }

  return await new Promise<HealthResult>((resolve, reject) => {
    const req = http.request(url, { method: "GET" }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      res.on("end", () => {
        resolve({
          status: res.statusCode ?? 0,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });

    req.on("error", reject);
    req.end();
  });
}

async function main(): Promise<number> {
  const env = dotenv.config({ path: ".env.test", override: true });
  if (env.error) {
    console.error(`SMOKE FAIL\nCould not load .env.test: ${env.error.message}`);
    return 1;
  }

  normalizeCriticalEnv();

  const dbName = process.env.DB_NAME ?? "";
  if (!dbName.endsWith("_test")) {
    console.error(
      `SMOKE FAIL\nSafety check failed: DB_NAME must end with "_test" (current: "${dbName || "<empty>"}")`,
    );
    return 1;
  }

  let server: http.Server | null = null;
  try {
    runMigrateOrThrow();

    const appModule = await import("../src/app");
    const app = appModule.default;
    server = app.listen(0);
    await waitForListening(server);

    const address = server.address() as AddressInfo | null;
    if (!address || typeof address.port !== "number") {
      throw new Error("Unable to resolve bound server port");
    }

    const result = await requestHealth(
      `http://127.0.0.1:${address.port}/api/health`,
    );

    if (result.status === 200) {
      console.log("SMOKE PASS");
      return 0;
    }

    console.error(
      `SMOKE FAIL\nGET /api/health returned status=${result.status}\nResponse: ${result.body}`,
    );
    return 1;
  } catch (err) {
    const message = err instanceof Error ? err.stack || err.message : String(err);
    console.error(`SMOKE FAIL\n${message}`);
    return 1;
  } finally {
    if (server) {
      try {
        await closeServer(server);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`SMOKE FAIL\nCould not close server cleanly: ${message}`);
        return 1;
      }
    }

    try {
      const dbModule = await import("../src/config/db");
      const dbPool = dbModule.default as { end?: () => Promise<void> };
      if (dbPool && typeof dbPool.end === "function") {
        await dbPool.end();
      }
    } catch {
      // ignore pool shutdown errors in smoke cleanup
    }
  }
}

void main()
  .then((code) => {
    setTimeout(() => process.exit(code), 50);
  })
  .catch((err) => {
    const message = err instanceof Error ? err.stack || err.message : String(err);
    console.error(`SMOKE FAIL\n${message}`);
    setTimeout(() => process.exit(1), 50);
  });
