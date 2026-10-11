import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, sameOriginRequest } from "@/lib/auth";
import { recordAudit } from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import { getPlatformSettings, savePlatformSettings, serializePlatformSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const settingsSchema = z.object({
  usdToRwfRate: z.coerce.number().positive().max(1_000_000),
  withdrawalFeePercent: z.coerce.number().min(0).max(100),
  referralBonusPercent: z.coerce.number().min(0).max(100),
  minimumDepositAmount: z.coerce.number().int().min(1).max(3_000_000),
  minimumWithdrawalAmount: z.coerce.number().int().min(1).max(3_000_000),
});

export async function GET() {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    return NextResponse.json({ settings: serializePlatformSettings(await getPlatformSettings()) });
  } catch (error) {
    console.error(JSON.stringify({ event: "platform_settings_load_failed", message: error instanceof Error ? error.message : "unknown error" }));
    return NextResponse.json({ error: "Platform settings could not be loaded." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter a positive USD→RWF rate and fee percentages between 0 and 100." }, { status: 400 });

  try {
    const settings = await prisma.$transaction(async (tx) => {
      const saved = await savePlatformSettings(parsed.data, admin.id, tx);
      await recordAudit(tx, request, admin.id, "platform.settings_updated", "PlatformSetting", "default", {
        usdToRwfRate: saved.usdToRwfRate.toFixed(4),
        withdrawalFeePercent: saved.withdrawalFeePercent.toFixed(2),
        referralBonusPercent: saved.referralBonusPercent.toFixed(2),
        minimumDepositAmount: saved.minimumDepositAmount.toFixed(2),
        minimumWithdrawalAmount: saved.minimumWithdrawalAmount.toFixed(2),
      });
      return saved;
    });
    return NextResponse.json({ settings: serializePlatformSettings(settings) });
  } catch (error) {
    console.error(JSON.stringify({ event: "platform_settings_update_failed", message: error instanceof Error ? error.message : "unknown error" }));
    return NextResponse.json({ error: "Platform settings could not be saved." }, { status: 500 });
  }
}
