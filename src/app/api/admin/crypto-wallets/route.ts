import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { Pool } from "pg";
import { getCurrentUser } from "@/lib/auth";
import { recordAudit } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function getPool() {
  const globalForPg = globalThis as unknown as { _pgPool?: Pool };
  if (!globalForPg._pgPool) {
    const url = process.env.DATABASE_URL || "";
    const useSsl = /sslmode=require|neon\.tech|vercel/i.test(url);
    globalForPg._pgPool = new Pool({ connectionString: url, max: 1, ssl: useSsl ? { rejectUnauthorized: false } : undefined });
  }
  return globalForPg._pgPool;
}

const walletSchema = z.object({
  name: z.string().trim().min(2).max(40),
  network: z.string().trim().min(2).max(60),
  address: z.string().trim().min(8).max(200),
  enabled: z.boolean().default(true),
});

async function ensureTable() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS "crypto_wallets" (
      "id" TEXT PRIMARY KEY,
      "name" VARCHAR(40) NOT NULL,
      "network" VARCHAR(60) NOT NULL,
      "address" VARCHAR(200) NOT NULL,
      "enabled" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS crypto_wallets (
      id TEXT PRIMARY KEY,
      name VARCHAR(40) NOT NULL,
      network VARCHAR(60) NOT NULL,
      address VARCHAR(200) NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL
    )`);
  } finally {
    client.release();
  }
}

export async function GET() {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    let wallets: any[] = [];
    try {
      const pool = getPool();
      const client = await pool.connect();
      try {
        try {
          const res = await client.query(`SELECT id, name, network, address, enabled FROM "crypto_wallets" ORDER BY name ASC, network ASC`);
          wallets = res.rows;
        } catch {
          try {
            const res = await client.query(`SELECT id, name, network, address, enabled FROM crypto_wallets ORDER BY name ASC, network ASC`);
            wallets = res.rows;
          } catch {
            try { await ensureTable(); } catch {}
            try {
              const res = await client.query(`SELECT id, name, network, address, enabled FROM "crypto_wallets" ORDER BY name ASC, network ASC`);
              wallets = res.rows;
            } catch {
              const res = await client.query(`SELECT id, name, network, address, enabled FROM crypto_wallets ORDER BY name ASC, network ASC`);
              wallets = res.rows;
            }
          }
        }
      } finally {
        client.release();
      }
    } catch {
      try {
        wallets = await prisma.$queryRawUnsafe(`SELECT id, name, network, address, enabled FROM "crypto_wallets" ORDER BY name ASC, network ASC`);
      } catch {
        try {
          wallets = await prisma.$queryRawUnsafe(`SELECT id, name, network, address, enabled FROM crypto_wallets ORDER BY name ASC, network ASC`);
        } catch {
          try {
            wallets = await (prisma as any).cryptoWallet.findMany({ orderBy: [{ name: "asc" }, { network: "asc" }] });
          } catch {
            wallets = [];
          }
        }
      }
    }
    return NextResponse.json({ wallets: (wallets || []).map((w: any) => ({ id: w.id, name: w.name, network: w.network, address: w.address, enabled: Boolean(w.enabled) })) });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("crypto_wallets_get_failed", JSON.stringify({ msg, stack: stack?.split('\n').slice(0,3).join(' | ') }));
    return NextResponse.json({ error: "Unable to load crypto wallets.", detail: msg }, { status: 500 });
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
    let wallet: any = null;
    const pool = getPool();
    const client = await pool.connect();
    try {
      await ensureTable();
      try {
        await client.query(`INSERT INTO "crypto_wallets" (id, name, network, address, enabled, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7)`, [id, parsed.data.name, parsed.data.network, parsed.data.address, enabled, now, now]);
      } catch {
        try {
          await client.query(`INSERT INTO crypto_wallets (id, name, network, address, enabled, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7)`, [id, parsed.data.name, parsed.data.network, parsed.data.address, enabled, now, now]);
        } catch {
          // try without quotes on columns
          await client.query(`INSERT INTO "crypto_wallets" (id, name, network, address, enabled, createdAt, updatedAt) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [id, parsed.data.name, parsed.data.network, parsed.data.address, enabled, now, now]);
        }
      }
      wallet = { id, name: parsed.data.name, network: parsed.data.network, address: parsed.data.address, enabled };
    } finally {
      client.release();
    }
    await recordAudit(prisma, request, admin.id, "crypto_wallet.created", "CryptoWallet", wallet.id, { name: wallet.name, network: wallet.network });
    return NextResponse.json({ wallet }, { status: 201 });
  } catch (error: unknown) {
    console.error(JSON.stringify({ event: "crypto_wallets_post_failed", message: error instanceof Error ? error.message : "unknown" }));
    return NextResponse.json({ error: "Wallet could not be saved." }, { status: 500 });
  }
}
