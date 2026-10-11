import { RobotStatus, PlanStatus, Prisma, type Robot as RobotModel } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const activePlanSelection = {
  where: { status: PlanStatus.ACTIVE },
  orderBy: { price: "asc" as const },
  select: { id: true, name: true, description: true, durationDays: true, price: true, dailyReturnPercentage: true, currency: true },
};

const robotListingSelection = {
  id: true,
  name: true,
  slug: true,
  description: true,
  strategyDescription: true,
  market: true,
  riskLevel: true,
  robotType: true,
  status: true,
  tier: true,
  performanceKind: true,
  performanceSummary: true,
  imageContentType: true,
  createdAt: true,
  updatedAt: true,
  plans: activePlanSelection,
  _count: { select: { subscriptions: true } },
} satisfies Prisma.RobotSelect;

export async function getActiveRobots(filters?: { query?: string; risk?: string; type?: string }) {
  const where: Prisma.RobotWhereInput = {
    status: RobotStatus.ACTIVE,
    ...(filters?.query ? { OR: [
      { name: { contains: filters.query, mode: "insensitive" } },
      { strategyDescription: { contains: filters.query, mode: "insensitive" } },
    ] } : {}),
    ...(filters?.risk ? { riskLevel: filters.risk } : {}),
    ...(filters?.type ? { robotType: filters.type } : {}),
  };
  const rows = await prisma.robot.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, slug: true, description: true, strategyDescription: true,
      market: true, riskLevel: true, robotType: true, status: true, tier: true,
      performanceKind: true, performanceSummary: true, imageContentType: true,
      createdAt: true, updatedAt: true, plans: activePlanSelection,
    },
  });
  return rows.filter((robot) => robot.plans.length > 0);
}

export async function getActiveRobot(slug: string) {
  return prisma.robot.findFirst({
    where: { slug, status: RobotStatus.ACTIVE },
    select: robotListingSelection,
  });
}

export function robotImageUrl(robot: Pick<RobotModel, "slug" | "imageContentType" | "updatedAt">) {
  return robot.imageContentType
    ? `/api/robots/${encodeURIComponent(robot.slug)}/image?v=${robot.updatedAt.getTime()}`
    : null;
}
