"use client";

import { useEffect, useId, useState } from "react";
import { KioskDialog } from "@/components/kiosk/KioskDialog";

type DirectoryOrg = {
  orgIndexCode: string;
  orgName: string;
};

type DirectoryHost = {
  personId: string;
  personName: string;
  orgIndexCode: string;
};

type DirectoryStore = {
  orgs: DirectoryOrg[];
  hosts: DirectoryHost[];
};

type PendingDelete =
  | { kind: "org"; orgIndexCode: string; orgName: string }
  | { kind: "host"; personId: string; personName: string };

type DirectoryDialogProps = {
  open: boolean;
  onClose: () => void;
};

const FIELD =
  "w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30";
const BTN =
  "min-h-11 cursor-pointer rounded-xl px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";
const BTN_DARK = `${BTN} bg-slate-800 text-white active:bg-slate-700`;
const BTN_OUTLINE = `${BTN} border border-slate-300 bg-white text-slate-700 active:bg-slate-100`;
const BTN_DANGER = `${BTN} border border-red-200 bg-white text-red-700 active:bg-red-50`;

const DirectoryPanel = () => {
  const [orgs, setOrgs] = useState<DirectoryOrg[]>([]);
  const [hosts, setHosts] = useState<DirectoryHost[]>([]);
  const [orgName, setOrgName] = useState("");
  const [hostDrafts, setHostDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null,
  );
  const confirmTitleId = useId();

  const applyStore = (store: DirectoryStore) => {
    setOrgs(store.orgs);
    setHosts(store.hosts);
  };

  const parseDirectory = async (res: Response): Promise<DirectoryStore> => {
    const json = (await res.json()) as {
      msg?: string;
      data?: DirectoryStore;
    };
    if (!res.ok || !json.data) {
      throw new Error(json.msg || "人員目錄操作失敗");
    }
    return json.data;
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/kiosk/directory");
        const store = await parseDirectory(res);
        if (!cancelled) applyStore(store);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "載入人員目錄失敗");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!pendingDelete) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      if (!busy) setPendingDelete(null);
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [pendingDelete, busy]);

  const postAction = async (
    body: Record<string, string>,
    okHint: string,
  ): Promise<boolean> => {
    setBusy(true);
    setError("");
    setHint("");
    try {
      const res = await fetch("/api/kiosk/directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      applyStore(await parseDirectory(res));
      setHint(okHint);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新人員目錄失敗");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleCreateOrg = () => {
    const name = orgName.trim();
    if (!name) return;
    void postAction({ action: "createOrg", orgName: name }, "已新增部門").then(
      (ok) => {
        if (ok) setOrgName("");
      },
    );
  };

  const handleCreateHost = (orgIndexCode: string) => {
    const name = (hostDrafts[orgIndexCode] ?? "").trim();
    if (!name) return;
    void postAction(
      {
        action: "createHost",
        orgIndexCode,
        personName: name,
      },
      "已新增被訪人",
    ).then((ok) => {
      if (ok) setHostDrafts((prev) => ({ ...prev, [orgIndexCode]: "" }));
    });
  };

  const handleConfirmDelete = () => {
    if (!pendingDelete) return;
    const isOrg = pendingDelete.kind === "org";
    void postAction(
      isOrg
        ? { action: "deleteOrg", orgIndexCode: pendingDelete.orgIndexCode }
        : { action: "deleteHost", personId: pendingDelete.personId },
      isOrg ? "已刪除部門" : "已刪除被訪人",
    ).then((ok) => {
      if (ok) setPendingDelete(null);
    });
  };

  return (
    <div className="relative space-y-4">
      <p className="text-sm text-slate-500">
        被訪人掛在部門底下。現場預約會先選部門，再選該部門的人。
      </p>

      <div className="flex gap-2">
        <input
          className={`${FIELD} min-h-12`}
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          maxLength={40}
          placeholder="部門名稱，例如：總務部"
          aria-label="新增部門名稱"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreateOrg();
          }}
        />
        <button
          type="button"
          className={`${BTN_DARK} min-h-12 shrink-0 px-4`}
          aria-label="新增部門"
          disabled={busy || !orgName.trim()}
          onClick={handleCreateOrg}
        >
          新增部門
        </button>
      </div>

      {loading ? (
        <p className="text-base text-slate-500">載入人員目錄…</p>
      ) : orgs.length === 0 ? (
        <div className="flex min-h-36 items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 text-center">
          <p className="text-base text-slate-500">
            尚無部門。請先新增部門，再於部門底下加入被訪人。
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {orgs.map((org) => {
            const orgHosts = hosts.filter(
              (host) => host.orgIndexCode === org.orgIndexCode,
            );
            const draft = hostDrafts[org.orgIndexCode] ?? "";
            return (
              <li
                key={org.orgIndexCode}
                className="overflow-hidden rounded-2xl border border-slate-200"
              >
                <div className="flex items-center gap-3 bg-slate-50 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-semibold text-slate-900">
                      {org.orgName}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {orgHosts.length} 位被訪人
                    </p>
                  </div>
                  <button
                    type="button"
                    className={BTN_DANGER}
                    aria-label={`刪除部門 ${org.orgName}`}
                    disabled={busy}
                    onClick={() =>
                      setPendingDelete({
                        kind: "org",
                        orgIndexCode: org.orgIndexCode,
                        orgName: org.orgName,
                      })
                    }
                  >
                    刪除部門
                  </button>
                </div>

                <ul className="border-t border-l-4 border-slate-200 border-l-blue-200">
                  {orgHosts.length === 0 ? (
                    <li className="px-4 py-3 text-sm text-slate-500">
                      此部門尚無被訪人
                    </li>
                  ) : (
                    orgHosts.map((host) => (
                      <li
                        key={host.personId}
                        className="flex items-center gap-2 border-b border-slate-100 px-4 last:border-b-0"
                      >
                        <span className="min-h-12 min-w-0 flex-1 py-2 text-base text-slate-800">
                          {host.personName}
                        </span>
                        <button
                          type="button"
                          className={BTN_DANGER}
                          aria-label={`刪除被訪人 ${host.personName}`}
                          disabled={busy}
                          onClick={() =>
                            setPendingDelete({
                              kind: "host",
                              personId: host.personId,
                              personName: host.personName,
                            })
                          }
                        >
                          刪除
                        </button>
                      </li>
                    ))
                  )}
                </ul>

                <div className="flex gap-2 border-t border-slate-200 bg-white p-3">
                  <input
                    className={`${FIELD} min-h-11`}
                    value={draft}
                    onChange={(e) =>
                      setHostDrafts((prev) => ({
                        ...prev,
                        [org.orgIndexCode]: e.target.value,
                      }))
                    }
                    maxLength={40}
                    placeholder={`新增「${org.orgName}」的被訪人`}
                    aria-label={`新增 ${org.orgName} 被訪人姓名`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateHost(org.orgIndexCode);
                    }}
                  />
                  <button
                    type="button"
                    className={`${BTN_DARK} shrink-0`}
                    aria-label={`新增 ${org.orgName} 被訪人`}
                    disabled={busy || !draft.trim()}
                    onClick={() => handleCreateHost(org.orgIndexCode)}
                  >
                    新增
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {error ? (
        <p className="text-base text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p className="text-base text-emerald-700" role="status">
          {hint}
        </p>
      ) : null}

      {pendingDelete ? (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-black/40 p-4"
          role="presentation"
          onClick={() => {
            if (!busy) setPendingDelete(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={confirmTitleId}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id={confirmTitleId}
              className="text-xl font-bold text-slate-900"
            >
              {pendingDelete.kind === "org"
                ? `刪除部門「${pendingDelete.orgName}」？`
                : `刪除被訪人「${pendingDelete.personName}」？`}
            </h3>
            <p className="mt-3 text-base leading-relaxed text-slate-700">
              {pendingDelete.kind === "org"
                ? "此部門底下的被訪人也會一併刪除。"
                : "刪除後現場預約將無法再選擇此人。"}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                className={`${BTN_OUTLINE} min-h-12 flex-1 text-base`}
                aria-label="取消刪除"
                disabled={busy}
                onClick={() => setPendingDelete(null)}
              >
                取消
              </button>
              <button
                type="button"
                className={`${BTN} min-h-12 flex-1 bg-red-600 text-base text-white active:bg-red-700`}
                aria-label="確認刪除"
                disabled={busy}
                onClick={handleConfirmDelete}
              >
                {busy ? "刪除中…" : "確認刪除"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export const DirectoryDialog = ({ open, onClose }: DirectoryDialogProps) => (
  <KioskDialog
    open={open}
    onClose={onClose}
    title="部門與被訪人"
    closeLabel="關閉部門與被訪人"
    maxWidthClass="max-w-2xl"
  >
    <DirectoryPanel />
  </KioskDialog>
);
