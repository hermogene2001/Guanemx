import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sameOriginRequest, clearSessionCookie, SESSION_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasDatabaseUrl } from "@/lib/environment";

export async function POST(request: NextRequest) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token && hasDatabaseUrl()) {
    await prisma.userSession.updateMany({
      where: { tokenHash: createHash("sha256").update(token).digest("hex"), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
