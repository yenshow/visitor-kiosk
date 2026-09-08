"use client";

import { useEffect, useRef, useState } from "react";

type IdleCountdownProps = {
  seconds: number;
  onComplete: () => void;
  label?: string;
};

export const IdleCountdown = ({
  seconds,
  onComplete,
  label = "秒後返回首頁",
}: IdleCountdownProps) => {
  const [left, setLeft] = useState(seconds);
  const [trackedSeconds, setTrackedSeconds] = useState(seconds);
  const completedRef = useRef(false);

  if (seconds !== trackedSeconds) {
    setTrackedSeconds(seconds);
    setLeft(seconds);
  }

  useEffect(() => {
    completedRef.current = false;
    const timer = window.setInterval(() => {
      setLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [seconds]);

  useEffect(() => {
    if (left !== 0 || completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [left, onComplete]);

  return (
    <p className="mt-6 text-center text-lg text-slate-500" aria-live="polite">
      {left} {label}
    </p>
  );
};
