import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { recordAudit } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const walletSchema = z.object({
  name: z.string().trim().min(2).max(40),
  network: z.string().trim().min(2).max(60),
  address: z.string().trim().min(8).max(200),
  enabled: z.boolean().default(true),
});

export async function GET() {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    let wallets: any[] = [];
    try {
      wallets = await prisma.$queryRawUnsafe(`SELECT id, name, network, address, enabled FROM crypto_wallets ORDER BY name ASC, network ASC`);
    } catch {
      try {
        await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS crypto_wallets (id text PRIMARY KEY, name varchar(40) NOT NULL, network varchar(60) NOT NULL, address varchar(200) NOT NULL, enabled boolean NOT NULL DEFAULT true, "createdAt" timestamp without time zone DEFAULT now() NOT NULL, "updatedAt" timestamp without time zone NOT NULL)`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS crypto_wallets_enabled_name_idx ON crypto_wallets (enabled, name)`);
        wallets = await prisma.$queryRawUnsafe(`SELECT id, name, network, address, enabled FROM crypto_wallets ORDER BY name ASC, network ASC`);
      } catch (e: any) {
        throw e;
      }
    }
    return NextResponse.json({ wallets: (wallets as any[]).map((w: any) => ({ id: w.id, name: w.name, network: w.network, address: w.address, enabled: Boolean(w.enabled) })) });
  } catch (error: any) {
    console.error("crypto_wallets_get_failed", error?.message, error?.code);
    return NextResponse.json({ error: "Unable to load crypto wallets." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
    const parsed = walletSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Enter a name, network, and valid wallet address." }, { status: 400 });
    const id = randomUUID();
    const enabled = parsed.data.enabled ?? true;
    const now = new Date();
    try {
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS crypto_wallets (id text PRIMARY KEY, name varchar(40) NOT NULL, network varchar(60) NOT NULL, address varchar(200) NOT NULL, enabled boolean NOT NULL DEFAULT true, "createdAt" timestamp without time zone DEFAULT now() NOT NULL, "updatedAt" timestamp without time zone NOT NULL)`);
    } catch {}
    await prisma.$executeRawUnsafe(`INSERT INTO crypto_wallets (id, name, network, address, enabled, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7)`, id, parsed.data.name, parsed.data.network, parsed.data.address, enabled, now, now);
    const wallet = { id, name: parsed.data.name, network: parsed.data.network, address: parsed.data.address, enabled };
    await recordAudit(prisma, request, admin.id, "crypto_wallet.created", "CryptoWallet", wallet.id, { name: wallet.name, network: wallet.network });
    return NextResponse.json({ wallet }, { status: 201 });
  } catch (error: any) {
    console.error(JSON.stringify({ event: "crypto_wallets_post_failed", message: error instanceof Error ? error.message : "unknown" }));
    return NextResponse.json({ error: "Wallet could not be saved." }, { status: 500 });
  }
}
