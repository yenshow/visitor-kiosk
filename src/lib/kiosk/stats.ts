import { getVisitorRegisterRecords } from "@/lib/hcp/visitor-api";
import { getVisitQueryRangeTaipei } from "@/lib/kiosk/api-helpers";
import { getPresenceStore } from "@/lib/kiosk/presence";
import { flattenRegisterList } from "@/lib/kiosk/register-record";

export type KioskStats = {
  onSite: number;
  tempOut: number;
  departedToday: number;
  vehicles: {
    onSite: number;
    outing: number;
  };
};

const uniquePlates = (items: { plateNo: string }[]) =>
  new Set(items.map((item) => item.plateNo).filter(Boolean)).size;

export const computeKioskStats = async (): Promise<KioskStats> => {
  const onSiteList = flattenRegisterList(
    (await getVisitorRegisterRecords(getVisitQueryRangeTaipei())).list,
  );
  const presence = await getPresenceStore(
    new Set(onSiteList.map((item) => item.recordId)),
  );
  const tempOutIds = new Set(presence.tempOut.map((item) => item.recordId));

  const onSitePeople = onSiteList.filter(
    (item) => !tempOutIds.has(item.recordId),
  );
  const tempOutPeople = onSiteList.filter((item) =>
    tempOutIds.has(item.recordId),
  );

  return {
    onSite: onSitePeople.length,
    tempOut: tempOutPeople.length,
    departedToday: presence.departedToday.length,
    vehicles: {
      onSite: uniquePlates(onSitePeople),
      outing: uniquePlates(tempOutPeople),
    },
  };
};
