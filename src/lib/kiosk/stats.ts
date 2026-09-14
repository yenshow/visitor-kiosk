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
import { classifyActivePresence } from "@/lib/kiosk/presence-classify";
import {
  flattenRegisterList,
  type FlatRegisterRecord,
} from "@/lib/kiosk/register-record";

export type KioskStats = {
  onSite: number;
  tempOut: number;
  overstay: number;
  /** 今日離場（台北日） */
  departed: number;
  /** 所有離場累計 */
  departedTotal: number;
};

export type PresenceSnapshot = {
  onSitePeople: FlatRegisterRecord[];
  tempOutPeople: FlatRegisterRecord[];
  overstayPeople: FlatRegisterRecord[];
  visitsById: Map<string, VisitorVisit>;
  departedAll: VisitorVisit[];
  departedToday: VisitorVisit[];
};

const pushByBucket = (
  bucket: ReturnType<typeof classifyActivePresence>,
  flat: FlatRegisterRecord,
  onSite: FlatRegisterRecord[],
  tempOut: FlatRegisterRecord[],
  overstay: FlatRegisterRecord[],
) => {
  if (bucket === "overstay") overstay.push(flat);
  else if (bucket === "temp_out") tempOut.push(flat);
  else if (bucket === "on_site") onSite.push(flat);
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
  const enrichedList = enrichRegisterList(
    flattenRegisterList(registerPayload.list),
    appointPayload.list,
    store.visits,
  );

  const onSitePeople: FlatRegisterRecord[] = [];
  const tempOutPeople: FlatRegisterRecord[] = [];
  const overstayPeople: FlatRegisterRecord[] = [];
  const listedIds = new Set<string>();

  for (const item of enrichedList) {
    const visit = visitsById.get(item.recordId);
    const bucket = classifyActivePresence({
      visit,
      flat: item,
      inYscpRegisterList: true,
    });
    if (!bucket) continue;
    pushByBucket(bucket, item, onSitePeople, tempOutPeople, overstayPeople);
    listedIds.add(item.recordId);
  }

  for (const visit of store.visits) {
    if (listedIds.has(visit.recordId)) continue;
    if (visit.status !== "on_site" && visit.status !== "temp_out") continue;
    const flat = visitToRegisterRecord(visit);
    const bucket = classifyActivePresence({
      visit,
      flat,
      inYscpRegisterList: false,
    });
    if (!bucket) continue;
    pushByBucket(bucket, flat, onSitePeople, tempOutPeople, overstayPeople);
    listedIds.add(visit.recordId);
  }

  const departedAll = store.visits.filter(
    (item) => item.status === "departed",
  );

  return {
    onSitePeople,
    tempOutPeople,
    overstayPeople,
    visitsById,
    departedAll,
    departedToday: departedAll.filter((item) => isDepartedToday(item)),
  };
};

export const statsFromSnapshot = (snap: PresenceSnapshot): KioskStats => ({
  onSite: snap.onSitePeople.length,
  tempOut: snap.tempOutPeople.length,
  overstay: snap.overstayPeople.length,
  departed: snap.departedToday.length,
  departedTotal: snap.departedAll.length,
});

export const computeKioskStats = async (): Promise<KioskStats> =>
  statsFromSnapshot(await loadPresenceSnapshot());
