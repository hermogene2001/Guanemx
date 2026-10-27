import Redis from "ioredis";
import type { WebSocket } from "ws";

const CHANNEL = "guanemx:community:general";
type CommunityMessageEvent = { type: "message"; message: { id: string; body: string; createdAt: string; reported?: boolean; author: { id: string; name: string; role: string } } };

type RealtimeState = {
  sockets: Set<WebSocket>;
  publisher?: Redis;
  subscriber?: Redis;
  subscription?: Promise<void>;
};

const globalForRealtime = globalThis as typeof globalThis & { communityRealtime?: RealtimeState };
const state = globalForRealtime.communityRealtime ??= { sockets: new Set<WebSocket>() };

function broadcast(payload: string) {
  for (const socket of state.sockets) {
    if (socket.readyState === 1) socket.send(payload);
  }
}

function getPublisher() {
  if (!process.env.REDIS_URL) return null;
  return state.publisher ??= new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 2, retryStrategy: (times) => Math.min(times * 250, 3000) });
}

export async function ensureCommunityRealtime() {
  if (!process.env.REDIS_URL) return false;
  if (!state.subscription) {
    const publisher = getPublisher();
    if (!publisher) return false;
    const subscriber = publisher.duplicate();
    state.subscriber = subscriber;
    state.subscription = subscriber.subscribe(CHANNEL).then(() => {
      subscriber.on("message", (_channel, payload) => broadcast(payload));
    }).catch((error: unknown) => {
      state.subscription = undefined;
      console.error("Community realtime subscription failed.", error);
      throw error;
    });
  }
  await state.subscription;
  return true;
}

export function registerCommunitySocket(socket: WebSocket) {
  state.sockets.add(socket);
}

export function unregisterCommunitySocket(socket: WebSocket) {
  state.sockets.delete(socket);
}

export async function publishCommunityMessage(message: CommunityMessageEvent["message"]) {
  const payload = JSON.stringify({ type: "message", message } satisfies CommunityMessageEvent);
  const publisher = getPublisher();
  if (!publisher) {
    broadcast(payload);
    return;
  }
  try {
    await publisher.publish(CHANNEL, payload);
  } catch (error) {
    console.error("Community realtime publish failed.", error);
  }
}
