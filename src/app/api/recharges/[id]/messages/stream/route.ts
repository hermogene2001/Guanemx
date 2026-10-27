import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to open this recharge chat." }, { status: 401 });
  const { id } = await params;
  const recharge = await prisma.rechargeRequest.findUnique({ where: { id }, select: { id: true, userId: true, assignedAgentId: true } });
  const allowed = recharge && (user.role === "ADMIN"
    || (user.role === "AGENT" && recharge.assignedAgentId === user.id)
    || (user.role === "USER" && recharge.userId === user.id));
  if (!allowed) return NextResponse.json({ error: "Recharge request was not found." }, { status: 404 });

  const encoder = new TextEncoder();
  let closeStream = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let busy = false;
      let ticks = 0;
      let sentSnapshot = false;
      let knownIds = new Set<string>();
      const send = (event: string, data: unknown) => {
        if (!closed) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(pollTimer);
        clearInterval(heartbeatTimer);
        request.signal.removeEventListener("abort", onAbort);
        try { controller.close(); } catch { /* Stream already closed by the client. */ }
      };
      const onAbort = () => close();
      const poll = async () => {
        if (closed || busy) return;
        busy = true;
        ticks += 1;
        try {
          if (ticks % 5 === 0) {
            const current = await prisma.rechargeRequest.findUnique({ where: { id }, select: { status: true } });
            if (!current || current.status !== "PENDING") {
              send("closed", { status: current?.status ?? "MISSING" });
              close();
              return;
            }
          }
          const rows = await prisma.rechargeMessage.findMany({
            where: { rechargeRequestId: id }, orderBy: { createdAt: "desc" }, take: 100,
            include: { sender: { select: { id: true, name: true, role: true } } },
          });
          const messages = rows.reverse().map((message) => ({ id: message.id, body: message.body, createdAt: message.createdAt.toISOString(), sender: message.sender }));
          if (!sentSnapshot) {
            sentSnapshot = true;
            send("snapshot", { messages });
          } else {
            for (const message of messages) {
              if (!knownIds.has(message.id)) send("message", { message });
            }
          }
          knownIds = new Set(messages.map((message) => message.id));
        } catch {
          send("stream-error", { error: "Chat temporarily unavailable. Reconnecting…" });
        } finally {
          busy = false;
        }
      };
      const pollTimer = setInterval(() => { void poll(); }, 1000);
      const heartbeatTimer = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(": keep-alive\n\n"));
      }, 20000);
      closeStream = close;
      request.signal.addEventListener("abort", onAbort);
      void poll();
    },
    cancel() { closeStream(); },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
