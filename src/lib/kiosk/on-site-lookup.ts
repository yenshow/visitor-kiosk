import { findAppointmentsByQuery } from "@/lib/kiosk/appoint-lookup";
import { getVisitQueryRangeTaipei } from "@/lib/kiosk/api-helpers";
import { enrichRegisterList } from "@/lib/kiosk/appoint-enrichment";
import { normalizePlateNo } from "@/lib/kiosk/plate";
import { normalizePhoneDigits } from "@/lib/kiosk/phone";
import { getPresenceStore } from "@/lib/kiosk/presence";
import {
  flattenRegisterList,
  type FlatRegisterRecord,
} from "@/lib/kiosk/register-record";
import { createCheckoutToken } from "@/lib/kiosk/session";
import type { OnSiteRecordView } from "@/lib/kiosk/visitor-query";
import {
  getVisitorRegisterRecords,
  type AppointmentItem,
} from "@/lib/yscp/visitor-api";

type OnSiteLookupResult = {
  records: OnSiteRecordView[];
  appointNotFound: boolean;
};

const toView = (
  flat: FlatRegisterRecord,
  tempOutById: Map<string, { at: string }>,
): OnSiteRecordView => {
  const plateNo = normalizePlateNo(flat.plateNo);
  const visitorName = flat.visitorName || "—";
  const phoneNo = normalizePhoneDigits(flat.phoneNo);
  const tempOut = tempOutById.get(flat.recordId);

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
    presence: tempOut ? "temp_out" : "on_site",
    tempOutAt: tempOut?.at,
    visitStartTime: flat.visitStartTime || flat.registerTime,
    visitEndTime: flat.visitEndTime,
    visitingTime: flat.registerTime || flat.visitStartTime,
  };
};

export const lookupOnSiteRecords = async (input: {
  phoneNo: string;
  appointCode: string;
  /** 若呼叫端已查過預約，傳入可避免重複打 YSCP */
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

  const rawList = flattenRegisterList(
    (await getVisitorRegisterRecords(getVisitQueryRangeTaipei())).list,
  );
  const presence = await getPresenceStore(
    new Set(rawList.map((item) => item.recordId)),
  );
  const onSiteList = await enrichRegisterList(
    rawList,
    appointList,
    presence.visitorMeta,
  );
  const tempOutById = new Map(
    presence.tempOut.map((item) => [item.recordId, { at: item.at }]),
  );

  const records = onSiteList
    .filter((item) => {
      if (item.visitorId && filterVisitorIds.has(item.visitorId)) return true;
      const itemPhone = normalizePhoneDigits(item.phoneNo);
      return Boolean(itemPhone && filterPhones.has(itemPhone));
    })
    .map((item) => toView(item, tempOutById));

  return { records, appointNotFound: false };
};
