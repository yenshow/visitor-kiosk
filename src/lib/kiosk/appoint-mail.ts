import { resolveNotifyEmails } from "@/lib/kiosk/directory";
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
  receptionistId: string;
  receptionistName: string;
  appointCode?: string;
  source?: "kiosk" | "public";
};

const dash = (value: string) => value.trim() || "—";

/**
 * 預約成功後雙通道寄信（目錄解析內部收件人＋訪客 email）。
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
  const code = String(payload.appointCode ?? "").trim();
  const codeLabel = code || "—";

  let hostLabel = dash(payload.receptionistName);
  let orgLabel = "—";
  let internalEmails: string[] = [];

  try {
    const resolved = await resolveNotifyEmails(payload.receptionistId);
    hostLabel = dash(resolved.hostName || payload.receptionistName);
    orgLabel = dash(resolved.orgName);
    internalEmails = resolved.emails;
  } catch (error) {
    console.error(
      "[appoint-mail] 解析通知收件人失敗",
      error instanceof Error ? error.message : error,
    );
  }

  const notifyInternal = async () => {
    if (internalEmails.length === 0) return;
    try {
      const sourceLabel =
        payload.source === "public" ? "外部預約" : "現場預約";
      await sendKioskMail({
        to: internalEmails,
        subject: `【訪客服務機】新預約：${visitorName}／${hostLabel}`,
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
          `被訪人：${hostLabel}`,
          `部門：${orgLabel}`,
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
        `被訪人：${hostLabel}`,
        `部門：${orgLabel}`,
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
