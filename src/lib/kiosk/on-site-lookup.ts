import { findAppointmentsByQuery } from "@/lib/kiosk/appoint-lookup";
import { getVisitQueryRangeTaipei } from "@/lib/kiosk/api-helpers";
import { enrichRegisterList } from "@/lib/kiosk/appoint-enrichment";
import { normalizePhoneDigits, normalizePlateNo } from "@/lib/kiosk/normalize";
import {
  classifyActivePresence,
  effectiveVisitEndTime,
} from "@/lib/kiosk/presence-classify";
import {
  getVisitStore,
  visitToRegisterRecord,
  type VisitorVisit,
} from "@/lib/kiosk/presence";
import {
  flattenRegisterList,
  type FlatRegisterRecord,
} from "@/lib/kiosk/register-record";
import { createCheckoutToken } from "@/lib/kiosk/session";
import type { OnSiteRecordView } from "@/lib/kiosk/visitor-query";
import { visitReasonLabel } from "@/lib/kiosk/visit-reason";
import {
  getVisitorRegisterRecords,
  type AppointmentItem,
} from "@/lib/yscp/visitor-api";

type OnSiteLookupResult = {
  records: OnSiteRecordView[];
  appointNotFound: boolean;
  /** 預約命中但缺少 visitorId，無法對應在廠列 */
  incompleteVisitorId?: boolean;
};

const resolveReason = (
  visit: VisitorVisit | undefined,
  flat: FlatRegisterRecord,
  appointList: AppointmentItem[],
): { visitReasonType?: number; visitReason?: string } => {
  if (visit?.visitReasonType !== undefined) {
    return {
      visitReasonType: visit.visitReasonType,
      visitReason: visitReasonLabel(visit.visitReasonType),
    };
  }

  const visitorId = String(flat.visitorId ?? "").trim();
  let hit: AppointmentItem | undefined;
  if (visitorId) {
    hit = appointList.find(
      (item) =>
        String(item.visitorInfo?.visitorId ?? "").trim() === visitorId,
    );
  } else {
    const phone = normalizePhoneDigits(flat.phoneNo);
    if (phone) {
      hit = appointList.find(
        (item) =>
          normalizePhoneDigits(item.visitorInfo?.phoneNo ?? "") === phone,
      );
    }
  }
  if (!hit) return {};

  const visitReasonType = Number(hit.visitReasonType);
  return {
    visitReasonType: Number.isFinite(visitReasonType)
      ? visitReasonType
      : undefined,
    visitReason: visitReasonLabel(
      hit.visitReasonType,
      hit.visitReasonDetail,
      hit.visitorReasonName,
    ),
  };
};

const toView = (
  flat: FlatRegisterRecord,
  visit: VisitorVisit | undefined,
  appointList: AppointmentItem[],
  inYscpRegisterList: boolean,
): OnSiteRecordView => {
  const plateNo = normalizePlateNo(flat.plateNo);
  const visitorName = flat.visitorName || "—";
  const phoneNo = normalizePhoneDigits(flat.phoneNo);
  const isTemp = visit?.status === "temp_out";
  const reason = resolveReason(visit, flat, appointList);
  const visitEndTime = effectiveVisitEndTime(flat, visit);
  const bucket = classifyActivePresence({
    visit,
    flat,
    inYscpRegisterList,
  });
  const isOverstay = bucket === "overstay";

  return {
    token: createCheckoutToken({
      appointRecordId: flat.recordId,
      visitorName,
      plateNo,
      phoneNo,
      companyName: flat.companyName,
      receptionistName: flat.receptionistName || "",
    }),
    visitorName,
    phoneNo,
    companyName: flat.companyName,
    receptionistName: flat.receptionistName || "",
    plateNo,
    presence: isTemp ? "temp_out" : "on_site",
    tempOutAt: isTemp ? visit?.tempOutAt : undefined,
    visitReasonType: reason.visitReasonType,
    visitReason: reason.visitReason,
    visitStartTime: flat.visitStartTime || flat.registerTime,
    visitEndTime,
    visitingTime: flat.registerTime || flat.visitStartTime,
    isOverstay,
  };
};

const matchesQuery = (
  visitorId: string,
  phoneNo: string,
  filterVisitorIds: Set<string>,
  filterPhones: Set<string>,
): boolean => {
  if (visitorId && filterVisitorIds.has(visitorId)) return true;
  const phone = normalizePhoneDigits(phoneNo);
  return Boolean(phone && filterPhones.has(phone));
};

export const lookupOnSiteRecords = async (input: {
  phoneNo: string;
  appointCode: string;
  appointments?: AppointmentItem[];
}): Promise<OnSiteLookupResult> => {
  const phoneNo = normalizePhoneDigits(input.phoneNo);
  const appointCode = String(input.appointCode ?? "").trim();
  if (!phoneNo && !appointCode) {
    return { records: [], appointNotFound: false };
  }

  const appointList =
    input.appointments ??
    (await findAppointmentsByQuery({ phoneNo, appointCode }));

  if (appointCode && appointList.length === 0) {
    return { records: [], appointNotFound: true };
  }

  const filterVisitorIds = new Set(
    appointList
      .map((item) => String(item.visitorInfo?.visitorId ?? "").trim())
      .filter(Boolean),
  );

  if (appointCode && appointList.length > 0 && filterVisitorIds.size === 0) {
    return { records: [], appointNotFound: false, incompleteVisitorId: true };
  }

  // 僅「手機查詢」才用手機比對；預約碼只鎖 visitorId
  const filterPhones = new Set(phoneNo ? [phoneNo] : []);

  const store = await getVisitStore();
  const visitById = new Map(store.visits.map((item) => [item.recordId, item]));
  const onSiteList = enrichRegisterList(
    flattenRegisterList(
      (await getVisitorRegisterRecords(getVisitQueryRangeTaipei())).list,
    ),
    appointList,
    store.visits,
  );

  const records: OnSiteRecordView[] = [];
  const listedIds = new Set<string>();

  for (const item of onSiteList) {
    if (
      !matchesQuery(
        item.visitorId,
        item.phoneNo,
        filterVisitorIds,
        filterPhones,
      )
    ) {
      continue;
    }
    const visit = visitById.get(item.recordId);
    if (visit?.status === "departed") continue;
    records.push(toView(item, visit, appointList, true));
    listedIds.add(item.recordId);
  }

  for (const visit of store.visits) {
    if (visit.status !== "on_site" && visit.status !== "temp_out") continue;
    if (listedIds.has(visit.recordId)) continue;
    if (
      !matchesQuery(
        visit.visitorId ?? "",
        visit.phoneNo,
        filterVisitorIds,
        filterPhones,
      )
    ) {
      continue;
    }
    records.push(
      toView(visitToRegisterRecord(visit), visit, appointList, false),
    );
  }

  return { records, appointNotFound: false };
};
