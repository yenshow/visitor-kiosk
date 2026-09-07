"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

export type HostPerson = {
  personId: string;
  personName: string;
  orgIndexCode?: string;
};

type OrgOption = {
  orgIndexCode: string;
  orgName: string;
  parentOrgIndexCode: string;
  label: string;
};

type OrgTreeNode = OrgOption & {
  children: OrgTreeNode[];
};

type HostPickerProps = {
  selectedHost: HostPerson | null;
  onSelect: (host: HostPerson | null) => void;
  onError: (message: string) => void;
};

const buildOrgTree = (orgs: OrgOption[]): OrgTreeNode[] => {
  const byId = new Map<string, OrgTreeNode>();
  for (const org of orgs) {
    byId.set(org.orgIndexCode, { ...org, children: [] });
  }

  const roots: OrgTreeNode[] = [];
  for (const node of byId.values()) {
    const parent = byId.get(node.parentOrgIndexCode);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sortNodes = (nodes: OrgTreeNode[]) => {
    nodes.sort((a, b) => a.orgName.localeCompare(b.orgName, "zh-Hant"));
    for (const node of nodes) sortNodes(node.children);
  };
  sortNodes(roots);
  return roots;
};

const collectSelectable = (nodes: OrgTreeNode[]): OrgTreeNode[] => {
  const result: OrgTreeNode[] = [];
  const walk = (list: OrgTreeNode[]) => {
    for (const node of list) {
      result.push(node);
      if (node.children.length > 0) walk(node.children);
    }
  };
  walk(nodes);
  return result;
};

type OrgMenuItemProps = {
  node: OrgTreeNode;
  depth: number;
  selectedCode: string;
  onPick: (code: string) => void;
};

const OrgMenuItem = ({
  node,
  depth,
  selectedCode,
  onPick,
}: OrgMenuItemProps) => {
  const hasChildren = node.children.length > 0;
  const isSelected = selectedCode === node.orgIndexCode;
  const paddingLeft = 12 + depth * 16;

  if (hasChildren) {
    return (
      <div role="group" aria-label={node.orgName}>
        <button
          type="button"
          role="option"
          aria-selected={isSelected}
          className={`flex min-h-14 w-full items-center border-b border-slate-100 px-3 py-3 text-left text-base font-semibold transition-colors active:bg-blue-100 ${
            isSelected
              ? "bg-blue-50 text-blue-800"
              : "bg-slate-50 text-slate-600 hover:bg-slate-100"
          }`}
          style={{ paddingLeft }}
          onClick={() => onPick(node.orgIndexCode)}
        >
          {node.orgName}
          <span className="ml-2 text-xs font-normal text-slate-400">
            （含下層）
          </span>
        </button>
        {node.children.map((child) => (
          <OrgMenuItem
            key={child.orgIndexCode}
            node={child}
            depth={depth + 1}
            selectedCode={selectedCode}
            onPick={onPick}
          />
        ))}
      </div>
    );
  }

  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      className={`flex min-h-14 w-full items-center px-3 py-3 text-left text-lg transition-colors active:bg-blue-100 ${
        isSelected
          ? "bg-blue-50 font-semibold text-blue-800"
          : "text-slate-800 hover:bg-slate-100"
      }`}
      style={{ paddingLeft }}
      onClick={() => onPick(node.orgIndexCode)}
    >
      {node.orgName}
    </button>
  );
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
          onErrorRef.current("查無部門資料，請確認 YSOP 組織設定");
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

  const tree = useMemo(() => buildOrgTree(orgs), [orgs]);
  const selectable = useMemo(() => collectSelectable(tree), [tree]);
  const selectedOrg = useMemo(
    () => selectable.find((o) => o.orgIndexCode === orgIndexCode) ?? null,
    [selectable, orgIndexCode],
  );
  const selectedHostOption = useMemo(
    () => hosts.find((h) => h.personId === personId) ?? null,
    [hosts, personId],
  );

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
    void loadHosts(orgIndexCode);
  }, [orgIndexCode, loadHosts]);

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
  };

  const handlePickHost = (host: HostPerson) => {
    setPersonId(host.personId);
    setHostMenuOpen(false);
    onSelectRef.current(host);
  };

  const orgLabel = loadingOrgs
    ? "部門載入中…"
    : selectable.length === 0
      ? "無可選部門"
      : selectedOrg
        ? selectedOrg.label
        : "請選擇部門／子部門";

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
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="relative block" ref={orgMenuRef}>
        <span className="mb-1 block text-sm font-medium text-slate-600">
          部門／子部門
        </span>
        <button
          type="button"
          className="flex min-h-16 w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-4 text-left text-lg active:bg-slate-50 disabled:bg-slate-100"
          aria-label="選擇部門或子部門"
          aria-haspopup="listbox"
          aria-expanded={orgMenuOpen}
          aria-controls={orgListId}
          disabled={loadingOrgs || selectable.length === 0}
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
            aria-label="部門與子部門清單"
            className="absolute left-0 right-0 z-30 mt-2 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
          >
            <p className="border-b border-slate-100 px-3 py-2 text-sm text-slate-500">
              可選部門或子部門（有下層者含其人員）
            </p>
            {tree.map((node) => (
              <OrgMenuItem
                key={node.orgIndexCode}
                node={node}
                depth={0}
                selectedCode={orgIndexCode}
                onPick={handlePickOrg}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="relative block" ref={hostMenuRef}>
        <span className="mb-1 block text-sm font-medium text-slate-600">
          被訪人
        </span>
        <button
          type="button"
          className="flex min-h-16 w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-4 text-left text-lg active:bg-slate-50 disabled:bg-slate-100"
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
              selectedHost ? "truncate text-slate-900" : "truncate text-slate-400"
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
            className="absolute left-0 right-0 z-30 mt-2 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
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
