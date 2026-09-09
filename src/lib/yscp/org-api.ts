import { artemisPostSecure } from "./artemis-client";
import { assertYscpOk, type YscpApiResult } from "./visitor-api";

export type OrgNode = {
  orgIndexCode: string;
  orgName: string;
  parentOrgIndexCode?: string;
};

export type HostPerson = {
  personId: string;
  personName: string;
  orgIndexCode?: string;
};

export type OrgOption = {
  orgIndexCode: string;
  orgName: string;
  parentOrgIndexCode: string;
  /** 含上層路徑，例如「遠岫科技 / 業務部」 */
  label: string;
};

const toOrg = (raw: {
  orgIndexCode?: string | number;
  orgName?: string;
  parentOrgIndexCode?: string | number;
}): OrgNode | null => {
  if (raw.orgIndexCode == null || !raw.orgName) return null;
  return {
    orgIndexCode: String(raw.orgIndexCode),
    orgName: String(raw.orgName).trim(),
    parentOrgIndexCode:
      raw.parentOrgIndexCode != null
        ? String(raw.parentOrgIndexCode)
        : undefined,
  };
};

type OrgListPayload = {
  total?: number;
  pageNo?: number;
  pageSize?: number;
  list?: Array<{
    orgIndexCode?: string | number;
    orgName?: string;
    parentOrgIndexCode?: string | number;
  }>;
};

/** 分頁取得全部部門（官方 orgList） */
export const listAllOrgs = async (): Promise<OrgNode[]> => {
  const path = "/artemis/api/resource/v1/org/orgList";
  const pageSize = 500;
  let pageNo = 1;
  let total = Infinity;
  const all: OrgNode[] = [];

  while (all.length < total) {
    const { data } = await artemisPostSecure<YscpApiResult<OrgListPayload>>(
      path,
      { pageNo, pageSize },
    );
    const payload = assertYscpOk(data, "取得部門清單失敗");
    total = Number(payload?.total ?? 0);
    const page = (payload?.list ?? [])
      .map((item) => toOrg(item))
      .filter((item): item is OrgNode => Boolean(item));
    all.push(...page);
    if (page.length === 0) break;
    pageNo += 1;
    if (pageNo > 100) break;
  }

  return all;
};

/** 短快取，避免 orgList + personList 連續重打 */
let orgCache: { at: number; orgs: OrgNode[] } | null = null;
const ORG_CACHE_MS = 60_000;

export const listAllOrgsCached = async (): Promise<OrgNode[]> => {
  if (orgCache && Date.now() - orgCache.at < ORG_CACHE_MS) {
    return orgCache.orgs;
  }
  const orgs = await listAllOrgs();
  orgCache = { at: Date.now(), orgs };
  return orgs;
};

const buildOrgLabel = (
  org: OrgNode,
  byId: Map<string, OrgNode>,
): string => {
  const names: string[] = [];
  let current: OrgNode | undefined = org;
  const seen = new Set<string>();
  while (current && !seen.has(current.orgIndexCode)) {
    seen.add(current.orgIndexCode);
    names.unshift(current.orgName);
    const parentId = current.parentOrgIndexCode;
    if (!parentId || parentId === "0") break;
    current = byId.get(parentId);
  }
  return names.join(" / ");
};

/** 扁平部門選項（含路徑標籤） */
export const listOrgOptions = async (): Promise<OrgOption[]> => {
  const orgs = await listAllOrgsCached();
  const byId = new Map(orgs.map((o) => [o.orgIndexCode, o]));

  return orgs
    .map((org) => ({
      orgIndexCode: org.orgIndexCode,
      orgName: org.orgName,
      parentOrgIndexCode: org.parentOrgIndexCode ?? "0",
      label: buildOrgLabel(org, byId),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "zh-Hant"));
};

/** 選定部門 + 其所有子孫部門 */
export const collectOrgScope = (
  orgIndexCode: string,
  orgs: OrgNode[],
): Set<string> => {
  const childrenByParent = new Map<string, string[]>();
  for (const org of orgs) {
    const parent = org.parentOrgIndexCode ?? "0";
    const list = childrenByParent.get(parent) ?? [];
    list.push(org.orgIndexCode);
    childrenByParent.set(parent, list);
  }

  const scope = new Set<string>([orgIndexCode]);
  const queue = [orgIndexCode];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const child of childrenByParent.get(current) ?? []) {
      if (scope.has(child)) continue;
      scope.add(child);
      queue.push(child);
    }
  }
  return scope;
};

type PersonListItem = {
  personId?: string | number;
  personName?: string;
  orgIndexCode?: string | number;
};

const toHost = (p: PersonListItem): HostPerson | null => {
  if (p.personId == null || !p.personName) return null;
  return {
    personId: String(p.personId),
    personName: String(p.personName).trim(),
    orgIndexCode:
      p.orgIndexCode != null ? String(p.orgIndexCode) : undefined,
  };
};

/**
 * 進階搜尋受訪人。
 * 注意：部分 YSCP 版本會忽略 orgIndexCode，需在本端依組織範圍再過濾。
 */
export const searchHosts = async (params: {
  personName?: string;
  orgIndexCode?: string;
  pageSize?: number;
}): Promise<HostPerson[]> => {
  const personName = String(params.personName ?? "").trim();
  const orgIndexCode = String(params.orgIndexCode ?? "").trim();
  const pageSize = Math.min(Math.max(params.pageSize ?? 500, 1), 500);

  const path = "/artemis/api/resource/v1/person/advance/personList";
  const all: HostPerson[] = [];
  let pageNo = 1;
  let total = Infinity;

  while (all.length < total) {
    const body: Record<string, unknown> = {
      pageNo,
      pageSize,
    };
    if (personName) body.personName = personName;
    if (orgIndexCode) {
      body.orgIndexCode = orgIndexCode;
      /** 部分 YSCP／iSecure 版本支援：含子孫部門 */
      body.isSubOrg = true;
    }

    const { data } = await artemisPostSecure<
      YscpApiResult<{
        total?: number;
        list?: PersonListItem[];
      }>
    >(path, body);

    const payload = assertYscpOk(data, "查詢被訪人失敗");
    total = Number(payload?.total ?? 0);
    const page = (payload?.list ?? [])
      .map((item) => toHost(item))
      .filter((item): item is HostPerson => Boolean(item));
    all.push(...page);
    if (page.length === 0) break;
    pageNo += 1;
    if (pageNo > 50) break;
  }

  if (!orgIndexCode) {
    return all.sort((a, b) =>
      a.personName.localeCompare(b.personName, "zh-Hant"),
    );
  }

  const orgs = await listAllOrgsCached();
  const scope = collectOrgScope(orgIndexCode, orgs);
  const filtered = all.filter(
    (host) => host.orgIndexCode && scope.has(host.orgIndexCode),
  );

  return filtered.sort((a, b) =>
    a.personName.localeCompare(b.personName, "zh-Hant"),
  );
};
