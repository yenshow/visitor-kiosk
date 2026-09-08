import {
  loadPresenceSnapshot,
  statsFromSnapshot,
  type KioskStats,
} from "@/lib/kiosk/stats";
import { displayVisitorName } from "@/lib/kiosk/visitor-fields";

export type RecordPresence = "on_site" | "temp_out" | "departed";

export type VisitorRecordRow = {
  recordId: string;
  presence: RecordPresence;
  visitorName: string;
  phoneNo: string;
  plateNo: string;
  companyName: string;
  receptionistName: string;
  /** 顯示用時間：在場／外出＝報到；離場＝簽退時間 */
  at: string;
};

export type VisitorRecordsPayload = {
  summary: KioskStats;
  rows: VisitorRecordRow[];
};

export const listVisitorRecords =
  async (): Promise<VisitorRecordsPayload> => {
    const snap = await loadPresenceSnapshot();
    const rows: VisitorRecordRow[] = [];

    for (const item of snap.onSitePeople) {
      rows.push({
        recordId: item.recordId,
        presence: "on_site",
        visitorName: displayVisitorName(
          undefined,
          undefined,
          item.visitorName,
        ),
        phoneNo: item.phoneNo,
        plateNo: item.plateNo,
        companyName: item.companyName,
        receptionistName: item.receptionistName,
        at: item.registerTime || item.visitStartTime,
      });
    }

    for (const item of snap.tempOutPeople) {
      const temp = snap.tempOutById.get(item.recordId);
      rows.push({
        recordId: item.recordId,
        presence: "temp_out",
        visitorName: displayVisitorName(
          undefined,
          undefined,
          item.visitorName,
        ),
        phoneNo: item.phoneNo,
        plateNo: item.plateNo || temp?.plateNo || "",
        companyName: item.companyName,
        receptionistName: item.receptionistName,
        at: temp?.at || item.registerTime || item.visitStartTime,
      });
    }

    for (const item of snap.departedToday) {
      rows.push({
        recordId: `departed-${item.recordId}`,
        presence: "departed",
        visitorName: displayVisitorName(
          undefined,
          undefined,
          item.visitorName,
        ),
        phoneNo: "",
        plateNo: item.plateNo,
        companyName: "",
        receptionistName: "",
        at: item.at,
      });
    }

    rows.sort((a, b) => b.at.localeCompare(a.at));

    return {
      summary: statsFromSnapshot(snap),
      rows,
    };
  };
