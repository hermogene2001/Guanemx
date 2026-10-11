import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const robot = await prisma.robot.findUnique({
    where: { slug },
    select: { status: true, imageData: true, imageContentType: true },
  });
  if (!robot?.imageData || !robot.imageContentType) return new NextResponse(null, { status: 404 });
  if (robot.status !== "ACTIVE") {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") return new NextResponse(null, { status: 404 });
  }
  return new NextResponse(robot.imageData, {
    headers: {
      "Content-Type": robot.imageContentType,
      "Content-Length": String(robot.imageData.byteLength),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": robot.status === "ACTIVE" ? "public, max-age=300, stale-while-revalidate=3600" : "private, no-store",
    },
  });
}
