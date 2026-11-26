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
  email?: string;
};

type DirectoryStore = {
  orgs: DirectoryOrg[];
  hosts: DirectoryHost[];
};

type PendingDelete =
  | { kind: "org"; orgIndexCode: string; orgName: string }
  | { kind: "host"; personId: string; personName: string };

type HostDraft = {
  personName: string;
  email: string;
};

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

const emptyHostDraft = (): HostDraft => ({ personName: "", email: "" });

const DirectoryPanel = () => {
  const [orgs, setOrgs] = useState<DirectoryOrg[]>([]);
  const [hosts, setHosts] = useState<DirectoryHost[]>([]);
  const [orgName, setOrgName] = useState("");
  const [hostDrafts, setHostDrafts] = useState<Record<string, HostDraft>>({});
  const [emailDrafts, setEmailDrafts] = useState<Record<string, string>>({});
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
    setEmailDrafts(
      Object.fromEntries(
        store.hosts.map((host) => [host.personId, host.email ?? ""]),
      ),
    );
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
    body: Record<string, unknown>,
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
    const draft = hostDrafts[orgIndexCode] ?? emptyHostDraft();
    const name = draft.personName.trim();
    if (!name) return;
    void postAction(
      {
        action: "createHost",
        orgIndexCode,
        personName: name,
        email: draft.email.trim(),
      },
      "已新增被訪人",
    ).then((ok) => {
      if (ok) {
        setHostDrafts((prev) => ({
          ...prev,
          [orgIndexCode]: emptyHostDraft(),
        }));
      }
    });
  };

  const handleSaveHostEmail = (host: DirectoryHost) => {
    const email = (emailDrafts[host.personId] ?? "").trim();
    if (email === (host.email ?? "").trim()) return;
    void postAction(
      {
        action: "updateHostEmail",
        personId: host.personId,
        email,
      },
      "已更新通知信箱",
    ).then((ok) => {
      if (!ok) {
        setEmailDrafts((prev) => ({
          ...prev,
          [host.personId]: host.email ?? "",
        }));
      }
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
    <>
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          先新增部門，再加入被訪人與通知信箱。預約成立後會通知該被訪人，並一併寄給設定頁的總機固定通知。
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
              const draft = hostDrafts[org.orgIndexCode] ?? emptyHostDraft();
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

                  <ul className="border-t border-slate-200">
                    {orgHosts.length === 0 ? (
                      <li className="px-4 py-3 text-sm text-slate-500">
                        此部門尚無被訪人
                      </li>
                    ) : (
                      orgHosts.map((host) => {
                        const emailDraft =
                          emailDrafts[host.personId] ?? host.email ?? "";
                        return (
                          <li
                            key={host.personId}
                            className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 last:border-b-0 sm:flex-row sm:items-center"
                          >
                            <span className="w-28 shrink-0 truncate text-base font-medium text-slate-800 sm:w-32">
                              {host.personName}
                            </span>
                            <input
                              className={`${FIELD} min-h-11 flex-1 text-sm`}
                              type="email"
                              value={emailDraft}
                              onChange={(e) =>
                                setEmailDrafts((prev) => ({
                                  ...prev,
                                  [host.personId]: e.target.value,
                                }))
                              }
                              onBlur={() => handleSaveHostEmail(host)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.currentTarget.blur();
                                }
                              }}
                              placeholder="通知信箱（選填）"
                              aria-label={`${host.personName} 通知信箱`}
                              disabled={busy}
                            />
                            <button
                              type="button"
                              className={`${BTN_DANGER} shrink-0 self-end sm:self-auto`}
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
                        );
                      })
                    )}
                  </ul>

                  <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/60 p-3 sm:flex-row">
                    <input
                      className={`${FIELD} min-h-11 sm:w-36 sm:flex-none`}
                      value={draft.personName}
                      onChange={(e) =>
                        setHostDrafts((prev) => ({
                          ...prev,
                          [org.orgIndexCode]: {
                            ...draft,
                            personName: e.target.value,
                          },
                        }))
                      }
                      maxLength={40}
                      placeholder="姓名"
                      aria-label={`新增 ${org.orgName} 被訪人姓名`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter")
                          handleCreateHost(org.orgIndexCode);
                      }}
                    />
                    <input
                      className={`${FIELD} min-h-11 flex-1`}
                      type="email"
                      value={draft.email}
                      onChange={(e) =>
                        setHostDrafts((prev) => ({
                          ...prev,
                          [org.orgIndexCode]: {
                            ...draft,
                            email: e.target.value,
                          },
                        }))
                      }
                      placeholder="通知信箱（選填）"
                      aria-label={`新增 ${org.orgName} 被訪人信箱`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter")
                          handleCreateHost(org.orgIndexCode);
                      }}
                    />
                    <button
                      type="button"
                      className={`${BTN_DARK} shrink-0`}
                      aria-label={`新增 ${org.orgName} 被訪人`}
                      disabled={busy || !draft.personName.trim()}
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
      </div>

      {pendingDelete ? (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4"
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
    </>
  );
};

export const DirectoryDialog = ({ open, onClose }: DirectoryDialogProps) => (
  <KioskDialog
    open={open}
    onClose={onClose}
    title="部門與被訪人"
    closeLabel="關閉部門與被訪人"
    maxWidthClass="max-w-2xl"
    maxHeightClass="max-h-[70vh]"
  >
    <DirectoryPanel />
  </KioskDialog>
);
