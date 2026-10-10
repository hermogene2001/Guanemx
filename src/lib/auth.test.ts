import { afterEach, beforeEach, describe, expect, it } from "vitest";

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalAuthSecret = process.env.AUTH_SECRET;

const modulePromise = (async () => {
  process.env.DATABASE_URL = "postgresql://guanemx:secret123@localhost:5432/guanemx_test?schema=public";
  process.env.AUTH_SECRET = "a".repeat(32);
  return import("@/lib/auth");
})();

async function loadAuth() {
  return modulePromise;
}

beforeEach(() => {
  process.env.DATABASE_URL = "postgresql://guanemx:secret123@localhost:5432/guanemx_test?schema=public";
  process.env.AUTH_SECRET = "a".repeat(32);
});

afterEach(() => {
  process.env.DATABASE_URL = originalDatabaseUrl;
  process.env.AUTH_SECRET = originalAuthSecret;
});

describe("authConfigurationReady", () => {
  it("is true with a real DATABASE_URL and a 32-character AUTH_SECRET", async () => {
    const { authConfigurationReady } = await loadAuth();
    expect(authConfigurationReady()).toBe(true);
  });

  it("is false without a real DATABASE_URL", async () => {
    const { authConfigurationReady } = await loadAuth();
    delete process.env.DATABASE_URL;
    expect(authConfigurationReady()).toBe(false);
    process.env.DATABASE_URL = "postgresql://user:password@localhost:5432/guanemx_test?schema=public";
  });

  it("is false with a placeholder DATABASE_URL", async () => {
    const { authConfigurationReady } = await loadAuth();
    process.env.DATABASE_URL = "postgresql://user:password@localhost:5432/guanemx?schema=public";
    expect(authConfigurationReady()).toBe(false);
    process.env.DATABASE_URL = "postgresql://guanemx:secret123@localhost:5432/guanemx_test?schema=public";
  });

  it("is false when AUTH_SECRET is shorter than 32 characters", async () => {
    const { authConfigurationReady } = await loadAuth();
    process.env.AUTH_SECRET = "short";
    expect(authConfigurationReady()).toBe(false);
    process.env.AUTH_SECRET = "a".repeat(32);
  });

  it("is false when AUTH_SECRET is missing", async () => {
    const { authConfigurationReady } = await loadAuth();
    delete process.env.AUTH_SECRET;
    expect(authConfigurationReady()).toBe(false);
    process.env.AUTH_SECRET = "a".repeat(32);
  });
});

describe("sameOriginRequest", () => {
  it("accepts a request whose origin matches its own URL", async () => {
    const { sameOriginRequest } = await loadAuth();
    const request = new Request("http://localhost:3000/api/auth/login", { headers: { origin: "http://localhost:3000" } });
    expect(sameOriginRequest(request)).toBe(true);
  });

  it("rejects a cross-origin request", async () => {
    const { sameOriginRequest } = await loadAuth();
    const request = new Request("http://localhost:3000/api/auth/login", { headers: { origin: "https://evil.example" } });
    expect(sameOriginRequest(request)).toBe(false);
  });

  it("rejects a request without an origin header", async () => {
    const { sameOriginRequest } = await loadAuth();
    const request = new Request("http://localhost:3000/api/auth/login");
    expect(sameOriginRequest(request)).toBe(false);
  });

  it("rejects an unparsable origin", async () => {
    const { sameOriginRequest } = await loadAuth();
    const request = new Request("http://localhost:3000/api/auth/login", { headers: { origin: "not a url" } });
    expect(sameOriginRequest(request)).toBe(false);
  });
});