import nodemailer from "nodemailer";
import { getConfig } from "@/lib/config";
import { getSettings } from "@/lib/kiosk/settings";
import { displayVisitorName } from "@/lib/kiosk/visitor-fields";
import { visitReasonLabel } from "@/lib/kiosk/visit-reason";

export type ApproverMailPayload = {
  visitorFamilyName: string;
  visitorGivenName: string;
  companyName: string;
  phoneNo: string;
  email: string;
  plateNo: string;
  visitReasonType: number;
  appointStartTime: string;
  appointEndTime: string;
  receptionistName: string;
  orgLabel: string;
};

const formatTimeRange = (startIso: string, endIso: string): string => {
  const start = String(startIso ?? "").trim();
  const end = String(endIso ?? "").trim();
  const startMatch = /T(\d{2}:\d{2})/.exec(start);
  const endMatch = /T(\d{2}:\d{2})/.exec(end);
  const dateMatch = /^(\d{4}-\d{2}-\d{2})/.exec(start);
  const dateLabel = dateMatch?.[1]?.replace(/-/g, "/") ?? "";
  const startTime = startMatch?.[1] ?? start;
  const endTime = endMatch?.[1] ?? end;
  if (dateLabel) return `${dateLabel} ${startTime}–${endTime}`;
  return `${startTime}–${endTime}`;
};

const buildTextBody = (payload: ApproverMailPayload): string => {
  const visitorName = displayVisitorName(
    payload.visitorFamilyName,
    payload.visitorGivenName,
  );
  const reason = visitReasonLabel(payload.visitReasonType);
  const lines = [
    "此為訪客服務機（YSOP）現場預約通知。",
    "預約已寫入 YSCP，請至 YSCP 訪客預約功能完成核准。",
    "（本信不含預約密碼；密碼請於核准後由 YSCP 提供給訪客。）",
    "",
    `訪客姓名：${visitorName}`,
    `公司：${payload.companyName.trim() || "—"}`,
    `手機：${payload.phoneNo.trim() || "—"}`,
    `Email：${payload.email.trim() || "—"}`,
    `車牌：${payload.plateNo.trim() || "—"}`,
    `來訪事由：${reason}`,
    `來訪時段：${formatTimeRange(payload.appointStartTime, payload.appointEndTime)}`,
    `被訪人：${payload.receptionistName.trim() || "—"}`,
    `部門：${payload.orgLabel.trim() || "—"}`,
  ];
  return lines.join("\n");
};

/**
 * 需人工核准時，一封信同步寄給設定頁核准名單。
 * SMTP 未設定、名單為空、或寄信失敗時不 throw（不擋預約）。
 */
export const notifyApproversOfPendingAppointment = async (
  payload: ApproverMailPayload,
): Promise<void> => {
  try {
    const { smtp } = getConfig();
    if (!smtp.configured) {
      console.warn("[approver-mail] SMTP 未設定，略過核准通知");
      return;
    }

    const settings = await getSettings();
    const to = settings.approverEmails;
    if (to.length === 0) {
      console.warn("[approver-mail] 核准名單為空，略過核准通知");
      return;
    }

    const visitorName = displayVisitorName(
      payload.visitorFamilyName,
      payload.visitorGivenName,
    );
    const hostName = payload.receptionistName.trim() || "—";
    const subject = `【訪客服務機】待核准預約：${visitorName}／${hostName}`;

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      requireTLS: smtp.port === 587,
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    });

    await transporter.sendMail({
      from: smtp.from,
      to: to.join(", "),
      subject,
      text: buildTextBody(payload),
    });
  } catch (error) {
    console.error(
      "[approver-mail] 寄送核准通知失敗",
      error instanceof Error ? error.message : error,
    );
  }
};
