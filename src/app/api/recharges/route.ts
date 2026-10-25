import { randomInt } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { consumeRateLimit, getCurrentUser, sameOriginRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/finance";
import { CURRENCY } from "@/lib/money";
import { getPlatformSettings } from "@/lib/settings";

const rechargeSchema = z.object({ 
  amount: z.number().int().min(1).max(3_000_000), 
  paymentMethod: z.enum(["AGENT", "CRYPTO", "BANK_TRANSFER", "MOBILE_MONEY", "ECASH", "CARD"]).default("AGENT"), 
  cryptoWalletId: z.string().min(1).optional(),
  methodProvider: z.string().optional(),
  methodNetwork: z.string().optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view recharge requests." }, { status: 401 });
  const recharges = await prisma.rechargeRequest.findMany({
    where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50,
    include: { assignedAgent: { select: { name: true, phone: true } }, transaction: { select: { reference: true } } },
  });
  let cryptoWallets: Array<{ id: string; name: string; network: string; address: string }> = [];
  try {
    const rows = await prisma.$queryRawUnsafe(`SELECT id, name, network, address FROM crypto_wallets WHERE enabled = true ORDER BY name ASC, network ASC`);
    cryptoWallets = rows as Array<{ id: string; name: string; network: string; address: string }>;
  } catch {
    try {
      const p2: any = prisma as any;
      if (p2.cryptoWallet) {
        const rows = await p2.cryptoWallet.findMany({ where: { enabled: true }, orderBy: [{ name: "asc" }, { network: "asc" }], select: { id: true, name: true, network: true, address: true } });
        cryptoWallets = rows;
      } else if (p2.crypto_wallets) {
        const rows = await p2.crypto_wallets.findMany({ where: { enabled: true }, orderBy: [{ name: "asc" }, { network: "asc" }], select: { id: true, name: true, network: true, address: true } });
        cryptoWallets = rows;
      }
    } catch {
      cryptoWallets = [];
    }
  }
  return NextResponse.json({ cryptoWallets, recharges: recharges.map((item) => ({
    id: item.id, amount: item.amount.toFixed(0), currency: item.currency, status: item.status,
    paymentMethod: item.paymentMethod, cryptoName: item.cryptoName, cryptoNetwork: item.cryptoNetwork, cryptoAddress: item.cryptoAddress,
    createdAt: item.createdAt.toISOString(), agent: { name: item.assignedAgent.name, phone: item.assignedAgent.phone },
    reference: item.transaction?.reference ?? null,
  })) });
}

export async function POST(request: NextRequest) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in before requesting a recharge." }, { status: 401 });
  if (!await consumeRateLimit(request, "recharge-request", user.id, 5, 60 * 60 * 1000)) return NextResponse.json({ error: "Too many recharge requests. Try again later." }, { status: 429 });
  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey || idempotencyKey.length > 100) return NextResponse.json({ error: "A valid request key is required." }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = rechargeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter a whole-dollar amount no greater than $3,000,000." }, { status: 400 });

  const existing = await prisma.rechargeRequest.findUnique({ where: { idempotencyKey }, include: { assignedAgent: { select: { name: true, phone: true } } } });
  if (existing) return existing.userId === user.id ? NextResponse.json({ id: existing.id, status: existing.status, amount: existing.amount.toFixed(0), paymentMethod: existing.paymentMethod, cryptoName: existing.cryptoName, cryptoNetwork: existing.cryptoNetwork, cryptoAddress: existing.cryptoAddress, agent: existing.assignedAgent }) : NextResponse.json({ error: "Request key already used." }, { status: 409 });

  try {
    const settings = await getPlatformSettings();
    if (new Prisma.Decimal(parsed.data.amount).lt(settings.minimumDepositAmount)) {
      return NextResponse.json({ error: `The minimum deposit is ${CURRENCY} ${settings.minimumDepositAmount.toFixed(0)}.` }, { status: 400 });
    }
    const agents = await prisma.user.findMany({ where: { role: "AGENT", status: "ACTIVE", phone: { not: null } }, select: { id: true } });
    if (!agents.length) return NextResponse.json({ error: "Recharge is temporarily unavailable. No active payment agents are configured." }, { status: 503 });
    if (parsed.data.paymentMethod === "CRYPTO" && !parsed.data.cryptoWalletId) return NextResponse.json({ error: "Choose a crypto wallet." }, { status: 400 });
    let cryptoWallet: { name: string; network: string; address: string } | null = null;
    if (parsed.data.paymentMethod === "CRYPTO") {
      try {
        const rows = await prisma.$queryRawUnsafe(`SELECT name, network, address FROM crypto_wallets WHERE id = $1 AND enabled = true`, parsed.data.cryptoWalletId);
        const r = (rows as Array<{ name: string; network: string; address: string }>)[0];
        cryptoWallet = r || null;
      } catch {
        try {
          const p2: any = prisma as any;
          if (p2.cryptoWallet) {
            cryptoWallet = await p2.cryptoWallet.findFirst({ where: { id: parsed.data.cryptoWalletId, enabled: true }, select: { name: true, network: true, address: true } });
          } else if (p2.crypto_wallets) {
            cryptoWallet = await p2.crypto_wallets.findFirst({ where: { id: parsed.data.cryptoWalletId, enabled: true }, select: { name: true, network: true, address: true } });
          }
        } catch {
          cryptoWallet = null;
        }
      }
    }
    if (parsed.data.paymentMethod === "CRYPTO" && !cryptoWallet) return NextResponse.json({ error: "That crypto wallet is unavailable. Choose another wallet." }, { status: 400 });
    const agentId = agents[randomInt(agents.length)].id;
    const result = await prisma.$transaction(async (tx) => {
      const recharge = await tx.rechargeRequest.create({ data: {
        userId: user.id, assignedAgentId: agentId, amount: new Prisma.Decimal(parsed.data.amount), currency: CURRENCY, idempotencyKey,
        paymentMethod: parsed.data.paymentMethod, cryptoName: cryptoWallet?.name || parsed.data.methodProvider || null, cryptoNetwork: cryptoWallet?.network || parsed.data.methodNetwork || null, cryptoAddress: cryptoWallet?.address || null,
      }, include: { assignedAgent: { select: { name: true, phone: true } } } });
      await recordAudit(tx, request, user.id, "recharge.requested", "RechargeRequest", recharge.id, { amount: parsed.data.amount, paymentMethod: recharge.paymentMethod, cryptoName: recharge.cryptoName, cryptoNetwork: recharge.cryptoNetwork });
      return recharge;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ id: result.id, amount: result.amount.toFixed(0), status: result.status, paymentMethod: result.paymentMethod, cryptoName: result.cryptoName, cryptoNetwork: result.cryptoNetwork, cryptoAddress: result.cryptoAddress, agent: result.assignedAgent }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const duplicate = await prisma.rechargeRequest.findUnique({ where: { idempotencyKey }, include: { assignedAgent: { select: { name: true, phone: true } } } });
      if (duplicate?.userId === user.id) return NextResponse.json({ id: duplicate.id, status: duplicate.status, amount: duplicate.amount.toFixed(0), paymentMethod: duplicate.paymentMethod, cryptoName: duplicate.cryptoName, cryptoNetwork: duplicate.cryptoNetwork, cryptoAddress: duplicate.cryptoAddress, agent: duplicate.assignedAgent });
    }
    console.error(JSON.stringify({ event: "recharge_request_failed", message: error instanceof Error ? error.message : "unknown error" }));
    return NextResponse.json({ error: "Recharge request could not be created. Please try again." }, { status: 500 });
  }
}
