import { loadLegacyKioskData } from "@/lib/kiosk/appointments";
import { readKioskData } from "@/lib/kiosk/data-store";
import {
  presenceSnapshot,
  statsFromSnapshot,
  type KioskStats,
} from "@/lib/kiosk/stats";
import { displayVisitorName } from "@/lib/kiosk/visitor-fields";
import type { VisitEvent, VisitorVisit } from "@/lib/kiosk/presence";
import type { AppointmentItem } from "@/lib/kiosk/visitor";

export type RecordPresence = "on_site" | "temp_out" | "overstay" | "departed";

export type VisitorRecordRow = {
  recordId: string;
  appointmentId: string;
  appointCode: string;
  presence: RecordPresence;
  visitorName: string;
  phoneNo: string;
  plateNo: string;
  companyName: string;
  receptionistName: string;
  /** 顯示用時間：在場＝報到；外出＝外出時間；離場＝簽退時間 */
  at: string;
  checkinAt: string;
  tempOutAt: string;
  departedAt: string;
  events: VisitEvent[];
  /** 僅 departed：是否為台北今日離場 */
  isDepartedToday?: boolean;
};

export type AppointmentRecordRow = {
  recordId: string;
  visitRecordId?: string;
  appointCode: string;
  status: string;
  visitorName: string;
  phoneNo: string;
  companyName: string;
  receptionistName: string;
  startAt: string;
  endAt: string;
};

export type KioskRecordsPayload = {
  summary: KioskStats & { resetAt?: string };
  rows: VisitorRecordRow[];
  appointments: AppointmentRecordRow[];
};

const APPOINTMENT_STATUS_LABELS = new Map([
  ["0", "待報到"],
  ["1", "審核中"],
  ["2", "未核准"],
  ["3", "已報到"],
  ["4", "已簽退"],
]);

const appointmentRows = (
  appointments: AppointmentItem[],
  visitsByAppointment: Map<string, string>,
): AppointmentRecordRow[] =>
  appointments
    .map((item) => {
      const visitor = item.visitorInfo;
      return {
        recordId: item.appointID,
        visitRecordId: visitsByAppointment.get(item.appointID),
        appointCode: String(item.appointCode ?? "").trim(),
        status:
          APPOINTMENT_STATUS_LABELS.get(String(item.appointStatus ?? "0")) ??
          "未知",
        visitorName: displayVisitorName(
          visitor?.visitorFamilyName,
          visitor?.visitorGivenName,
          visitor?.visitorName,
        ),
        phoneNo: String(visitor?.phoneNo ?? "").trim(),
        companyName: String(visitor?.companyName ?? "").trim(),
        receptionistName: String(item.receptionistName ?? "").trim(),
        startAt: String(item.appointStartTime ?? "").trim(),
        endAt: String(item.appointEndTime ?? "").trim(),
      };
    })
    .sort((a, b) => (Date.parse(b.startAt) || 0) - (Date.parse(a.startAt) || 0));

const toRow = (
  presence: RecordPresence,
  visit: VisitorVisit,
  isDepartedToday?: boolean,
): VisitorRecordRow => ({
  recordId: visit.recordId,
  appointmentId: visit.appointId || visit.recordId,
  appointCode: "",
  presence,
  visitorName: displayVisitorName(undefined, undefined, visit.visitorName),
  phoneNo: visit.phoneNo,
  plateNo: visit.plateNo,
  companyName: visit.companyName,
  receptionistName: visit.receptionistName,
  at: (presence === "departed" ? visit.departedAt : presence === "temp_out" ? visit.tempOutAt : "") || visit.checkinAt,
  checkinAt: visit.checkinAt,
  tempOutAt: visit.tempOutAt ?? "",
  departedAt: visit.departedAt ?? "",
  events: visit.events ?? [],
  isDepartedToday,
});

export const listKioskRecords = async (): Promise<KioskRecordsPayload> => {
  const data = (await readKioskData()) ?? await loadLegacyKioskData();
  const snap = presenceSnapshot(data);
  const todayIds = new Set(snap.departedToday.map((visit) => visit.recordId));
  const rows = [
    ...snap.onSitePeople.map((visit) => toRow("on_site", visit)),
    ...snap.tempOutPeople.map((visit) => toRow("temp_out", visit)),
    ...snap.overstayPeople.map((visit) => toRow("overstay", visit)),
    ...snap.departedAll.map((visit) => toRow("departed", visit, todayIds.has(visit.recordId))),
  ];

  rows.sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0));
  const codes = new Map(data.appointments.map((item) => [item.appointID, item.appointCode]));
  const visitsByAppointment = new Map<string, string>();
  for (const row of rows) {
    row.appointCode = String(codes.get(row.appointmentId) ?? "").trim();
    if (!visitsByAppointment.has(row.appointmentId)) {
      visitsByAppointment.set(row.appointmentId, row.recordId);
    }
  }

  return {
    summary: { ...statsFromSnapshot(snap), resetAt: snap.statsBaseline?.at },
    rows,
    appointments: appointmentRows(data.appointments, visitsByAppointment),
  };
};
