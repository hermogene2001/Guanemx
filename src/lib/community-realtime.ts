import { Client } from "pg";
import type { WebSocket } from "ws";
import { prisma } from "@/lib/prisma";

const CHANNEL = "guanemx_community_general";
type CommunityMessage = { id: string; body: string; createdAt: string; reported?: boolean; author: { id: string; name: string; role: string } };

type RealtimeState = {
  sockets: Set<WebSocket>;
  listener?: Client;
  listenerReady?: Promise<void>;
  reconnectTimer?: NodeJS.Timeout;
};

const globalForRealtime = globalThis as typeof globalThis & { communityRealtime?: RealtimeState };
const state = globalForRealtime.communityRealtime ??= { sockets: new Set<WebSocket>() };

function broadcast(message: CommunityMessage) {
  const payload = JSON.stringify({ type: "message", message });
  for (const socket of state.sockets) {
    if (socket.readyState === 1) socket.send(payload);
  }
}

async function relayMessage(id: string) {
  const message = await prisma.communityMessage.findUnique({
    where: { id },
    include: { author: { select: { id: true, name: true, role: true } } },
  });
  if (!message || message.deletedAt) return;
  broadcast({
    id: message.id,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    reported: Boolean(message.reportedAt),
    author: message.author,
  });
}

function scheduleReconnect(client: Client) {
  if (state.listener !== client) return;
  state.listener = undefined;
  state.listenerReady = undefined;
  if (state.sockets.size === 0 || state.reconnectTimer) return;
  state.reconnectTimer = setTimeout(() => {
    state.reconnectTimer = undefined;
    void ensureCommunityRealtime().catch((error: unknown) => {
      console.error("Community database listener reconnect failed.", error);
    });
  }, 1500);
}

export async function ensureCommunityRealtime() {
  if (state.listenerReady) return state.listenerReady;
  const connectionString = process.env.POSTGRES_URL_NON_POOLING
    ?? process.env.DATABASE_URL_UNPOOLED
    ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("A direct PostgreSQL connection is required for community live updates.");

  const client = new Client({
    connectionString,
    application_name: "guanemx-community-live",
    connectionTimeoutMillis: 5000,
    keepAlive: true,
  });
  state.listener = client;
  client.on("notification", (notification) => {
    if (notification.channel !== CHANNEL || !notification.payload) return;
    void relayMessage(notification.payload).catch((error: unknown) => {
      console.error("Community message relay failed.", error);
    });
  });
  client.on("error", (error) => {
    console.error("Community database listener failed.", error);
    scheduleReconnect(client);
    void client.end().catch(() => undefined);
  });
  client.on("end", () => scheduleReconnect(client));

  const ready = client.connect()
    .then(() => client.query(`LISTEN ${CHANNEL}`))
    .then(() => undefined)
    .catch(async (error: unknown) => {
      scheduleReconnect(client);
      await client.end().catch(() => undefined);
      throw error;
    });
  state.listenerReady = ready;
  return ready;
}

export function registerCommunitySocket(socket: WebSocket) {
  state.sockets.add(socket);
}

export function unregisterCommunitySocket(socket: WebSocket) {
  state.sockets.delete(socket);
  if (state.sockets.size === 0 && state.reconnectTimer) {
    clearTimeout(state.reconnectTimer);
    state.reconnectTimer = undefined;
  }
}

export async function publishCommunityMessage(id: string) {
  try {
    await prisma.$queryRaw`SELECT pg_notify(${CHANNEL}, ${id})`;
  } catch (error) {
    console.error("Community message notification failed.", error);
  }
}
