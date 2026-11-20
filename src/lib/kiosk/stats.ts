import {
  getVisitStore,
  isDepartedToday,
  visitToRegisterRecord,
  type VisitorVisit,
  type VisitStore,
} from "@/lib/kiosk/presence";
import { classifyActivePresence, type ActivePresenceBucket } from "@/lib/kiosk/presence-classify";
import { taipeiDateKeyFromIso, toTaipeiDateKey } from "@/lib/kiosk/api-helpers";

export type KioskStats = {
  onSite: number;
  tempOut: number;
  overstay: number;
  /** 今日離場（台北日） */
  departed: number;
  /** 本期離場累計 */
  departedTotal: number;
};

export type PresenceSnapshot = {
  onSitePeople: VisitorVisit[];
  tempOutPeople: VisitorVisit[];
  overstayPeople: VisitorVisit[];
  departedAll: VisitorVisit[];
  departedToday: VisitorVisit[];
  today: string;
  statsBaseline: VisitStore["statsBaseline"];
};

export const presenceSnapshot = (store: VisitStore): PresenceSnapshot => {
  const today = toTaipeiDateKey();
  const active: Record<ActivePresenceBucket, VisitorVisit[]> = {
    on_site: [], temp_out: [], overstay: [],
  };
  const departedAll: VisitorVisit[] = [];
  const departedToday: VisitorVisit[] = [];

  for (const visit of store.visits) {
    if (visit.status === "departed") {
      departedAll.push(visit);
      if (isDepartedToday(visit, today)) departedToday.push(visit);
    } else {
      const bucket = classifyActivePresence({ visit, flat: visitToRegisterRecord(visit) });
      if (bucket) active[bucket].push(visit);
    }
  }

  return {
    onSitePeople: active.on_site,
    tempOutPeople: active.temp_out,
    overstayPeople: active.overstay,
    departedAll,
    departedToday,
    today,
    statsBaseline: store.statsBaseline,
  };
};

export const statsFromSnapshot = (snap: PresenceSnapshot): KioskStats => {
  const baseline = snap.statsBaseline;
  const todayBaseline = baseline && taipeiDateKeyFromIso(baseline.at) === snap.today
    ? baseline.departedToday
    : 0;
  return {
    onSite: snap.onSitePeople.length,
    tempOut: snap.tempOutPeople.length,
    overstay: snap.overstayPeople.length,
    departed: Math.max(0, snap.departedToday.length - todayBaseline),
    departedTotal: Math.max(0, snap.departedAll.length - (baseline?.departedTotal ?? 0)),
  };
};

export const computeKioskStats = async (): Promise<KioskStats> =>
  statsFromSnapshot(presenceSnapshot(await getVisitStore()));
