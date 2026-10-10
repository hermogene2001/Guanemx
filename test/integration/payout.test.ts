import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, getCurrentUser: vi.fn() };
});

import { GET as listDestinations, POST as saveDestination } from "@/app/api/payout-destinations/route";
import { decryptPayoutAccountNumber } from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import { cleanupDatabase, createUser, fakeFor, makeRequest, setCurrentUser } from "./helpers";

describe("payout destinations (integration)", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it("requires an authenticated user", async () => {
    setCurrentUser(null);
    const res = await saveDestination(makeRequest("/api/payout-destinations", { body: validBody() }));
    expect(res.status).toBe(401);
  });

  it("saves a destination with an encrypted account number, never plaintext", async () => {
    const user = await createUser();
    setCurrentUser(fakeFor(user));

    const res = await saveDestination(makeRequest("/api/payout-destinations", { body: validBody() }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.destination.isDefault).toBe(true);
    expect(data.destination.accountNumberLast4).toBe("9012");
    expect(data.destination.accountNumberEncrypted).toBeUndefined();

    const row = await prisma.payoutDestination.findUniqueOrThrow({ where: { id: data.destination.id } });
    expect(row.accountNumberEncrypted).not.toContain("123456789012");
    expect(decryptPayoutAccountNumber(row.accountNumberEncrypted)).toBe("123456789012");
  });

  it("marks only the first destination as default", async () => {
    const user = await createUser();
    setCurrentUser(fakeFor(user));

    const first = await saveDestination(makeRequest("/api/payout-destinations", { body: validBody() }));
    const firstBody = await first.json();
    const second = await saveDestination(
      makeRequest("/api/payout-destinations", {
        body: { ...validBody(), accountNumber: "9999 8888 7777", accountHolder: "Second Holder" },
      }),
    );
    const secondBody = await second.json();

    expect(firstBody.destination.isDefault).toBe(true);
    expect(secondBody.destination.isDefault).toBe(false);
    await expect(prisma.payoutDestination.count({ where: { userId: user.id, isDefault: true } })).resolves.toBe(1);
  });

  it("rejects an account number with unsupported characters", async () => {
    const user = await createUser();
    setCurrentUser(fakeFor(user));
    const res = await saveDestination(makeRequest("/api/payout-destinations", { body: { ...validBody(), accountNumber: "1234!5678" } }));
    expect(res.status).toBe(400);
  });

  it("lists only the saved public fields", async () => {
    const user = await createUser();
    setCurrentUser(fakeFor(user));
    await saveDestination(makeRequest("/api/payout-destinations", { body: validBody() }));

    const res = await listDestinations();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.destinations).toHaveLength(1);
    expect(data.destinations[0].accountNumberLast4).toBe("9012");
    expect(data.destinations[0].accountNumberEncrypted).toBeUndefined();
  });
});

function validBody() {
  return { category: "BANK", provider: "Bank of Kigali", accountHolder: "Aime Test", accountNumber: "1234 5678 9012" };
}