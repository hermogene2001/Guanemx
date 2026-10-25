import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
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
    if (!admin || admin.role !== "ADMIN") {
      return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    }

    const wallets = await prisma.cryptoWallet.findMany({
      orderBy: [{ name: "asc" }, { network: "asc" }],
    });
    return NextResponse.json({ wallets });
  } catch (error) {
    console.error("crypto_wallets_get_failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Unable to load crypto wallets." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "ADMIN") {
      return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const parsed = walletSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a name, network, and valid wallet address." }, { status: 400 });
    }

    const wallet = await prisma.cryptoWallet.create({
      data: {
        id: randomUUID(),
        name: parsed.data.name,
        network: parsed.data.network,
        address: parsed.data.address,
        enabled: parsed.data.enabled,
        updatedAt: new Date(),
      },
    });

    await recordAudit(prisma, request, admin.id, "crypto_wallet.created", "CryptoWallet", wallet.id, {
      name: wallet.name,
      network: wallet.network,
    });

    return NextResponse.json({ wallet }, { status: 201 });
  } catch (error) {
    console.error("crypto_wallets_post_failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Wallet could not be saved." }, { status: 500 });
  }
}
