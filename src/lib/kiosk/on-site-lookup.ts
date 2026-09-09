import {
  getVisitorRegisterRecords,
  listAppointments,
} from "@/lib/yscp/visitor-api";
import {
  getAppointQueryRangeTaipei,
  getVisitQueryRangeTaipei,
} from "@/lib/kiosk/api-helpers";
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

type OnSiteLookupResult = {
  records: OnSiteRecordView[];
  appointNotFound: boolean;
};

const toView = (
  flat: FlatRegisterRecord,
  tempOutIds: Set<string>,
): OnSiteRecordView => {
  const plateNo = normalizePlateNo(flat.plateNo);
  const visitorName = flat.visitorName || "—";

  return {
    token: createCheckoutToken({
      appointRecordId: flat.recordId,
      visitorName,
      plateNo,
    }),
    visitorName,
    phoneNo: normalizePhoneDigits(flat.phoneNo),
    companyName: flat.companyName,
    receptionistName: flat.receptionistName || "",
    plateNo,
    presence: tempOutIds.has(flat.recordId) ? "temp_out" : "on_site",
    visitStartTime: flat.visitStartTime || flat.registerTime,
    visitEndTime: flat.visitEndTime,
    visitingTime: flat.registerTime || flat.visitStartTime,
  };
};

export const lookupOnSiteRecords = async (input: {
  phoneNo: string;
  appointCode: string;
}): Promise<OnSiteLookupResult> => {
  const { phoneNo, appointCode } = input;
  if (!phoneNo && !appointCode) {
    return { records: [], appointNotFound: false };
  }

  const [registerPayload, appointPayload] = await Promise.all([
    getVisitorRegisterRecords(getVisitQueryRangeTaipei()),
    appointCode
      ? listAppointments({
          appointCode,
          ...getAppointQueryRangeTaipei(),
        })
      : listAppointments({ ...getAppointQueryRangeTaipei() }),
  ]);

  if (appointCode && !appointPayload.list?.[0]) {
    return { records: [], appointNotFound: true };
  }

  const appointItem = appointPayload.list?.[0];
  const filterVisitorId = appointCode
    ? String(appointItem?.visitorInfo?.visitorId ?? "").trim()
    : "";
  const filterPhone =
    (appointCode
      ? normalizePhoneDigits(appointItem?.visitorInfo?.phoneNo ?? "")
      : "") || phoneNo;

  const rawList = flattenRegisterList(registerPayload.list);
  const presence = await getPresenceStore(
    new Set(rawList.map((item) => item.recordId)),
  );
  const onSiteList = await enrichRegisterList(
    rawList,
    appointPayload.list,
    presence.visitorMeta,
  );
  const tempOutIds = new Set(presence.tempOut.map((item) => item.recordId));

  const records = onSiteList
    .filter((item) => {
      if (filterVisitorId && item.visitorId === filterVisitorId) return true;
      return Boolean(
        filterPhone && normalizePhoneDigits(item.phoneNo) === filterPhone,
      );
    })
    .map((item) => toView(item, tempOutIds));

  return { records, appointNotFound: false };
};
