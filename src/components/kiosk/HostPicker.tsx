"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { HostPerson, OrgOption } from "@/lib/kiosk/visitor";

export type { HostPerson };

type HostPickerProps = {
  selectedHost: HostPerson | null;
  onSelect: (host: HostPerson | null) => void;
  onError: (message: string) => void;
};

export const HostPicker = ({
  selectedHost,
  onSelect,
  onError,
}: HostPickerProps) => {
  const orgListId = useId();
  const hostListId = useId();
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [hosts, setHosts] = useState<HostPerson[]>([]);
  const [orgIndexCode, setOrgIndexCode] = useState("");
  const [personId, setPersonId] = useState("");
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [loadingHosts, setLoadingHosts] = useState(false);
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const [hostMenuOpen, setHostMenuOpen] = useState(false);
  const orgMenuRef = useRef<HTMLDivElement>(null);
  const hostMenuRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onSelectRef.current = onSelect;
    onErrorRef.current = onError;
  }, [onSelect, onError]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingOrgs(true);
      try {
        const res = await fetch("/api/kiosk/orgs");
        const json = (await res.json()) as {
          msg?: string;
          data?: { orgs?: OrgOption[] };
        };
        if (cancelled) return;
        if (!res.ok) {
          onErrorRef.current(json.msg || "載入部門失敗");
          setOrgs([]);
          return;
        }
        const list = json.data?.orgs ?? [];
        setOrgs(list);
        if (list.length === 0) {
          onErrorRef.current("尚無部門資料，請至設定頁新增部門與被訪人");
        }
      } catch {
        if (!cancelled) onErrorRef.current("載入部門失敗");
      } finally {
        if (!cancelled) setLoadingOrgs(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadHosts = useCallback(async (code: string) => {
    if (!code) {
      setHosts([]);
      setPersonId("");
      onSelectRef.current(null);
      return;
    }

    setLoadingHosts(true);
    setPersonId("");
    onSelectRef.current(null);

    try {
      const res = await fetch("/api/kiosk/hosts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgIndexCode: code }),
      });
      const json = (await res.json()) as {
        msg?: string;
        data?: { hosts?: HostPerson[] };
      };
      if (!res.ok) {
        onErrorRef.current(json.msg || "載入被訪人失敗");
        setHosts([]);
        return;
      }
      const list = json.data?.hosts ?? [];
      setHosts(list);
      if (list.length === 0) {
        onErrorRef.current("此部門尚無可選被訪人");
      }
    } catch {
      onErrorRef.current("載入被訪人失敗");
      setHosts([]);
    } finally {
      setLoadingHosts(false);
    }
  }, []);

  useEffect(() => {
    if (!orgMenuOpen && !hostMenuOpen) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (orgMenuOpen && !orgMenuRef.current?.contains(target)) {
        setOrgMenuOpen(false);
      }
      if (hostMenuOpen && !hostMenuRef.current?.contains(target)) {
        setHostMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("touchstart", handlePointerDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("touchstart", handlePointerDown);
    };
  }, [orgMenuOpen, hostMenuOpen]);

  const handlePickOrg = (code: string) => {
    setOrgIndexCode(code);
    setOrgMenuOpen(false);
    setHostMenuOpen(false);
    void loadHosts(code);
  };

  const handlePickHost = (host: HostPerson) => {
    setPersonId(host.personId);
    setHostMenuOpen(false);
    onSelectRef.current(host);
  };

  const selectedOrg =
    orgs.find((org) => org.orgIndexCode === orgIndexCode) ?? null;
  const selectedHostOption =
    hosts.find((host) => host.personId === personId) ?? null;

  const orgLabel = loadingOrgs
    ? "部門載入中…"
    : orgs.length === 0
      ? "無可選部門"
      : selectedOrg
        ? selectedOrg.orgName
        : "請選擇部門";

  const hostLabel = !orgIndexCode
    ? "請先選擇部門"
    : loadingHosts
      ? "人員載入中…"
      : hosts.length === 0
        ? "此部門無人員"
        : selectedHostOption
          ? selectedHostOption.personName
          : "請選擇被訪人";

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="relative block" ref={orgMenuRef}>
        <span className="mb-1 block text-sm font-medium text-slate-600">
          部門 *
        </span>
        <button
          type="button"
          className="flex min-h-14 w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-4 text-left text-lg active:bg-slate-50 disabled:bg-slate-100"
          aria-label="選擇部門"
          aria-haspopup="listbox"
          aria-expanded={orgMenuOpen}
          aria-controls={orgListId}
          disabled={loadingOrgs || orgs.length === 0}
          onClick={() => {
            setHostMenuOpen(false);
            setOrgMenuOpen((prev) => !prev);
          }}
        >
          <span
            className={
              selectedOrg ? "truncate text-slate-900" : "truncate text-slate-400"
            }
          >
            {orgLabel}
          </span>
          <span className="ml-2 shrink-0 text-slate-400" aria-hidden>
            {orgMenuOpen ? "▲" : "▼"}
          </span>
        </button>

        {orgMenuOpen ? (
          <div
            id={orgListId}
            role="listbox"
            aria-label="部門清單"
            className="absolute right-0 left-0 z-30 mt-2 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
          >
            {orgs.map((org) => {
              const isSelected = org.orgIndexCode === orgIndexCode;
              return (
                <button
                  key={org.orgIndexCode}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`flex min-h-14 w-full items-center px-4 py-3 text-left text-lg active:bg-blue-100 ${
                    isSelected
                      ? "bg-blue-50 font-semibold text-blue-800"
                      : "text-slate-800 hover:bg-slate-100"
                  }`}
                  onClick={() => handlePickOrg(org.orgIndexCode)}
                >
                  {org.orgName}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="relative block" ref={hostMenuRef}>
        <span className="mb-1 block text-sm font-medium text-slate-600">
          被訪人 *
        </span>
        <button
          type="button"
          className="flex min-h-14 w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-4 text-left text-lg active:bg-slate-50 disabled:bg-slate-100"
          aria-label="選擇被訪人"
          aria-haspopup="listbox"
          aria-expanded={hostMenuOpen}
          aria-controls={hostListId}
          disabled={!orgIndexCode || loadingHosts || hosts.length === 0}
          onClick={() => {
            setOrgMenuOpen(false);
            setHostMenuOpen((prev) => !prev);
          }}
        >
          <span
            className={
              selectedHost
                ? "truncate text-slate-900"
                : "truncate text-slate-400"
            }
          >
            {hostLabel}
          </span>
          <span className="ml-2 shrink-0 text-slate-400" aria-hidden>
            {hostMenuOpen ? "▲" : "▼"}
          </span>
        </button>

        {hostMenuOpen ? (
          <div
            id={hostListId}
            role="listbox"
            aria-label="被訪人清單"
            className="absolute right-0 left-0 z-30 mt-2 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
          >
            {hosts.map((host) => {
              const isSelected = host.personId === personId;
              return (
                <button
                  key={host.personId}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`flex min-h-14 w-full items-center px-4 py-3 text-left text-lg active:bg-blue-100 ${
                    isSelected
                      ? "bg-blue-50 font-semibold text-blue-800"
                      : "text-slate-800 hover:bg-slate-100"
                  }`}
                  onClick={() => handlePickHost(host)}
                >
                  {host.personName}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
};
