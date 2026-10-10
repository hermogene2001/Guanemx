import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Runs in every Vitest worker before test modules are imported.
 * Copies the DB URL computed by test/global-setup.ts into process.env so the
 * shared Prisma client (constructed at module import time) targets the test
 * database. Also copies AUTH_SECRET so rate limiting and payout encryption
 * behave like production.
 */
const envPath = join(process.cwd(), "test", ".env.test");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const dotEnvPath = join(process.cwd(), ".env");
if (existsSync(dotEnvPath)) {
  const raw = readFileSync(dotEnvPath, "utf8").replace(/^\uFEFF/, "");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (key === "DATABASE_URL") continue; // never let .env override the test DB
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}