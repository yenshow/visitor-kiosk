import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import type { HostPerson, OrgOption } from "@/lib/kiosk/visitor";
import { getSettings } from "@/lib/kiosk/settings";
import { isValidEmail } from "@/lib/kiosk/visitor-fields";

export type DirectoryOrg = {
  orgIndexCode: string;
  orgName: string;
};

export type DirectoryHost = {
  personId: string;
  personName: string;
  orgIndexCode: string;
  /** 被訪人通知信箱（選填） */
  email: string;
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

const normalizeHostEmail = (raw: unknown): string => {
  const email = cleanName(raw);
  if (!email) return "";
  if (!isValidEmail(email)) throw new Error("Email 格式不正確");
  return email;
};

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
          .map((host) => {
            const emailRaw = cleanName((host as { email?: unknown }).email);
            return {
              personId: cleanName(host.personId),
              personName: cleanName(host.personName),
              orgIndexCode: cleanName(host.orgIndexCode),
              email: emailRaw && isValidEmail(emailRaw) ? emailRaw : "",
            };
          })
          .filter(
            (host) => host.personId && host.personName && host.orgIndexCode,
          )
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

/**
 * 依被訪人解析內部通知：被訪人信箱 + 總機固定 CC（去重）。
 * 同時回傳目錄部門名供郵件正文使用。
 */
export const resolveNotifyEmails = async (
  personId: string,
): Promise<{ emails: string[]; orgName: string; hostName: string }> => {
  const id = cleanName(personId);
  if (!id) throw new Error("找不到被訪人，請至設定頁確認人員目錄");

  const store = await readStore();
  const host = store.hosts.find((item) => item.personId === id);
  if (!host) throw new Error("找不到被訪人，請至設定頁確認人員目錄");

  const org = store.orgs.find((item) => item.orgIndexCode === host.orgIndexCode);
  const { approverEmails } = await getSettings();

  const seen = new Set<string>();
  const emails: string[] = [];
  const push = (value: string) => {
    const email = value.trim();
    if (!email) return;
    const key = email.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    emails.push(email);
  };

  push(host.email);
  for (const email of approverEmails) push(email);

  return {
    emails,
    orgName: org?.orgName ?? "",
    hostName: host.personName,
  };
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
  email?: string;
}): Promise<DirectoryHost> => {
  const orgIndexCode = cleanName(input.orgIndexCode);
  const personName = cleanName(input.personName);
  const email = normalizeHostEmail(input.email);
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
    email,
  };
  await writeStore({ ...store, hosts: [...store.hosts, host] });
  return host;
};

export const updateHostEmail = async (
  personId: string,
  emailRaw: string,
): Promise<DirectoryHost> => {
  const id = cleanName(personId);
  if (!id) throw new Error("缺少被訪人");
  const email = normalizeHostEmail(emailRaw);
  const store = await readStore();
  const index = store.hosts.findIndex((host) => host.personId === id);
  if (index < 0) throw new Error("找不到被訪人");

  const next: DirectoryHost = { ...store.hosts[index], email };
  const hosts = [...store.hosts];
  hosts[index] = next;
  await writeStore({ ...store, hosts });
  return next;
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
