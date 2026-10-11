import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const users = await prisma.user.findMany({
    where: query ? {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
      ],
    } : undefined,
    select: { id: true, name: true, email: true, phone: true, role: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ users: users.map((user) => ({ ...user, createdAt: user.createdAt.toISOString() })) });
}
