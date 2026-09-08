import type { VisitorRegisterRecord } from "@/lib/hcp/visitor-api";
import { normalizePlateNo } from "@/lib/kiosk/plate";
import { displayVisitorName } from "@/lib/kiosk/visitor-fields";

export type FlatRegisterRecord = {
  recordId: string;
  visitorId: string;
  visitorName: string;
  phoneNo: string;
  companyName: string;
  receptionistName: string;
  plateNo: string;
  visitStartTime: string;
  visitEndTime: string;
  registerTime: string;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const pickText = (
  obj: Record<string, unknown> | null,
  keys: string[],
): string => {
  if (!obj) return "";
  for (const key of keys) {
    const value = obj[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text && text !== "null" && text !== "undefined") return text;
  }
  return "";
};

/** YSCP 在廠記錄扁平化（欄位多在 visitorBaseInfo） */
export const flattenRegisterRecord = (
  raw: unknown,
): FlatRegisterRecord | null => {
  const root = asRecord(raw);
  if (!root) return null;

  const base =
    asRecord(root.visitorBaseInfo) ??
    asRecord(root.visitorInfo) ??
    asRecord(root.VisitorInfo);

  const recordId = pickText(root, ["recordId", "appointRecordId"]);
  if (!recordId) return null;

  const fromBaseOrRoot = (keys: string[]) =>
    pickText(base, keys) || pickText(root, keys);

  return {
    recordId,
    visitorId: fromBaseOrRoot(["visitorId"]),
    visitorName: displayVisitorName(
      fromBaseOrRoot(["visitorFamilyName"]),
      fromBaseOrRoot(["visitorGivenName"]),
      fromBaseOrRoot(["fullName", "visitorName", "name"]),
    ),
    phoneNo: fromBaseOrRoot(["phoneNum", "phoneNo", "phone", "mobile"]),
    companyName:
      fromBaseOrRoot(["companyName"]) ||
      fromBaseOrRoot(["visitorGroup", "visitorGroupName"]),
    receptionistName:
      pickText(root, [
        "receptionistName",
        "interviewName",
        "beVisitedPersonName",
        "hostName",
      ]) ||
      pickText(base, [
        "receptionistName",
        "interviewName",
        "beVisitedPersonName",
        "hostName",
      ]),
    plateNo: normalizePlateNo(
      fromBaseOrRoot([
        "plateNo",
        "plateNumber",
        "vehiclePlate",
        "carNumber",
        "licensePlate",
      ]),
    ),
    visitStartTime:
      pickText(base, ["visitStartTime"]) ||
      pickText(root, ["visitStartTime", "visitingTime", "registerTime"]),
    visitEndTime:
      pickText(base, ["visitEndTime"]) || pickText(root, ["visitEndTime"]),
    registerTime: pickText(root, ["registerTime", "visitingTime"]),
  };
};

export const flattenRegisterList = (
  list: VisitorRegisterRecord[] | undefined,
): FlatRegisterRecord[] =>
  (list ?? [])
    .map((item) => flattenRegisterRecord(item))
    .filter((item): item is FlatRegisterRecord => item !== null);
