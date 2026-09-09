import { normalizePlateNo } from "@/lib/kiosk/plate";

type JsonObject = Record<string, unknown>;

export type ParsedPlateEvent = {
  plateNo: string;
  cameraIndexCode: string;
};

const asObject = (value: unknown): JsonObject | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;

const pickString = (...values: unknown[]): string => {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
};

/** HCP 可能把 token 放在 header／query／body */
export const extractHcpEventToken = (
  request: Request,
  body: JsonObject | null,
  url: URL,
): string => {
  // Fetch headers 大小寫不敏感
  const headerToken =
    request.headers.get("token") ||
    request.headers.get("x-token") ||
    request.headers.get("x-hcp-token");
  if (headerToken?.trim()) return headerToken.trim();

  const queryToken = url.searchParams.get("token");
  if (queryToken?.trim()) return queryToken.trim();

  return pickString(body?.token, body?.Token);
};

const parseOneEvent = (raw: unknown): ParsedPlateEvent | null => {
  const event = asObject(raw);
  if (!event) return null;

  const data = asObject(event.data) ?? {};
  const plateNo = normalizePlateNo(
    pickString(
      event.plateNo,
      event.plateNumber,
      data.plateNo,
      data.plateNumber,
      data.licensePlate,
    ),
  );
  const cameraIndexCode = pickString(
    event.srcIndex,
    event.srcIndexCode,
    event.cameraIndexCode,
    data.srcIndex,
  );
  if (!plateNo || !cameraIndexCode) return null;
  return { plateNo, cameraIndexCode };
};

export const parsePlateEvents = (body: unknown): ParsedPlateEvent[] => {
  const root = asObject(body);
  if (!root) return [];

  const list = Array.isArray(root.events) ? root.events : [root];
  const parsed: ParsedPlateEvent[] = [];
  for (const item of list) {
    const one = parseOneEvent(item);
    if (one) parsed.push(one);
  }
  return parsed;
};

export const asJsonObject = asObject;
