"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FlowCard } from "@/components/kiosk/FlowCard";
import {
  SettingsForm,
  type KioskSettingsView,
} from "@/components/kiosk/SettingsForm";
import { ThemeSync } from "@/components/kiosk/ThemeSync";

export default function SettingPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<KioskSettingsView | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/kiosk/settings");
        const json = (await res.json()) as {
          msg?: string;
          data?: KioskSettingsView;
        };
        if (!res.ok || !json.data) {
          if (!cancelled) setError(json.msg || "載入設定失敗");
          return;
        }
        if (!cancelled) setSettings(json.data);
      } catch {
        if (!cancelled) setError("載入設定失敗");
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleBack = () => {
    router.push("/");
  };

  return (
    <div className="flex min-h-dvh flex-col overflow-y-auto bg-(image:--shell-gradient) text-(--text-primary)">
      <ThemeSync theme={settings?.theme} />
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-8">
        <FlowCard title="服務機設定" onBack={handleBack}>
          {error ? (
            <p className="text-lg text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          {!error && !settings ? (
            <p className="text-lg text-slate-500">載入中…</p>
          ) : null}
          {settings ? (
            <SettingsForm initial={settings} onSaved={setSettings} />
          ) : null}
        </FlowCard>
      </div>
    </div>
  );
}
