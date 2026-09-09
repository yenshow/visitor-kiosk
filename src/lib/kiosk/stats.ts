import {
  getVisitorRegisterRecords,
  listAppointments,
} from "@/lib/yscp/visitor-api";
import {
  getAppointQueryRangeTaipei,
  getVisitQueryRangeTaipei,
} from "@/lib/kiosk/api-helpers";
import { enrichRegisterList } from "@/lib/kiosk/appoint-enrichment";
import {
  getVisitStore,
  isDepartedToday,
  visitToRegisterRecord,
  type VisitorVisit,
} from "@/lib/kiosk/presence";
import {
  flattenRegisterList,
  isVisitNotEnded,
  type FlatRegisterRecord,
} from "@/lib/kiosk/register-record";

export type KioskStats = {
  onSite: number;
  tempOut: number;
  /** 今日離場（台北日） */
  departed: number;
  /** 所有離場累計 */
  departedTotal: number;
};

export type PresenceSnapshot = {
  onSitePeople: FlatRegisterRecord[];
  tempOutPeople: FlatRegisterRecord[];
  visitsById: Map<string, VisitorVisit>;
  departedAll: VisitorVisit[];
  departedToday: VisitorVisit[];
};

/** YSCP 在廠 + 本機 on_site／temp_out（補齊 YSCP 延遲） */
export const loadPresenceSnapshot = async (): Promise<PresenceSnapshot> => {
  const [registerPayload, appointPayload] = await Promise.all([
    getVisitorRegisterRecords(getVisitQueryRangeTaipei()),
    listAppointments({ ...getAppointQueryRangeTaipei() }),
  ]);

  const store = await getVisitStore();
  const visitsById = new Map(
    store.visits.map((item) => [item.recordId, item]),
  );
  const activeList = enrichRegisterList(
    flattenRegisterList(registerPayload.list),
    appointPayload.list,
    store.visits,
  ).filter((item) => isVisitNotEnded(item.visitEndTime));

  const onSitePeople: FlatRegisterRecord[] = [];
  const tempOutPeople: FlatRegisterRecord[] = [];
  const listedIds = new Set<string>();

  for (const item of activeList) {
    const status = visitsById.get(item.recordId)?.status;
    if (status === "departed") continue;
    if (status === "temp_out") {
      tempOutPeople.push(item);
    } else {
      onSitePeople.push(item);
    }
    listedIds.add(item.recordId);
  }

  for (const visit of store.visits) {
    if (listedIds.has(visit.recordId)) continue;
    if (visit.status === "on_site") {
      onSitePeople.push(visitToRegisterRecord(visit));
      listedIds.add(visit.recordId);
      continue;
    }
    if (visit.status === "temp_out") {
      tempOutPeople.push(visitToRegisterRecord(visit));
      listedIds.add(visit.recordId);
    }
  }

  const departedAll = store.visits.filter(
    (item) => item.status === "departed",
  );

  return {
    onSitePeople,
    tempOutPeople,
    visitsById,
    departedAll,
    departedToday: departedAll.filter((item) => isDepartedToday(item)),
  };
};

export const statsFromSnapshot = (snap: PresenceSnapshot): KioskStats => ({
  onSite: snap.onSitePeople.length,
  tempOut: snap.tempOutPeople.length,
  departed: snap.departedToday.length,
  departedTotal: snap.departedAll.length,
});

export const computeKioskStats = async (): Promise<KioskStats> =>
  statsFromSnapshot(await loadPresenceSnapshot());
