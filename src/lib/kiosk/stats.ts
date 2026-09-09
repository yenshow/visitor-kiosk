import {
  getVisitorRegisterRecords,
  listAppointments,
} from "@/lib/yscp/visitor-api";
import {
  getAppointQueryRangeTaipei,
  getVisitQueryRangeTaipei,
} from "@/lib/kiosk/api-helpers";
import { enrichRegisterList } from "@/lib/kiosk/appoint-enrichment";
import { normalizePlateNo } from "@/lib/kiosk/plate";
import {
  getPresenceStore,
  type DepartedEntry,
  type PresenceEntry,
} from "@/lib/kiosk/presence";
import {
  flattenRegisterList,
  isVisitNotEnded,
  type FlatRegisterRecord,
} from "@/lib/kiosk/register-record";
import { displayVisitorName } from "@/lib/kiosk/visitor-fields";

export type KioskStats = {
  onSite: number;
  tempOut: number;
  departed: number;
};

export type PresenceSnapshot = {
  onSitePeople: FlatRegisterRecord[];
  tempOutPeople: FlatRegisterRecord[];
  tempOutById: Map<string, PresenceEntry>;
  departed: DepartedEntry[];
};

/** YSCP 在廠清單 + 預約／本機補齊 + presence */
export const loadPresenceSnapshot = async (): Promise<PresenceSnapshot> => {
  const [registerPayload, appointPayload] = await Promise.all([
    getVisitorRegisterRecords(getVisitQueryRangeTaipei()),
    listAppointments({ ...getAppointQueryRangeTaipei() }),
  ]);

  const rawList = flattenRegisterList(registerPayload.list);
  const presence = await getPresenceStore(
    new Set(rawList.map((item) => item.recordId)),
  );
  const onSiteList = await enrichRegisterList(
    rawList,
    appointPayload.list,
    presence.visitorMeta,
  );

  /** 統計／紀錄：結束時間已過者不計入在場中／臨時外出 */
  const activeList = onSiteList.filter((item) =>
    isVisitNotEnded(item.visitEndTime),
  );
  const tempOutIds = new Set(presence.tempOut.map((item) => item.recordId));
  const enrichedById = new Map(
    activeList.map((item) => [item.recordId, item]),
  );

  const tempOutById = new Map(
    presence.tempOut
      .filter((item) => enrichedById.has(item.recordId))
      .map((item) => {
        const enriched = enrichedById.get(item.recordId);
        return [
          item.recordId,
          {
            ...item,
            visitorName: displayVisitorName(
              undefined,
              undefined,
              enriched?.visitorName || item.visitorName,
            ),
            plateNo:
              normalizePlateNo(item.plateNo) ||
              normalizePlateNo(enriched?.plateNo) ||
              "",
          },
        ];
      }),
  );

  const departed = presence.departed.map((item) => ({
    ...item,
    visitorName: displayVisitorName(undefined, undefined, item.visitorName),
    plateNo: normalizePlateNo(item.plateNo),
  }));

  return {
    onSitePeople: activeList.filter((item) => !tempOutIds.has(item.recordId)),
    tempOutPeople: activeList.filter((item) => tempOutIds.has(item.recordId)),
    tempOutById,
    departed,
  };
};

export const statsFromSnapshot = (snap: PresenceSnapshot): KioskStats => ({
  onSite: snap.onSitePeople.length,
  tempOut: snap.tempOutPeople.length,
  departed: snap.departed.length,
});

export const computeKioskStats = async (): Promise<KioskStats> =>
  statsFromSnapshot(await loadPresenceSnapshot());
