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
import { buildPlateCacheIndex } from "@/lib/kiosk/plate-cache";
import {
  getPresenceStore,
  type DepartedEntry,
  type PresenceEntry,
} from "@/lib/kiosk/presence";
import {
  flattenRegisterList,
  type FlatRegisterRecord,
} from "@/lib/kiosk/register-record";
import { displayVisitorName } from "@/lib/kiosk/visitor-fields";

export type KioskStats = {
  onSite: number;
  tempOut: number;
  departedToday: number;
};

export type PresenceSnapshot = {
  onSitePeople: FlatRegisterRecord[];
  tempOutPeople: FlatRegisterRecord[];
  tempOutById: Map<string, PresenceEntry>;
  departedToday: DepartedEntry[];
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
  const plateIndex = await buildPlateCacheIndex();
  const onSiteList = await enrichRegisterList(
    rawList,
    appointPayload.list,
    presence.visitorMeta,
    plateIndex,
  );

  const tempOutIds = new Set(presence.tempOut.map((item) => item.recordId));
  const enrichedById = new Map(
    onSiteList.map((item) => [item.recordId, item]),
  );

  const tempOutById = new Map(
    presence.tempOut.map((item) => {
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

  const departedToday = presence.departedToday.map((item) => ({
    ...item,
    visitorName: displayVisitorName(undefined, undefined, item.visitorName),
    plateNo:
      normalizePlateNo(item.plateNo) ||
      plateIndex.byRecordId.get(item.recordId) ||
      "",
  }));

  return {
    onSitePeople: onSiteList.filter((item) => !tempOutIds.has(item.recordId)),
    tempOutPeople: onSiteList.filter((item) => tempOutIds.has(item.recordId)),
    tempOutById,
    departedToday,
  };
};

export const statsFromSnapshot = (snap: PresenceSnapshot): KioskStats => ({
  onSite: snap.onSitePeople.length,
  tempOut: snap.tempOutPeople.length,
  departedToday: snap.departedToday.length,
});

export const computeKioskStats = async (): Promise<KioskStats> =>
  statsFromSnapshot(await loadPresenceSnapshot());
