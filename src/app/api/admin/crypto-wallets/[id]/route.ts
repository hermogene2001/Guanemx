import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { recordAudit } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

const walletSchema = z.object({
  name: z.string().trim().min(2).max(40),
  network: z.string().trim().min(2).max(60),
  address: z.string().trim().min(8).max(200),
  enabled: z.boolean(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
    const parsed = walletSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Enter a name, network, and valid wallet address." }, { status: 400 });
    const { id } = await params;
    const now = new Date();
    const queries = [
      `UPDATE crypto_wallets SET name=$1, network=$2, address=$3, enabled=$4, "updatedAt"=$5 WHERE id=$6`,
      `UPDATE "crypto_wallets" SET name=$1, network=$2, address=$3, enabled=$4, "updatedAt"=$5 WHERE id=$6`,
      `UPDATE public.crypto_wallets SET name=$1, network=$2, address=$3, enabled=$4, "updatedAt"=$5 WHERE id=$6`,
      `UPDATE "CryptoWallet" SET name=$1, network=$2, address=$3, enabled=$4, "updatedAt"=$5 WHERE id=$6`,
    ];
    let done = false;
    for (const q of queries) {
      try {
        const res = await prisma.$executeRawUnsafe(q, parsed.data.name, parsed.data.network, parsed.data.address, parsed.data.enabled, now, id);
        if (typeof res === "number" && res > 0) { done = true; break; }
        if (res) { done = true; break; }
      } catch {}
    }
    if (!done) throw new Error("not found");
    await recordAudit(prisma, request, admin.id, "crypto_wallet.updated", "CryptoWallet", id, { name: parsed.data.name, network: parsed.data.network, enabled: parsed.data.enabled });
    return NextResponse.json({ wallet: { id, name: parsed.data.name, network: parsed.data.network, address: parsed.data.address, enabled: parsed.data.enabled } });
  } catch { return NextResponse.json({ error: "Crypto wallet was not found." }, { status: 404 }); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    const { id } = await params;
    let rows: Array<{ name: string; network: string }> = [];
    const q1 = [`SELECT name, network FROM crypto_wallets WHERE id=$1`, `SELECT name, network FROM "crypto_wallets" WHERE id=$1`, `SELECT name, network FROM public.crypto_wallets WHERE id=$1`, `SELECT name, network FROM "CryptoWallet" WHERE id=$1`];
    for (const q of q1) { try { rows = await prisma.$queryRawUnsafe(q, id) as Array<{ name: string; network: string }>; if (rows.length) break; } catch {} }
    if (!rows.length) throw new Error("not found");
    const wallet = rows[0];
    const dq = [`DELETE FROM crypto_wallets WHERE id=$1`, `DELETE FROM "crypto_wallets" WHERE id=$1`, `DELETE FROM public.crypto_wallets WHERE id=$1`, `DELETE FROM "CryptoWallet" WHERE id=$1`];
    for (const q of dq) { try { await prisma.$executeRawUnsafe(q, id); break; } catch {} }
    await recordAudit(prisma, request, admin.id, "crypto_wallet.deleted", "CryptoWallet", id, { name: wallet.name, network: wallet.network });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Crypto wallet was not found." }, { status: 404 }); }
}
