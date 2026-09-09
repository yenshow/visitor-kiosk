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

/** YSCP 可能把 token 放在 header／query／body */
export const extractYscpEventToken = (
  request: Request,
  body: JsonObject | null,
  url: URL,
): string => {
  const headerToken =
    request.headers.get("token") ||
    request.headers.get("x-token") ||
    request.headers.get("x-yscp-token");
  if (headerToken?.trim()) return headerToken.trim();

  const queryToken = url.searchParams.get("token");
  if (queryToken?.trim()) return queryToken.trim();

  return pickString(body?.token, body?.Token);
};

const asDataObject = (value: unknown): JsonObject => {
  if (typeof value === "string") {
    try {
      return asObject(JSON.parse(value)) ?? {};
    } catch {
      return {};
    }
  }
  return asObject(value) ?? {};
};

const parseOneEvent = (raw: unknown): ParsedPlateEvent | null => {
  const event = asObject(raw);
  if (!event) return null;

  const data = asDataObject(event.data);
  const plateNo = normalizePlateNo(
    pickString(
      event.plateNo,
      event.plateNumber,
      event.licensePlate,
      data.plateNo,
      data.plateNumber,
      data.licensePlate,
      data.plateNum,
    ),
  );
  const cameraIndexCode = pickString(
    event.srcIndex,
    event.srcIndexCode,
    event.cameraIndexCode,
    data.srcIndex,
    data.srcIndexCode,
    data.cameraIndexCode,
  );
  if (!plateNo || !cameraIndexCode) return null;
  return { plateNo, cameraIndexCode };
};

/** YSCP 官方為 { method, params: { events: [...] } }，也相容頂層 events */
const collectEventList = (root: JsonObject): unknown[] => {
  const params = asObject(root.params);
  if (Array.isArray(params?.events)) return params.events;
  if (Array.isArray(root.events)) return root.events;
  if (Array.isArray(root.eventList)) return root.eventList;
  return [root];
};

export const parsePlateEvents = (body: unknown): ParsedPlateEvent[] => {
  const root = asObject(body);
  if (!root) return [];

  const parsed: ParsedPlateEvent[] = [];
  for (const item of collectEventList(root)) {
    const one = parseOneEvent(item);
    if (one) parsed.push(one);
  }
  return parsed;
};

/** 解析失敗時的精簡摘要（不含完整 payload） */
export const summarizeYscpEventBody = (body: unknown): string => {
  const root = asObject(body);
  if (!root) return "body=invalid";

  const params = asObject(root.params);
  const list = collectEventList(root);
  const first = asObject(list[0]);
  const data = first ? asDataObject(first.data) : {};
  const hasPlate = Boolean(
    pickString(
      first?.plateNo,
      first?.plateNumber,
      first?.licensePlate,
      data.plateNo,
      data.plateNumber,
      data.licensePlate,
      data.plateNum,
    ),
  );
  const srcIndex = pickString(
    first?.srcIndex,
    first?.srcIndexCode,
    first?.cameraIndexCode,
    data.srcIndex,
  );

  return [
    `method=${pickString(root.method) || "-"}`,
    `ability=${pickString(params?.ability, root.ability) || "-"}`,
    `raw=${list.length}`,
    `srcIndex=${srcIndex || "-"}`,
    `hasPlate=${hasPlate ? "1" : "0"}`,
    `keys=${Object.keys(root).join(",") || "-"}`,
  ].join(" ");
};

export const asJsonObject = asObject;
