import { randomBytes } from "crypto";
import type { VisitStatus } from "@/lib/kiosk/presence";
import type { AppointmentItem } from "@/lib/kiosk/visitor";

type SessionEntry = {
  item: AppointmentItem;
  expiresAt: number;
};

export type CheckoutSessionPayload = {
  appointRecordId: string;
  status: VisitStatus;
  eventCount: number;
};

type CheckoutSessionEntry = CheckoutSessionPayload & {
  expiresAt: number;
};

const TTL_MS = 10 * 60 * 1000;

const globalStore = globalThis as typeof globalThis & {
  __kioskCheckinSessions?: Map<string, SessionEntry>;
  __kioskCheckoutSessions?: Map<string, CheckoutSessionEntry>;
};

const getCheckinStore = () => {
  if (!globalStore.__kioskCheckinSessions) {
    globalStore.__kioskCheckinSessions = new Map();
  }
  return globalStore.__kioskCheckinSessions;
};

const getCheckoutStore = () => {
  if (!globalStore.__kioskCheckoutSessions) {
    globalStore.__kioskCheckoutSessions = new Map();
  }
  return globalStore.__kioskCheckoutSessions;
};

const prune = <T extends { expiresAt: number }>(store: Map<string, T>) => {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (value.expiresAt <= now) store.delete(key);
  }
};

const newToken = () => randomBytes(24).toString("hex");

export const createCheckinToken = (item: AppointmentItem): string => {
  const store = getCheckinStore();
  prune(store);
  const token = newToken();
  store.set(token, { item, expiresAt: Date.now() + TTL_MS });
  return token;
};

export const consumeCheckinToken = (token: string): AppointmentItem | null => {
  const store = getCheckinStore();
  prune(store);
  const entry = store.get(token);
  if (!entry) return null;
  store.delete(token);
  return entry.item;
};

export const peekCheckinToken = (token: string): AppointmentItem | null => {
  const store = getCheckinStore();
  prune(store);
  return store.get(token)?.item ?? null;
};

export const createCheckoutToken = (
  payload: CheckoutSessionPayload,
): string => {
  const store = getCheckoutStore();
  prune(store);
  const token = newToken();
  store.set(token, { ...payload, expiresAt: Date.now() + TTL_MS });
  return token;
};

const toCheckoutPayload = (
  entry: CheckoutSessionEntry,
): CheckoutSessionPayload => ({
  appointRecordId: entry.appointRecordId,
  status: entry.status,
  eventCount: entry.eventCount,
});

export const consumeCheckoutToken = (
  token: string,
): CheckoutSessionPayload | null => {
  const store = getCheckoutStore();
  prune(store);
  const entry = store.get(token);
  if (!entry) return null;
  store.delete(token);
  return toCheckoutPayload(entry);
};

export const peekCheckoutToken = (
  token: string,
): CheckoutSessionPayload | null => {
  const store = getCheckoutStore();
  prune(store);
  const entry = store.get(token);
  if (!entry) return null;
  return toCheckoutPayload(entry);
};
