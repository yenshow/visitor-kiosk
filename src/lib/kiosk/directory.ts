import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import type { HostPerson, OrgOption } from "@/lib/kiosk/visitor";

export type DirectoryOrg = {
  orgIndexCode: string;
  orgName: string;
};

export type DirectoryHost = {
  personId: string;
  personName: string;
  orgIndexCode: string;
};

export type DirectoryStore = {
  orgs: DirectoryOrg[];
  hosts: DirectoryHost[];
};

const STORE_PATH = path.join(process.cwd(), "data", "kiosk-directory.json");

const emptyStore = (): DirectoryStore => ({ orgs: [], hosts: [] });

let writeChain: Promise<void> = Promise.resolve();

const writeStore = async (store: DirectoryStore): Promise<void> => {
  writeChain = writeChain.then(async () => {
    await mkdir(path.dirname(STORE_PATH), { recursive: true });
    await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  });
  await writeChain;
};

const cleanName = (value: unknown): string => String(value ?? "").trim();

const readStore = async (): Promise<DirectoryStore> => {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<DirectoryStore>;
    const orgs = Array.isArray(parsed.orgs)
      ? parsed.orgs
          .map((org) => ({
            orgIndexCode: cleanName(org.orgIndexCode),
            orgName: cleanName(org.orgName),
          }))
          .filter((org) => org.orgIndexCode && org.orgName)
      : [];
    const hosts = Array.isArray(parsed.hosts)
      ? parsed.hosts
          .map((host) => ({
            personId: cleanName(host.personId),
            personName: cleanName(host.personName),
            orgIndexCode: cleanName(host.orgIndexCode),
          }))
          .filter((host) => host.personId && host.personName && host.orgIndexCode)
      : [];
    return { orgs, hosts };
  } catch {
    return emptyStore();
  }
};

export const getDirectory = async (): Promise<DirectoryStore> => readStore();

export const listOrgOptions = async (): Promise<OrgOption[]> => {
  const { orgs } = await readStore();
  return [...orgs].sort((a, b) =>
    a.orgName.localeCompare(b.orgName, "zh-Hant"),
  );
};

export const searchHosts = async (
  orgIndexCode: string,
): Promise<HostPerson[]> => {
  const code = cleanName(orgIndexCode);
  if (!code) return [];
  const { hosts } = await readStore();
  return hosts
    .filter((host) => host.orgIndexCode === code)
    .map((host) => ({
      personId: host.personId,
      personName: host.personName,
      orgIndexCode: host.orgIndexCode,
    }))
    .sort((a, b) => a.personName.localeCompare(b.personName, "zh-Hant"));
};

export const getHost = async (
  personId: string,
): Promise<DirectoryHost | null> => {
  const id = cleanName(personId);
  if (!id) return null;
  const { hosts } = await readStore();
  return hosts.find((host) => host.personId === id) ?? null;
};

export const createOrg = async (orgName: string): Promise<DirectoryOrg> => {
  const name = cleanName(orgName);
  if (!name) throw new Error("請填寫部門名稱");
  const store = await readStore();
  if (store.orgs.some((org) => org.orgName === name)) {
    throw new Error("已有相同名稱的部門");
  }
  const org: DirectoryOrg = {
    orgIndexCode: randomUUID(),
    orgName: name,
  };
  await writeStore({ ...store, orgs: [...store.orgs, org] });
  return org;
};

export const deleteOrg = async (orgIndexCode: string): Promise<void> => {
  const id = cleanName(orgIndexCode);
  if (!id) throw new Error("缺少部門");
  const store = await readStore();
  if (!store.orgs.some((org) => org.orgIndexCode === id)) {
    throw new Error("找不到部門");
  }
  await writeStore({
    orgs: store.orgs.filter((org) => org.orgIndexCode !== id),
    hosts: store.hosts.filter((host) => host.orgIndexCode !== id),
  });
};

export const createHost = async (input: {
  orgIndexCode: string;
  personName: string;
}): Promise<DirectoryHost> => {
  const orgIndexCode = cleanName(input.orgIndexCode);
  const personName = cleanName(input.personName);
  if (!orgIndexCode) throw new Error("請先選擇部門");
  if (!personName) throw new Error("請填寫被訪人姓名");
  const store = await readStore();
  if (!store.orgs.some((org) => org.orgIndexCode === orgIndexCode)) {
    throw new Error("找不到部門");
  }
  if (
    store.hosts.some(
      (host) =>
        host.orgIndexCode === orgIndexCode && host.personName === personName,
    )
  ) {
    throw new Error("此部門已有相同姓名的被訪人");
  }
  const host: DirectoryHost = {
    personId: randomUUID(),
    personName,
    orgIndexCode,
  };
  await writeStore({ ...store, hosts: [...store.hosts, host] });
  return host;
};

export const deleteHost = async (personId: string): Promise<void> => {
  const id = cleanName(personId);
  if (!id) throw new Error("缺少被訪人");
  const store = await readStore();
  if (!store.hosts.some((host) => host.personId === id)) {
    throw new Error("找不到被訪人");
  }
  await writeStore({
    ...store,
    hosts: store.hosts.filter((host) => host.personId !== id),
  });
};
