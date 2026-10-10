import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { consumeRateLimit, getCurrentUser, sameOriginRequest } from "@/lib/auth";
import { encryptPayoutAccountNumber, recordAudit } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

const payoutSchema = z.object({
  category: z.enum(["BANK", "MOBILE_MONEY"]),
  provider: z.string().trim().min(2).max(80),
  accountHolder: z.string().trim().min(2).max(120),
  accountNumber: z.string().trim().min(4).max(34).regex(/^[a-zA-Z0-9 -]+$/),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view payout destinations." }, { status: 401 });
  const destinations = await prisma.payoutDestination.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
  return NextResponse.json({ destinations: destinations.map((item) => ({
    id: item.id, category: item.category, provider: item.provider, accountHolder: item.accountHolder,
    accountNumberLast4: item.accountNumberLast4, isDefault: item.isDefault,
  })) });
}

export async function POST(request: NextRequest) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to save a payout destination." }, { status: 401 });
  if (!await consumeRateLimit(request, "payout-destination-save", user.id, 8, 60 * 60 * 1000)) return NextResponse.json({ error: "Too many payout setup changes. Try again later." }, { status: 429 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = payoutSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid provider, account-holder name, and account number." }, { status: 400 });

  try {
    const accountNumber = parsed.data.accountNumber.replace(/[ -]/g, "");
    const encrypted = encryptPayoutAccountNumber(accountNumber);
    const destination = await prisma.$transaction(async (tx) => {
      const hasDefault = await tx.payoutDestination.findFirst({ where: { userId: user.id }, select: { id: true } });
      if (!hasDefault) await tx.payoutDestination.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
      const saved = await tx.payoutDestination.create({ data: {
        userId: user.id, category: parsed.data.category, provider: parsed.data.provider,
        accountHolder: parsed.data.accountHolder, accountNumberEncrypted: encrypted,
        accountNumberLast4: accountNumber.slice(-4), isDefault: !hasDefault,
      } });
      await recordAudit(tx, request, user.id, "payout_destination.created", "PayoutDestination", saved.id, { category: saved.category, provider: saved.provider, accountNumberLast4: saved.accountNumberLast4 });
      return saved;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ destination: {
      id: destination.id, category: destination.category, provider: destination.provider,
      accountHolder: destination.accountHolder, accountNumberLast4: destination.accountNumberLast4,
      isDefault: destination.isDefault,
    } }, { status: 201 });
  } catch (error) {
    console.error(JSON.stringify({ event: "payout_destination_save_failed", message: error instanceof Error ? error.message : "unknown error" }));
    return NextResponse.json({ error: "Payout destination could not be saved." }, { status: 500 });
  }
}
