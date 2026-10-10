import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getCurrentUser, sameOriginRequest } from "@/lib/auth";
import { recordAudit } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

const planSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(2000).optional().default(""),
  durationDays: z.coerce.number().int().min(1).max(3650),
  price: z.coerce.number().positive().max(1000000000000),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(140).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().min(10).max(5000),
  strategyDescription: z.string().trim().min(10).max(5000),
  market: z.string().trim().min(2).max(80),
  riskLevel: z.string().trim().min(2).max(40),
  robotType: z.string().trim().min(2).max(80),
  tier: z.enum(["BEGINNER", "PRO", "ADVANCED", "VIP"]).default("BEGINNER"),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]).default("DRAFT"),
  performanceKind: z.enum(["SIMULATED", "HISTORICAL", "REAL"]).nullable().optional(),
  performanceSummary: z.string().trim().max(3000).optional().default(""),
  plan: planSchema,
});

export async function GET() {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const robots = await prisma.robot.findMany({
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    include: { plans: { orderBy: { price: "asc" } }, _count: { select: { subscriptions: true } } },
  });
  return NextResponse.json({ robots: robots.map((robot) => ({
    ...robot,
    plans: robot.plans.map((plan) => ({ ...plan, price: plan.price.toFixed(2) })),
    subscriptionCount: robot._count.subscriptions,
  })) });
}

export async function POST(request: NextRequest) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Complete the robot details and provide a valid plan." }, { status: 400 });
  const { plan, ...robotData } = parsed.data;
  try {
    const robot = await prisma.$transaction(async (tx) => {
      const created = await tx.robot.create({ data: {
        ...robotData,
        performanceKind: robotData.performanceKind ?? null,
        performanceSummary: robotData.performanceSummary || null,
        plans: { create: { ...plan, description: plan.description || null, currency: "RWF", price: new Prisma.Decimal(String(plan.price)) } },
      }, include: { plans: true } });
      await recordAudit(tx, request, admin.id, "robot.created", "Robot", created.id, { name: created.name, slug: created.slug, status: created.status });
      return created;
    });
    return NextResponse.json({ robot }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "That robot URL is already in use. Choose a different slug." }, { status: 409 });
    console.error(JSON.stringify({ event: "admin_robot_create_failed", message: error instanceof Error ? error.message : "unknown error" }));
    return NextResponse.json({ error: "Robot could not be created." }, { status: 500 });
  }
}
