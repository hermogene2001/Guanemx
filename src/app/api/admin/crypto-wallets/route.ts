import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { recordAudit } from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import { Pool } from "pg";

export const dynamic = "force-dynamic";
const walletSchema = z.object({
  name: z.string().trim().min(2).max(40),
  network: z.string().trim().min(2).max(60),
  address: z.string().trim().min(8).max(200),
  enabled: z.boolean().default(true),
});

const globalForPg = globalThis as unknown as { _pgPool?: Pool };
const pool = globalForPg._pgPool ?? new Pool({ connectionString: process.env.DATABASE_URL });
if (process.env.NODE_ENV !== "production") globalForPg._pgPool = pool;

export async function GET() {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    let wallets: any[] = [];
    try {
      wallets = await queryWithPg('SELECT id, name, network, address, enabled FROM "crypto_wallets" ORDER BY name ASC, network ASC');
    } catch {
      try {
        wallets = await queryWithPg('SELECT id, name, network, address, enabled FROM crypto_wallets ORDER BY name ASC, network ASC');
      } catch {
        try {
          const client = await pool.connect();
          try {
            await client.query('CREATE TABLE IF NOT EXISTS "crypto_wallets" (id TEXT PRIMARY KEY, name VARCHAR(40) NOT NULL, network VARCHAR(60) NOT NULL, address VARCHAR(200) NOT NULL, enabled BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL)');
            const r = await client.query('SELECT id, name, network, address, enabled FROM "crypto_wallets" ORDER BY name ASC, network ASC');
            wallets = r.rows;
          } finally {
            client.release();
          }
        } catch {}
      }
    }
    return NextResponse.json({ wallets: (wallets || []).map((w: any) => ({ id: w.id, name: w.name, network: w.network, address: w.address, enabled: Boolean(w.enabled) })) });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("crypto_wallets_get_failed", msg);
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
    const client = await pool.connect();
    try {
      try {
        await client.query('CREATE TABLE IF NOT EXISTS "crypto_wallets" (id TEXT PRIMARY KEY, name VARCHAR(40) NOT NULL, network VARCHAR(60) NOT NULL, address VARCHAR(200) NOT NULL, enabled BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL)');
      } catch {}
      try {
        await client.query('CREATE TABLE IF NOT EXISTS crypto_wallets (id text PRIMARY KEY, name varchar(40) NOT NULL, network varchar(60) NOT NULL, address varchar(200) NOT NULL, enabled boolean NOT NULL DEFAULT true, "createdAt" timestamp without time zone DEFAULT now() NOT NULL, "updatedAt" timestamp without time zone NOT NULL)');
      } catch {}
      try {
        await client.query('INSERT INTO "crypto_wallets" (id, name, network, address, enabled, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7)', [id, parsed.data.name, parsed.data.network, parsed.data.address, enabled, now, now]);
      } catch {
        try {
          await client.query('INSERT INTO crypto_wallets (id, name, network, address, enabled, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7)', [id, parsed.data.name, parsed.data.network, parsed.data.address, enabled, now, now]);
        } catch {
          throw new Error("insert failed");
        }
      }
    } finally {
      client.release();
    }
    const wallet = { id, name: parsed.data.name, network: parsed.data.network, address: parsed.data.address, enabled };
    await recordAudit(prisma, request, admin.id, "crypto_wallet.created", "CryptoWallet", wallet.id, { name: wallet.name, network: wallet.network });
    return NextResponse.json({ wallet }, { status: 201 });
  } catch (error: unknown) {
    console.error(JSON.stringify({ event: "crypto_wallets_post_failed", message: error instanceof Error ? error.message : "unknown" }));
    return NextResponse.json({ error: "Wallet could not be saved." }, { status: 500 });
  }
}
