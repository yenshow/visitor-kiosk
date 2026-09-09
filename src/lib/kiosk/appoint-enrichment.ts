import type { AppointmentItem } from "@/lib/yscp/visitor-api";
import { normalizePhoneDigits } from "@/lib/kiosk/phone";
import { normalizePlateNo } from "@/lib/kiosk/plate";
import type { VisitorMetaEntry } from "@/lib/kiosk/presence";
import type { FlatRegisterRecord } from "@/lib/kiosk/register-record";
import { displayVisitorName } from "@/lib/kiosk/visitor-fields";

export type AppointEnrichment = {
  visitorId: string;
  phoneNo: string;
  visitorName: string;
  plateNo: string;
  companyName: string;
  receptionistName: string;
  visitEndTime: string;
};

/** 已簽到優先，再取較新的 appointID */
const rankAppointments = (list: AppointmentItem[]): AppointmentItem[] =>
  [...list].sort((a, b) => {
    const aIn = Number(a.appointStatus) === 3 ? 1 : 0;
    const bIn = Number(b.appointStatus) === 3 ? 1 : 0;
    if (aIn !== bIn) return bIn - aIn;
    return String(b.appointID ?? "").localeCompare(String(a.appointID ?? ""));
  });

export const buildAppointEnrichmentIndex = (list: AppointmentItem[]) => {
  const byVisitorId = new Map<string, AppointEnrichment>();
  const byPhone = new Map<string, AppointEnrichment>();

  for (const item of rankAppointments(list)) {
    const info = item.visitorInfo;
    const visitorId = String(info?.visitorId ?? "").trim();
    const phoneNo = normalizePhoneDigits(info?.phoneNo ?? "");
    const enrichment: AppointEnrichment = {
      visitorId,
      phoneNo,
      visitorName: displayVisitorName(
        info?.visitorFamilyName,
        info?.visitorGivenName,
        info?.visitorName,
      ),
      plateNo: normalizePlateNo(info?.plateNo),
      companyName: String(info?.companyName ?? "").trim(),
      receptionistName: String(item.receptionistName ?? "").trim(),
      visitEndTime: String(item.appointEndTime ?? "").trim(),
    };

    if (visitorId && !byVisitorId.has(visitorId)) {
      byVisitorId.set(visitorId, enrichment);
    }
    if (phoneNo && !byPhone.has(phoneNo)) {
      byPhone.set(phoneNo, enrichment);
    }
  }

  return { byVisitorId, byPhone };
};

export const findAppointEnrichment = (
  index: ReturnType<typeof buildAppointEnrichmentIndex>,
  flat: Pick<FlatRegisterRecord, "visitorId" | "phoneNo">,
): AppointEnrichment | null => {
  if (flat.visitorId) {
    const byId = index.byVisitorId.get(flat.visitorId);
    if (byId) return byId;
  }
  const phone = normalizePhoneDigits(flat.phoneNo);
  if (phone) return index.byPhone.get(phone) ?? null;
  return null;
};

/** meta（報到後本機紀錄）> 在廠紀錄 > 預約補齊 */
export const mergeRegisterFields = (
  flat: FlatRegisterRecord,
  options?: {
    enrich?: AppointEnrichment | null;
    meta?: VisitorMetaEntry | null;
  },
): FlatRegisterRecord => {
  const enrich = options?.enrich;
  const meta = options?.meta;
  const metaName =
    meta?.visitorName && meta.visitorName !== "—" ? meta.visitorName : "";
  const enrichName =
    enrich?.visitorName && enrich.visitorName !== "—"
      ? enrich.visitorName
      : "";

  return {
    ...flat,
    visitorName: metaName || enrichName || flat.visitorName,
    phoneNo:
      normalizePhoneDigits(meta?.phoneNo ?? "") ||
      normalizePhoneDigits(flat.phoneNo) ||
      normalizePhoneDigits(enrich?.phoneNo ?? "") ||
      "",
    plateNo:
      normalizePlateNo(meta?.plateNo) ||
      flat.plateNo ||
      normalizePlateNo(enrich?.plateNo) ||
      "",
    companyName:
      String(meta?.companyName ?? "").trim() ||
      flat.companyName ||
      String(enrich?.companyName ?? "").trim() ||
      "",
    receptionistName:
      String(meta?.receptionistName ?? "").trim() ||
      flat.receptionistName ||
      String(enrich?.receptionistName ?? "").trim() ||
      "",
    visitEndTime:
      flat.visitEndTime || String(enrich?.visitEndTime ?? "").trim() || "",
  };
};

/** 在廠清單補齊：優先用報到後 visitorMeta */
export const enrichRegisterList = async (
  list: FlatRegisterRecord[],
  appointments: AppointmentItem[] | undefined,
  visitorMeta: VisitorMetaEntry[],
): Promise<FlatRegisterRecord[]> => {
  const index = buildAppointEnrichmentIndex(appointments ?? []);
  const metaById = new Map(visitorMeta.map((item) => [item.recordId, item]));

  return list.map((flat) =>
    mergeRegisterFields(flat, {
      enrich: findAppointEnrichment(index, flat),
      meta: metaById.get(flat.recordId),
    }),
  );
};
