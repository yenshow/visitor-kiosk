import { getSettings } from "@/lib/kiosk/settings";
import { formatAppointTimeRange, sendKioskMail } from "@/lib/kiosk/mail";
import { displayVisitorName } from "@/lib/kiosk/visitor-fields";
import { visitReasonLabel } from "@/lib/kiosk/visit-reason";

export type AppointMailPayload = {
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
  appointCode?: string;
  source?: "kiosk" | "public";
};

const dash = (value: string) => value.trim() || "—";

/**
 * 預約成功後雙通道寄信（內部固定信箱＋訪客 email）。
 * 回傳訪客備查信是否由 SMTP 接受，內部通知獨立處理。
 */
export const notifyAppointmentMails = async (
  payload: AppointMailPayload,
): Promise<boolean> => {
  const visitorName = displayVisitorName(
    payload.visitorFamilyName,
    payload.visitorGivenName,
  );
  const reason = visitReasonLabel(payload.visitReasonType);
  const timeRange = formatAppointTimeRange(
    payload.appointStartTime,
    payload.appointEndTime,
  );
  const host = dash(payload.receptionistName);
  const org = dash(payload.orgLabel);
  const code = String(payload.appointCode ?? "").trim();
  const codeLabel = code || "—";

  const notifyInternal = async () => {
    try {
      const { approverEmails } = await getSettings();
      if (approverEmails.length === 0) return;

      const sourceLabel =
        payload.source === "public" ? "外部預約" : "現場預約";
      await sendKioskMail({
        to: approverEmails,
        subject: `【訪客服務機】新預約：${visitorName}／${host}`,
        text: [
          `此為 YSOP Kiosk 訪客系統${sourceLabel}通知（已自動核准）。`,
          "",
          `訪客姓名：${visitorName}`,
          `公司：${dash(payload.companyName)}`,
          `手機：${dash(payload.phoneNo)}`,
          `Email：${dash(payload.email)}`,
          `車牌：${dash(payload.plateNo)}`,
          `來訪事由：${reason}`,
          `來訪時段：${timeRange}`,
          `被訪人：${host}`,
          `部門：${org}`,
          `預約碼：${codeLabel}`,
        ].join("\n"),
      });
    } catch (error) {
      console.error(
        "[appoint-mail] 內部通知失敗",
        error instanceof Error ? error.message : error,
      );
    }
  };
  void notifyInternal();

  try {
    const to = payload.email.trim();
    if (!to) return false;
    return await sendKioskMail({
      to,
      subject: `【訪客預約備查】${visitorName}`,
      text: [
        "您好，這是 YSOP Kiosk 訪客系統的預約備查信。",
        "",
        `訪客姓名：${visitorName}`,
        `手機：${dash(payload.phoneNo)}`,
        `來訪事由：${reason}`,
        `來訪時段：${timeRange}`,
        `被訪人：${host}`,
        `部門：${org}`,
        `預約碼：${codeLabel}`,
        "",
        code
          ? `到場後請於訪客機「訪客報到」輸入預約碼 ${code} 或您的手機號碼完成簽到。`
          : "到場後請於訪客機「訪客報到」輸入您的手機號碼完成簽到。",
      ].join("\n"),
    });
  } catch (error) {
    console.error(
      "[appoint-mail] 訪客備查信失敗",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
};
