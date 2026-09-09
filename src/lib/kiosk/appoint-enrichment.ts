import type { AppointmentItem } from "@/lib/yscp/visitor-api";
import { normalizePhoneDigits } from "@/lib/kiosk/phone";
import { normalizePlateNo } from "@/lib/kiosk/plate";
import { buildPlateCacheIndex } from "@/lib/kiosk/plate-cache";
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

/** meta／車牌快取 > 在廠紀錄 > 預約補齊 */
export const mergeRegisterFields = (
  flat: FlatRegisterRecord,
  options?: {
    enrich?: AppointEnrichment | null;
    meta?: VisitorMetaEntry | null;
    cachedPlate?: string | null;
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
    plateNo:
      normalizePlateNo(meta?.plateNo) ||
      normalizePlateNo(options?.cachedPlate) ||
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
  };
};

/** 在廠清單補齊被訪人／車牌／公司（預約 + 本機快取） */
export const enrichRegisterList = async (
  list: FlatRegisterRecord[],
  appointments: AppointmentItem[] | undefined,
  visitorMeta: VisitorMetaEntry[],
  plateIndex?: Awaited<ReturnType<typeof buildPlateCacheIndex>>,
): Promise<FlatRegisterRecord[]> => {
  const index = buildAppointEnrichmentIndex(appointments ?? []);
  const plates = plateIndex ?? (await buildPlateCacheIndex());
  const metaById = new Map(visitorMeta.map((item) => [item.recordId, item]));

  return list.map((flat) => {
    const phone = normalizePhoneDigits(flat.phoneNo);
    const cachedPlate =
      plates.byRecordId.get(flat.recordId) ||
      (flat.visitorId ? plates.byVisitorId.get(flat.visitorId) : undefined) ||
      (phone ? plates.byPhone.get(phone) : undefined) ||
      "";

    return mergeRegisterFields(flat, {
      enrich: findAppointEnrichment(index, flat),
      meta: metaById.get(flat.recordId),
      cachedPlate,
    });
  });
};
