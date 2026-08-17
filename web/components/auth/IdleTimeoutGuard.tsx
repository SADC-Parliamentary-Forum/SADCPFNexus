"use client";

import { useEffect, useRef } from "react";
import { profileApi } from "@/lib/api";
import { readStoredUser } from "@/lib/session";

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "pointerdown",
];

/**
 * Client-side idle logout matching the user's saved preference.
 * Server enforcement in EnsureSessionAuthIsValid remains the source of truth;
 * this avoids waiting for the next API call after the user walks away.
 */
export function IdleTimeoutGuard() {
  const lastActivity = useRef(Date.now());
  const minutesRef = useRef<number | null>(null);

  useEffect(() => {
    const stored = readStoredUser();
    if (typeof stored?.idle_timeout_minutes === "number") {
      minutesRef.current = stored.idle_timeout_minutes;
    }

    profileApi
      .get()
      .then((res) => {
        const value = res.data.idle_timeout_minutes;
        minutesRef.current = value === null || value === undefined ? 120 : value;
      })
      .catch(() => {
        if (minutesRef.current === null) minutesRef.current = 120;
      });

    const mark = () => {
      lastActivity.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, mark, { passive: true }));

    const timer = window.setInterval(() => {
      const minutes = minutesRef.current;
      if (minutes === null || minutes <= 0) return;
      const idleMs = Date.now() - lastActivity.current;
      if (idleMs >= minutes * 60_000) {
        window.location.href = "/login?reason=idle";
      }
    }, 15_000);

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, mark));
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
