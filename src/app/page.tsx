"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { AppointForm } from "@/components/kiosk/AppointForm";
import { CheckinFlow } from "@/components/kiosk/CheckinFlow";
import { CheckoutFlow } from "@/components/kiosk/CheckoutFlow";
import {
  HomeActionCards,
  type KioskStatsView,
} from "@/components/kiosk/HomeActionCards";
import { KioskShell } from "@/components/kiosk/KioskShell";
import { RecordsDialog } from "@/components/kiosk/RecordsDialog";
import type { KioskSettingsView } from "@/components/kiosk/SettingsForm";
import { ThemeSync } from "@/components/kiosk/ThemeSync";
import {
  DEFAULT_MARQUEE,
  type RecordsFilter,
} from "@/lib/kiosk/ui-constants";

type Screen = "home" | "appoint" | "checkin" | "checkout";

type StatusInfo = {
  hasCredentials: boolean;
};

const parseIdleSeconds = (): number => {
  const n = Number(process.env.NEXT_PUBLIC_KIOSK_IDLE_SECONDS || "20");
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 20;
};

const IDLE_SECONDS = parseIdleSeconds();
const STATS_POLL_MS = 20_000;

const FlowPanel = ({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) => (
  <div className="min-h-0 w-full flex-1 overflow-y-auto">
    <div className="flex min-h-full flex-col justify-center">
      <div className={`mx-auto w-full ${wide ? "max-w-3xl" : "max-w-2xl"}`}>
        {children}
      </div>
    </div>
  </div>
);

export default function HomePage() {
  const [screen, setScreen] = useState<Screen>("home");
  const [status, setStatus] = useState<StatusInfo | null>(null);
  const [stats, setStats] = useState<KioskStatsView | null>(null);
  const [settings, setSettings] = useState<KioskSettingsView | null>(null);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [recordsFilter, setRecordsFilter] = useState<RecordsFilter>("all");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [statusRes, settingsRes] = await Promise.all([
          fetch("/api/kiosk/status"),
          fetch("/api/kiosk/settings"),
        ]);
        const statusJson = (await statusRes.json()) as { data?: StatusInfo };
        const settingsJson = (await settingsRes.json()) as {
          data?: KioskSettingsView;
        };
        if (cancelled) return;
        if (statusJson.data) setStatus(statusJson.data);
        if (settingsJson.data) setSettings(settingsJson.data);
      } catch {
        // ignore
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (screen !== "home") return;

    let cancelled = false;
    const loadStats = async () => {
      try {
        const res = await fetch("/api/kiosk/stats");
        const json = (await res.json()) as { data?: KioskStatsView };
        if (!cancelled && json.data) setStats(json.data);
      } catch {
        // ignore
      }
    };

    void loadStats();
    const timer = window.setInterval(() => {
      void loadStats();
    }, STATS_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [screen]);

  const showAppoint = settings?.showAppoint ?? true;

  return (
    <>
      <ThemeSync theme={settings?.theme} />
      <KioskShell
        hasCredentials={status?.hasCredentials ?? true}
        layout={screen === "home" ? "home" : "flow"}
        marquee={settings?.resolvedMarquee || DEFAULT_MARQUEE}
        logoUrl={settings?.logoUrl || "/yenshow-logo.svg"}
      >
        {screen === "home" ? (
          <HomeActionCards
            stats={stats}
            showAppoint={showAppoint}
            onCheckin={() => setScreen("checkin")}
            onCheckout={() => setScreen("checkout")}
            onAppoint={() => setScreen("appoint")}
            onOpenRecords={(filter) => {
              setRecordsFilter(filter);
              setRecordsOpen(true);
            }}
          />
        ) : null}

        {screen === "appoint" ? (
          <FlowPanel wide>
            <AppointForm
              idleSeconds={IDLE_SECONDS}
              onHome={() => setScreen("home")}
            />
          </FlowPanel>
        ) : null}

        {screen === "checkin" ? (
          <FlowPanel>
            <CheckinFlow
              idleSeconds={IDLE_SECONDS}
              onHome={() => setScreen("home")}
              onGoAppoint={
                showAppoint ? () => setScreen("appoint") : undefined
              }
            />
          </FlowPanel>
        ) : null}

        {screen === "checkout" ? (
          <FlowPanel>
            <CheckoutFlow
              idleSeconds={IDLE_SECONDS}
              onHome={() => setScreen("home")}
            />
          </FlowPanel>
        ) : null}
      </KioskShell>

      {recordsOpen ? (
        <RecordsDialog
          key={recordsFilter}
          open
          initialFilter={recordsFilter}
          onClose={() => setRecordsOpen(false)}
        />
      ) : null}
    </>
  );
}
