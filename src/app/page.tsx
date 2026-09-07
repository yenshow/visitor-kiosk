"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { AppointForm } from "@/components/kiosk/AppointForm";
import { CheckinFlow } from "@/components/kiosk/CheckinFlow";
import { CheckoutFlow } from "@/components/kiosk/CheckoutFlow";
import { HomeActionCards } from "@/components/kiosk/HomeActionCards";
import { KioskShell } from "@/components/kiosk/KioskShell";

type Screen = "home" | "appoint" | "checkin" | "checkout";

type StatusInfo = {
  hasCredentials: boolean;
};

const parseIdleSeconds = (): number => {
  const n = Number(process.env.NEXT_PUBLIC_KIOSK_IDLE_SECONDS || "20");
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 20;
};

const IDLE_SECONDS = parseIdleSeconds();

const FlowPanel = ({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) => (
  <div className="flex min-h-0 w-full flex-1 overflow-auto">
    <div className={`m-auto w-full ${wide ? "max-w-3xl" : "max-w-2xl"}`}>
      {children}
    </div>
  </div>
);

export default function HomePage() {
  const [screen, setScreen] = useState<Screen>("home");
  const [status, setStatus] = useState<StatusInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/kiosk/status");
        const json = (await res.json()) as { data?: StatusInfo };
        if (!cancelled && json.data) setStatus(json.data);
      } catch {
        // ignore
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleGoHome = () => setScreen("home");
  const handleOpenCheckin = () => setScreen("checkin");
  const handleOpenCheckout = () => setScreen("checkout");
  const handleOpenAppoint = () => setScreen("appoint");

  return (
    <KioskShell
      hasCredentials={status?.hasCredentials ?? true}
      layout={screen === "home" ? "home" : "flow"}
    >
      {screen === "home" ? (
        <HomeActionCards
          onCheckin={handleOpenCheckin}
          onCheckout={handleOpenCheckout}
          onAppoint={handleOpenAppoint}
        />
      ) : null}

      {screen === "appoint" ? (
        <FlowPanel wide>
          <AppointForm idleSeconds={IDLE_SECONDS} onHome={handleGoHome} />
        </FlowPanel>
      ) : null}

      {screen === "checkin" ? (
        <FlowPanel>
          <CheckinFlow
            idleSeconds={IDLE_SECONDS}
            onHome={handleGoHome}
            onGoAppoint={handleOpenAppoint}
          />
        </FlowPanel>
      ) : null}

      {screen === "checkout" ? (
        <FlowPanel>
          <CheckoutFlow idleSeconds={IDLE_SECONDS} onHome={handleGoHome} />
        </FlowPanel>
      ) : null}
    </KioskShell>
  );
}
