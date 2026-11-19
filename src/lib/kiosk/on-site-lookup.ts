import { findAppointmentsByQuery } from "@/lib/kiosk/appoint-lookup";
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
import { createCheckoutToken } from "@/lib/kiosk/session";
import type { AppointmentItem } from "@/lib/kiosk/visitor";
import type { OnSiteRecordView } from "@/lib/kiosk/visitor-query";
import { visitReasonLabel } from "@/lib/kiosk/visit-reason";

type OnSiteLookupResult = {
  records: OnSiteRecordView[];
  appointNotFound: boolean;
  incompleteVisitorId?: boolean;
};

const resolveReason = (
  visit: VisitorVisit,
  appointList: AppointmentItem[],
): { visitReasonType?: number; visitReason?: string } => {
  if (visit.visitReasonType !== undefined) {
    return {
      visitReasonType: visit.visitReasonType,
      visitReason: visitReasonLabel(visit.visitReasonType),
    };
  }

  const visitorId = String(visit.visitorId ?? "").trim();
  const hit = visitorId
    ? appointList.find(
        (item) =>
          String(item.visitorInfo?.visitorId ?? "").trim() === visitorId,
      )
    : appointList.find(
        (item) =>
          normalizePhoneDigits(item.visitorInfo?.phoneNo ?? "") ===
          normalizePhoneDigits(visit.phoneNo),
      );
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
  visit: VisitorVisit,
  appointList: AppointmentItem[],
): OnSiteRecordView => {
  const flat = visitToRegisterRecord(visit);
  const plateNo = normalizePlateNo(visit.plateNo);
  const visitorName = visit.visitorName || "—";
  const phoneNo = normalizePhoneDigits(visit.phoneNo);
  const isTemp = visit.status === "temp_out";
  const reason = resolveReason(visit, appointList);
  const visitEndTime = effectiveVisitEndTime(flat, visit);
  const bucket = classifyActivePresence({ visit, flat });
  const isOverstay = bucket === "overstay";

  return {
    token: createCheckoutToken({
      appointRecordId: visit.recordId,
      visitorName,
      plateNo,
      phoneNo,
      companyName: visit.companyName,
      receptionistName: visit.receptionistName || "",
    }),
    visitorName,
    phoneNo,
    companyName: visit.companyName,
    receptionistName: visit.receptionistName || "",
    plateNo,
    presence: isTemp ? "temp_out" : "on_site",
    tempOutAt: isTemp ? visit.tempOutAt : undefined,
    visitReasonType: reason.visitReasonType,
    visitReason: reason.visitReason,
    visitStartTime: visit.checkinAt,
    visitEndTime,
    visitingTime: visit.checkinAt,
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

  const filterPhones = new Set(phoneNo ? [phoneNo] : []);
  const store = await getVisitStore();
  const records: OnSiteRecordView[] = [];

  for (const visit of store.visits) {
    if (visit.status !== "on_site" && visit.status !== "temp_out") continue;
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
    records.push(toView(visit, appointList));
  }

  return { records, appointNotFound: false };
};
