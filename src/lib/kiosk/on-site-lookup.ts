import { findAppointmentsByQuery } from "@/lib/kiosk/appoint-lookup";
import { getVisitQueryRangeTaipei } from "@/lib/kiosk/api-helpers";
import { enrichRegisterList } from "@/lib/kiosk/appoint-enrichment";
import { normalizePlateNo } from "@/lib/kiosk/plate";
import { normalizePhoneDigits } from "@/lib/kiosk/phone";
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

  const byVisitor = appointList.find(
    (item) =>
      flat.visitorId &&
      String(item.visitorInfo?.visitorId ?? "").trim() === flat.visitorId,
  );
  const phone = normalizePhoneDigits(flat.phoneNo);
  const hit =
    byVisitor ??
    appointList.find(
      (item) =>
        phone &&
        normalizePhoneDigits(item.visitorInfo?.phoneNo ?? "") === phone,
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
  flat: FlatRegisterRecord,
  visit: VisitorVisit | undefined,
  appointList: AppointmentItem[],
): OnSiteRecordView => {
  const plateNo = normalizePlateNo(flat.plateNo);
  const visitorName = flat.visitorName || "—";
  const phoneNo = normalizePhoneDigits(flat.phoneNo);
  const isTemp = visit?.status === "temp_out";
  const reason = resolveReason(visit, flat, appointList);

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
    visitEndTime: flat.visitEndTime,
    visitingTime: flat.registerTime || flat.visitStartTime,
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
  const filterPhones = new Set(
    [
      phoneNo,
      ...appointList.map((item) =>
        normalizePhoneDigits(item.visitorInfo?.phoneNo ?? ""),
      ),
    ].filter(Boolean),
  );

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
    records.push(toView(item, visit, appointList));
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
      toView(visitToRegisterRecord(visit), visit, appointList),
    );
  }

  return { records, appointNotFound: false };
};
