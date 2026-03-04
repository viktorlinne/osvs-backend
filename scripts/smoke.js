"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const child_process_1 = require("child_process");
const http_1 = __importDefault(require("http"));
function runMigrateOrThrow() {
    const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
    const result = (0, child_process_1.spawnSync)(npmCommand, ["run", "migrate"], {
        stdio: "inherit",
        env: {
            ...process.env,
            MIGRATE_ALLOW_DATA_RESET: process.env.MIGRATE_ALLOW_DATA_RESET ?? "true",
        },
    });
    if (result.status !== 0) {
        throw new Error("Migration failed");
    }
}
function waitForListening(server) {
    return new Promise((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
    });
}
function closeServer(server) {
    return new Promise((resolve, reject) => {
        server.close((err) => {
            if (err)
                return reject(err);
            return resolve();
        });
    });
}
async function requestHealth(url) {
    if (typeof globalThis.fetch === "function") {
        const response = await globalThis.fetch(url);
        const body = await response.text();
        return { status: response.status, body };
    }
    return await new Promise((resolve, reject) => {
        const req = http_1.default.request(url, { method: "GET" }, (res) => {
            const chunks = [];
            res.on("data", (chunk) => {
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
async function main() {
    const env = dotenv_1.default.config({ path: ".env.test", override: true });
    if (env.error) {
        console.error(`SMOKE FAIL\nCould not load .env.test: ${env.error.message}`);
        return 1;
    }
    const dbName = process.env.DB_NAME ?? "";
    if (!dbName.endsWith("_test")) {
        console.error(`SMOKE FAIL\nSafety check failed: DB_NAME must end with "_test" (current: "${dbName || "<empty>"}")`);
        return 1;
    }
    let server = null;
    try {
        runMigrateOrThrow();
        const appModule = await Promise.resolve().then(() => __importStar(require("../src/app")));
        const app = appModule.default;
        server = app.listen(0);
        await waitForListening(server);
        const address = server.address();
        if (!address || typeof address.port !== "number") {
            throw new Error("Unable to resolve bound server port");
        }
        const result = await requestHealth(`http://127.0.0.1:${address.port}/api/health`);
        if (result.status === 200) {
            console.log("SMOKE PASS");
            return 0;
        }
        console.error(`SMOKE FAIL\nGET /api/health returned status=${result.status}\nResponse: ${result.body}`);
        return 1;
    }
    catch (err) {
        const message = err instanceof Error ? err.stack || err.message : String(err);
        console.error(`SMOKE FAIL\n${message}`);
        return 1;
    }
    finally {
        if (server) {
            try {
                await closeServer(server);
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                console.error(`SMOKE FAIL\nCould not close server cleanly: ${message}`);
                return 1;
            }
        }
    }
}
void main().then((code) => {
    process.exit(code);
});
