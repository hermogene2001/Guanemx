import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Integration-test DB bootstrap.
 *
 * Reads DATABASE_URL from .env (BOM-safe), derives a dedicated test database
 * URL by swapping the database name for `guanemx_test`, then resets it with
 * `prisma migrate reset` so tests run against a known schema.
 *
 * Safety: a hard guard refuses to run against any database whose name is not
 * the dedicated test database (e.g. it will never touch `guanemx` or
 * `postgres`). The derived URL is written to test/.env.test so each worker
 * (via test/setup-env.ts) uses the same database.
 */
export default function setup() {
  const env = parseEnvFile(".env");
  const base = env.DATABASE_URL ?? process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL not found in .env for integration tests.");
  if (!base.startsWith("postgresql://") && !base.startsWith("postgres://")) {
    throw new Error("Integration tests require a PostgreSQL DATABASE_URL.");
  }

  const testUrl = process.env.TEST_DATABASE_URL ?? deriveTestUrl(base);
  const dbName = databaseNameFromUrl(testUrl);
  if (dbName !== "guanemx_test") {
    throw new Error(
      `Refusing to run integration tests against database "${dbName}". ` +
        `Use a dedicated test database named "guanemx_test" (override with TEST_DATABASE_URL).`,
    );
  }

  if (process.env.TEST_DB_SKIP_RESET === "1") {
    writeEnvFile(testUrl);
    return;
  }

  const result = spawnSync("npx", ["prisma", "migrate", "reset", "--force", "--skip-seed"], {
    cwd: process.cwd(),
    env: { ...process.env, ...env, DATABASE_URL: testUrl },
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error(`prisma migrate reset failed (exit ${result.status}). See output above.`);
  }

  writeEnvFile(testUrl);
}

function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  let raw: string;
  try {
    raw = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  } catch {
    return out;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[trimmed.slice(0, eq).trim()] = value;
  }
  return out;
}

function deriveTestUrl(base: string) {
  const url = new URL(base);
  url.pathname = "/guanemx_test";
  return url.toString();
}

function databaseNameFromUrl(url: string) {
  try {
    return new URL(url).pathname.replace(/^\/+/, "").split("?")[0];
  } catch {
    return "";
  }
}

function writeEnvFile(testUrl: string) {
  writeFileSync(join(process.cwd(), "test", ".env.test"), `DATABASE_URL=${testUrl}\n`);
}