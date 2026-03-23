"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export function RouteProgressBar() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevPathRef = useRef(pathname);
  const runningRef = useRef(false);

  const startProgress = () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setVisible(true);
    setProgress(10);
    let p = 10;
    timerRef.current = setInterval(() => {
      // Ease toward 85% but never reach 100% on its own
      p += Math.random() * 12 * (1 - p / 85);
      if (p > 85) p = 85;
      setProgress(p);
    }, 150);
  };

  const finishProgress = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    runningRef.current = false;
    setProgress(100);
    setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 350);
  };

  // Finish when route actually changes
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      finishProgress();
      prevPathRef.current = pathname;
    }
  }, [pathname]);

  // Start on link/button click that targets an internal route
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
      if (!target) return;
      const href = target.getAttribute("href") ?? "";
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("mailto:") ||
        target.target === "_blank"
      ) return;
      if (href !== pathname) startProgress();
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [pathname]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 right-0 top-0 z-[9999] h-[3px]"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 200ms ease" }}
    >
      <div
        className="h-full bg-primary"
        style={{
          width: `${progress}%`,
          transition: progress === 100 ? "width 200ms ease" : "width 150ms ease-out",
          boxShadow: "0 0 10px rgba(29, 133, 237, 0.7), 0 0 4px rgba(29, 133, 237, 0.5)",
        }}
      />
    </div>
  );
}
