import { upsertVisitOnCheckin } from "@/lib/kiosk/presence";

/** 報到成功後寫入本機訪客主檔（visits，status=on_site） */
export const recordVisitorAfterCheckin = async (entry: {
  recordId: string;
  visitorId?: string;
  visitorName?: string;
  phoneNo?: string;
  plateNo?: string;
  companyName?: string;
  receptionistName?: string;
  visitReasonType?: number;
}): Promise<void> => {
  const recordId = String(entry.recordId ?? "").trim();
  if (!recordId) return;

  await upsertVisitOnCheckin({
    recordId,
    visitorId: entry.visitorId,
    visitorName: entry.visitorName,
    phoneNo: entry.phoneNo,
    plateNo: entry.plateNo,
    companyName: entry.companyName,
    receptionistName: entry.receptionistName,
    visitReasonType: entry.visitReasonType,
  });
};
