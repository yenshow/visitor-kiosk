import { loadLegacyKioskData } from "@/lib/kiosk/appointments";
import { toTaipeiIso } from "@/lib/kiosk/api-helpers";
import { updateKioskData } from "@/lib/kiosk/data-store";
import {
  mergeVisitFields,
  type VisitEvent,
  type VisitFieldsInput,
  type VisitStatus,
} from "@/lib/kiosk/presence";

export class VisitStateConflict extends Error {}

export const checkInVisit = async (entry: VisitFieldsInput): Promise<void> =>
  updateKioskData(loadLegacyKioskData, (data) => {
    const appointment = data.appointments.find((item) => item.appointID === entry.appointId);
    if (!appointment) throw new VisitStateConflict("找不到預約，請重新查詢");
    if (String(appointment.appointStatus ?? "0") !== "0") {
      throw new VisitStateConflict("預約狀態已變更，請重新查詢");
    }
    if (data.visits.some((visit) => visit.recordId === entry.recordId)) {
      throw new VisitStateConflict("已有報到紀錄，請重新查詢");
    }

    const at = toTaipeiIso(new Date());
    appointment.appointStatus = "3";
    data.visits.push({
      ...mergeVisitFields(entry),
      status: "on_site",
      checkinAt: at,
      events: [{ type: "checkin", at }],
    });
  });

type CheckoutMode = "temp" | "return" | "final";

const TRANSITIONS: Record<CheckoutMode, { status: VisitStatus; event: VisitEvent["type"] }> = {
  temp: { status: "temp_out", event: "temp_out" },
  return: { status: "on_site", event: "return" },
  final: { status: "departed", event: "departed" },
};

export const updateVisitStatus = async (
  recordId: string,
  expectedStatus: VisitStatus,
  expectedEventCount: number,
  mode: CheckoutMode,
): Promise<void> =>
  updateKioskData(loadLegacyKioskData, (data) => {
    const visit = data.visits.find((item) => item.recordId === recordId);
    const eventCount = visit?.events?.length ?? 0;
    if (
      !visit ||
      visit.status !== expectedStatus ||
      eventCount !== expectedEventCount ||
      visit.status === "departed" ||
      (mode === "temp" && visit.status !== "on_site") ||
      (mode === "return" && visit.status !== "temp_out")
    ) {
      throw new VisitStateConflict("訪客狀態已變更，請重新查詢");
    }

    const { status, event } = TRANSITIONS[mode];
    const at = toTaipeiIso(new Date());
    const events = visit.events ?? [
      ...(visit.checkinAt ? [{ type: "checkin" as const, at: visit.checkinAt }] : []),
      ...(visit.tempOutAt ? [{ type: "temp_out" as const, at: visit.tempOutAt }] : []),
    ];
    visit.status = status;
    visit.tempOutAt = mode === "temp" ? at : undefined;
    visit.departedAt = mode === "final" ? at : undefined;
    visit.events = [...events, { type: event, at }];

    if (mode === "final") {
      const appointmentId = visit.appointId || recordId;
      const appointment = data.appointments.find((item) => item.appointID === appointmentId);
      if (appointment) appointment.appointStatus = "4";
    }
  });
