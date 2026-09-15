type Bucket = {
  count: number;
  resetAt: number;
};

type FailLock = {
  fails: number;
  lockedUntil: number;
};

const globalStore = globalThis as typeof globalThis & {
  __kioskRateBuckets?: Map<string, Bucket>;
  __kioskQueryLocks?: Map<string, FailLock>;
};

const getBuckets = () => {
  if (!globalStore.__kioskRateBuckets) {
    globalStore.__kioskRateBuckets = new Map();
  }
  return globalStore.__kioskRateBuckets;
};

const getLocks = () => {
  if (!globalStore.__kioskQueryLocks) {
    globalStore.__kioskQueryLocks = new Map();
  }
  return globalStore.__kioskQueryLocks;
};

/** 每 windowMs 內最多 max 次 */
export const takeRateToken = (
  key: string,
  max: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterSec: number } => {
  const store = getBuckets();
  const now = Date.now();
  const existing = store.get(key);
  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (existing.count >= max) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  existing.count += 1;
  return { ok: true };
};

const QUERY_FAIL_MAX = 5;
const QUERY_LOCK_MS = 10 * 60 * 1000;

export const checkQueryLock = (
  queryKey: string,
): { locked: false } | { locked: true; retryAfterSec: number } => {
  const entry = getLocks().get(queryKey);
  if (!entry || entry.lockedUntil <= Date.now()) return { locked: false };
  return {
    locked: true,
    retryAfterSec: Math.max(
      1,
      Math.ceil((entry.lockedUntil - Date.now()) / 1000),
    ),
  };
};

export const recordQueryFailure = (queryKey: string): void => {
  const store = getLocks();
  const now = Date.now();
  const entry = store.get(queryKey);
  if (entry && entry.lockedUntil > now) return;

  // 無紀錄或鎖已過期 → 從 1；lockedUntil===0 表示累計中則加一
  const fails =
    !entry || (entry.lockedUntil > 0 && entry.lockedUntil <= now)
      ? 1
      : entry.fails + 1;

  store.set(queryKey, {
    fails,
    lockedUntil: fails >= QUERY_FAIL_MAX ? now + QUERY_LOCK_MS : 0,
  });
};

export const clearQueryFailures = (queryKey: string): void => {
  getLocks().delete(queryKey);
};

export const rateLimitResponse = (retryAfterSec: number) =>
  Response.json(
    {
      code: "429",
      msg: `請求過於頻繁，請 ${retryAfterSec} 秒後再試`,
      data: null,
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    },
  );

export const QUERY_RATE_MAX = 20;
export const QUERY_RATE_WINDOW_MS = 60_000;
export const ADMIN_RATE_MAX = 30;
export const ADMIN_RATE_WINDOW_MS = 60_000;
