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
import type { KioskSettingsView } from "@/components/kiosk/SettingsForm";
import { ThemeSync } from "@/components/kiosk/ThemeSync";
import {
  DEFAULT_MARQUEE,
  KIOSK_IDLE_SECONDS,
} from "@/lib/kiosk/ui-constants";

type Screen = "home" | "appoint" | "checkin" | "checkout";

const STATS_POLL_MS = 20_000;

const FlowPanel = ({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) => (
  <div className="w-full flex-1 overflow-x-hidden landscape:min-h-0 landscape:overflow-y-auto">
    <div className="flex flex-col justify-start pb-4 landscape:min-h-full landscape:justify-center landscape:pb-0">
      <div className={`mx-auto w-full ${wide ? "max-w-3xl" : "max-w-2xl"}`}>
        {children}
      </div>
    </div>
  </div>
);

export default function HomePage() {
  const [screen, setScreen] = useState<Screen>("home");
  const [stats, setStats] = useState<KioskStatsView | null>(null);
  const [settings, setSettings] = useState<KioskSettingsView | null>(null);
  const [licensed, setLicensed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const settingsRes = await fetch("/api/kiosk/settings");
        const settingsJson = (await settingsRes.json()) as {
          data?: KioskSettingsView;
        };
        if (cancelled) return;
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
    const controller = new AbortController();
    const loadStatus = async () => {
      try {
        const res = await fetch("/api/kiosk/status", { signal: controller.signal, cache: "no-store" });
        const result = (await res.json()) as { data?: { licensed?: boolean } };
        if (!controller.signal.aborted) setLicensed(result.data?.licensed === true);
      } catch {
        if (!controller.signal.aborted) setLicensed(false);
      }
    };
    void loadStatus();
    const timer = window.setInterval(() => void loadStatus(), STATS_POLL_MS);
    return () => {
      controller.abort();
      window.clearInterval(timer);
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
        licensed={licensed !== false}
        layout={screen === "home" ? "home" : "flow"}
        marquee={settings?.resolvedMarquee || DEFAULT_MARQUEE}
        logoUrl={settings?.logoUrl || "/yenshow-logo.svg"}
      >
        {screen === "home" ? (
          <HomeActionCards
            stats={stats}
            showAppoint={showAppoint}
            licensed={licensed === true}
            onCheckin={() => setScreen("checkin")}
            onCheckout={() => setScreen("checkout")}
            onAppoint={() => setScreen("appoint")}
          />
        ) : null}

        {screen === "appoint" ? (
          <FlowPanel wide>
            <AppointForm
              variant="kiosk"
              idleSeconds={KIOSK_IDLE_SECONDS}
              onHome={() => setScreen("home")}
            />
          </FlowPanel>
        ) : null}

        {screen === "checkin" ? (
          <FlowPanel>
            <CheckinFlow
              idleSeconds={KIOSK_IDLE_SECONDS}
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
              idleSeconds={KIOSK_IDLE_SECONDS}
              onHome={() => setScreen("home")}
            />
          </FlowPanel>
        ) : null}
      </KioskShell>
    </>
  );
}
