import { upgradeWebSocket } from "@vercel/functions";
import { NextResponse } from "next/server";
import { ensureCommunityRealtime, registerCommunitySocket, unregisterCommunitySocket } from "@/lib/community-realtime";
import { getCurrentUser, sameOriginRequest } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to join the community." }, { status: 401 });
  try {
    await ensureCommunityRealtime();
  } catch {
    return NextResponse.json({ error: "Community live updates are temporarily unavailable." }, { status: 503 });
  }

  return upgradeWebSocket((socket) => {
    registerCommunitySocket(socket);
    socket.on("close", () => unregisterCommunitySocket(socket));
    socket.on("error", () => unregisterCommunitySocket(socket));
    socket.send(JSON.stringify({ type: "ready" }));
  });
}
