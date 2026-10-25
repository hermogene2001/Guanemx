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
      const p: any = prisma;
      if (p.cryptoWallet && typeof p.cryptoWallet.findMany === "function") {
        try { wallets = await p.cryptoWallet.findMany({ orderBy: [{ name: "asc" }, { network: "asc" }] }); } catch {}
      }
      if ((!wallets || wallets.length === 0) && p.crypto_wallets && typeof p.crypto_wallets.findMany === "function") {
        try { wallets = await p.crypto_wallets.findMany({ orderBy: [{ name: "asc" }, { network: "asc" }] }); } catch {}
      }
    } catch {}
    if (!wallets || wallets.length === 0) {
      try { wallets = await prisma.$queryRawUnsafe('SELECT id, name, network, address, enabled FROM "crypto_wallets" ORDER BY name ASC, network ASC'); } catch {}
    }
    if (!wallets || wallets.length === 0) {
      try { wallets = await prisma.$queryRawUnsafe('SELECT id, name, network, address, enabled FROM crypto_wallets ORDER BY name ASC, network ASC'); } catch {}
    }
    if (!wallets || wallets.length === 0) {
      try { wallets = await prisma.$queryRawUnsafe('SELECT id, name, network, address, enabled FROM public."crypto_wallets" ORDER BY name ASC, network ASC'); } catch {}
    }
    if (!wallets || wallets.length === 0) {
      try {
        const pool = getPool();
        const client = await pool.connect();
        try {
          try { const res = await client.query('SELECT id, name, network, address, enabled FROM "crypto_wallets" ORDER BY name ASC, network ASC'); wallets = res.rows; } catch {}
          if ((!wallets || wallets.length === 0)) {
            try { const res = await client.query('SELECT id, name, network, address, enabled FROM crypto_wallets ORDER BY name ASC, network ASC'); wallets = res.rows; } catch {}
          }
          if ((!wallets || wallets.length === 0)) {
            try { await ensureTable(); const res = await client.query('SELECT id, name, network, address, enabled FROM "crypto_wallets" ORDER BY name ASC, network ASC'); wallets = res.rows; } catch {}
          }
        } finally { client.release(); }
      } catch {}
    }
    return NextResponse.json({ wallets: (wallets || []).map((w: any) => ({ id: w.id, name: w.name, network: w.network, address: w.address, enabled: w.enabled === true || w.enabled === "t" || w.enabled === 1 })) });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("crypto_wallets_get_failed", JSON.stringify({ msg }));
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
    let wallet: any = null;
    try {
      const p: any = prisma;
      if (p.cryptoWallet && typeof p.cryptoWallet.create === "function") {
        try { wallet = await p.cryptoWallet.create({ data: { id, name: parsed.data.name, network: parsed.data.network, address: parsed.data.address, enabled, updatedAt: now } }); } catch (e) { console.error("cw_prisma1", e instanceof Error ? e.message : e); }
      }
      if (!wallet && p.crypto_wallets && typeof p.crypto_wallets.create === "function") {
        try { wallet = await p.crypto_wallets.create({ data: { id, name: parsed.data.name, network: parsed.data.network, address: parsed.data.address, enabled, updatedAt: now } }); } catch (e) { console.error("cw_prisma2", e instanceof Error ? e.message : e); }
      }
    } catch (e) { console.error("cw_prisma", e instanceof Error ? e.message : e); }
    if (!wallet) {
      try { await prisma.$executeRawUnsafe('INSERT INTO "crypto_wallets" (id,name,network,address,enabled,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7)', id, parsed.data.name, parsed.data.network, parsed.data.address, enabled, now, now); wallet = { id, name: parsed.data.name, network: parsed.data.network, address: parsed.data.address, enabled }; } catch (e) { console.error("cw_sql1", e instanceof Error ? e.message : e); }
    }
    if (!wallet) {
      try { await prisma.$executeRawUnsafe('INSERT INTO crypto_wallets (id,name,network,address,enabled,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7)', id, parsed.data.name, parsed.data.network, parsed.data.address, enabled, now, now); wallet = { id, name: parsed.data.name, network: parsed.data.network, address: parsed.data.address, enabled }; } catch (e) { console.error("cw_sql2", e instanceof Error ? e.message : e); }
    }
    if (!wallet) {
      try { await prisma.$executeRawUnsafe('INSERT INTO public."crypto_wallets" (id,name,network,address,enabled,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7)', id, parsed.data.name, parsed.data.network, parsed.data.address, enabled, now, now); wallet = { id, name: parsed.data.name, network: parsed.data.network, address: parsed.data.address, enabled }; } catch (e) { console.error("cw_sql3", e instanceof Error ? e.message : e); }
    }
    if (!wallet) {
      try { await prisma.$executeRawUnsafe('INSERT INTO "CryptoWallet" (id,name,network,address,enabled,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7)', id, parsed.data.name, parsed.data.network, parsed.data.address, enabled, now, now); wallet = { id, name: parsed.data.name, network: parsed.data.network, address: parsed.data.address, enabled }; } catch (e) { console.error("cw_sql4", e instanceof Error ? e.message : e); }
    }
    if (!wallet) {
      try {
        const pool = getPool();
        const client = await pool.connect();
        try {
          try { await ensureTable(); } catch {}
          let inserted = false;
          try { await client.query('INSERT INTO "crypto_wallets" (id,name,network,address,enabled,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7)', [id, parsed.data.name, parsed.data.network, parsed.data.address, enabled, now, now]); inserted = true; } catch (e) { console.error("cw_pg1", e instanceof Error ? e.message : e); }
          if (!inserted) { try { await client.query('INSERT INTO crypto_wallets (id,name,network,address,enabled,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7)', [id, parsed.data.name, parsed.data.network, parsed.data.address, enabled, now, now]); inserted = true; } catch (e) { console.error("cw_pg2", e instanceof Error ? e.message : e); } }
          if (!inserted) { try { await client.query('INSERT INTO public."crypto_wallets" (id,name,network,address,enabled,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7)', [id, parsed.data.name, parsed.data.network, parsed.data.address, enabled, now, now]); inserted = true; } catch (e) { console.error("cw_pg3", e instanceof Error ? e.message : e); } }
          if (!inserted) { try { await client.query('INSERT INTO "crypto_wallets" (id,name,network,address,enabled,createdAt,updatedAt) VALUES ($1,$2,$3,$4,$5,$6,$7)', [id, parsed.data.name, parsed.data.network, parsed.data.address, enabled, now, now]); inserted = true; } catch (e) { console.error("cw_pg4", e instanceof Error ? e.message : e); } }
          if (inserted) wallet = { id, name: parsed.data.name, network: parsed.data.network, address: parsed.data.address, enabled };
        } finally { client.release(); }
      } catch (e) {
        console.error("crypto_wallets_post_failed_inner", e instanceof Error ? e.message : e);
        throw e;
      }
    }
    if (!wallet) throw new Error("insert failed");
    wallet = { id: wallet.id, name: wallet.name, network: wallet.network, address: wallet.address, enabled: wallet.enabled };
    await recordAudit(prisma, request, admin.id, "crypto_wallet.created", "CryptoWallet", wallet.id, { name: wallet.name, network: wallet.network });
    return NextResponse.json({ wallet }, { status: 201 });
  } catch (error: unknown) {
    console.error(JSON.stringify({ event: "crypto_wallets_post_failed", message: error instanceof Error ? error.message : "unknown" }));
    return NextResponse.json({ error: "Wallet could not be saved." }, { status: 500 });
  }
}
