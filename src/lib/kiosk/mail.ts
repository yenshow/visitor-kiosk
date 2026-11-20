import nodemailer from "nodemailer";
import { getConfig } from "@/lib/config";

export type SendKioskMailInput = {
  to: string | string[];
  subject: string;
  text: string;
};

/**
 * 共用 SMTP 寄信。未設定 SMTP 時回 false（不 throw）。
 */
export const sendKioskMail = async (
  input: SendKioskMailInput,
): Promise<boolean> => {
  const { smtp } = getConfig();
  if (!smtp.configured) {
    console.warn("[kiosk-mail] SMTP 未設定，略過寄信");
    return false;
  }

  const toList = (Array.isArray(input.to) ? input.to : [input.to])
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
  if (toList.length === 0) return false;

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
    to: toList.join(", "),
    subject: input.subject,
    text: input.text,
  });
  return true;
};

export const formatAppointTimeRange = (
  startIso: string,
  endIso: string,
): string => {
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
