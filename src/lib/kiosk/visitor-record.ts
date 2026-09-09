import { upsertVisitorMeta } from "@/lib/kiosk/presence";

/** 報到成功後統一寫入本機訪客資料（僅 visitorMeta，單一 JSON） */
export const recordVisitorAfterCheckin = async (entry: {
  recordId: string;
  visitorId?: string;
  visitorName?: string;
  phoneNo?: string;
  plateNo?: string;
  companyName?: string;
  receptionistName?: string;
}): Promise<void> => {
  const recordId = String(entry.recordId ?? "").trim();
  if (!recordId) return;

  await upsertVisitorMeta({
    recordId,
    visitorId: entry.visitorId,
    visitorName: entry.visitorName,
    phoneNo: entry.phoneNo,
    plateNo: entry.plateNo,
    companyName: entry.companyName,
    receptionistName: entry.receptionistName,
  });
};
