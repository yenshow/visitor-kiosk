import {
  loadPresenceSnapshot,
  statsFromSnapshot,
  type KioskStats,
} from "@/lib/kiosk/stats";
import { displayVisitorName } from "@/lib/kiosk/visitor-fields";
import type { FlatRegisterRecord } from "@/lib/kiosk/register-record";
import type { VisitorVisit } from "@/lib/kiosk/presence";

export type RecordPresence = "on_site" | "temp_out" | "departed";

export type VisitorRecordRow = {
  recordId: string;
  presence: RecordPresence;
  visitorName: string;
  phoneNo: string;
  plateNo: string;
  companyName: string;
  receptionistName: string;
  /** 顯示用時間：在場＝報到；外出＝外出時間；離場＝簽退時間 */
  at: string;
  /** 僅 departed：是否為台北今日離場 */
  isDepartedToday?: boolean;
};

export type VisitorRecordsPayload = {
  summary: KioskStats;
  rows: VisitorRecordRow[];
};

const toRow = (
  presence: RecordPresence,
  fields: {
    recordId: string;
    visitorName: string;
    phoneNo: string;
    plateNo: string;
    companyName: string;
    receptionistName: string;
  },
  at: string,
  isDepartedToday?: boolean,
): VisitorRecordRow => ({
  recordId: fields.recordId,
  presence,
  visitorName: displayVisitorName(undefined, undefined, fields.visitorName),
  phoneNo: fields.phoneNo,
  plateNo: fields.plateNo,
  companyName: fields.companyName,
  receptionistName: fields.receptionistName,
  at,
  isDepartedToday,
});

const activeAt = (
  visit: VisitorVisit | undefined,
  item: FlatRegisterRecord,
  preferTempOut: boolean,
): string => {
  if (preferTempOut && visit?.tempOutAt) return visit.tempOutAt;
  return visit?.checkinAt || item.registerTime || item.visitStartTime || "";
};

export const listVisitorRecords =
  async (): Promise<VisitorRecordsPayload> => {
    const snap = await loadPresenceSnapshot();
    const todayIds = new Set(snap.departedToday.map((item) => item.recordId));

    const rows: VisitorRecordRow[] = [
      ...snap.onSitePeople.map((item) =>
        toRow(
          "on_site",
          item,
          activeAt(snap.visitsById.get(item.recordId), item, false),
        ),
      ),
      ...snap.tempOutPeople.map((item) =>
        toRow(
          "temp_out",
          item,
          activeAt(snap.visitsById.get(item.recordId), item, true),
        ),
      ),
      ...snap.departedAll.map((item) =>
        toRow(
          "departed",
          item,
          item.departedAt || item.checkinAt,
          todayIds.has(item.recordId),
        ),
      ),
    ];

    rows.sort((a, b) => b.at.localeCompare(a.at));

    return {
      summary: statsFromSnapshot(snap),
      rows,
    };
  };
