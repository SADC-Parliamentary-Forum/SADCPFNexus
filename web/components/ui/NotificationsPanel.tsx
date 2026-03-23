"use client";

import { useEffect, useState } from "react";
import {
  alertsApi,
  AlertsSummary,
  AlertsMission,
  AlertsAwayEntry,
  AlertsDeadline,
} from "@/lib/api";
import { formatDateShort, formatDateRelative } from "@/lib/utils";

export interface NotificationsPanelProps {
  onClose: () => void;
}

interface NotificationItem {
  id: string;
  iconName: string;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
  timeLabel: string;
}

function buildNotifications(data: AlertsSummary): NotificationItem[] {
  const items: NotificationItem[] = [];

  // Active missions away
  data.active_missions.forEach((m: AlertsMission) => {
    items.push({
      id: `mission-${m.id}`,
      iconName: "flight_takeoff",
      iconColor: "text-orange-600",
      iconBg: "bg-orange-100",
      title: `Active mission: ${m.requester_name}`,
      subtitle: `in ${m.destination_country}`,
      timeLabel: `Returns ${formatDateShort(m.return_date)}`,
    });
  });

  // Staff on leave
  data.away_today
    .filter((e: AlertsAwayEntry) => e.type === "leave")
    .forEach((e: AlertsAwayEntry) => {
      items.push({
        id: `leave-${e.id}`,
        iconName: "event_busy",
        iconColor: "text-blue-600",
        iconBg: "bg-blue-100",
        title: `On leave: ${e.name}`,
        subtitle: `until ${formatDateShort(e.to_date)}`,
        timeLabel: formatDateRelative(e.to_date),
      });
    });

  // Upcoming imprest & workplan deadlines
  data.upcoming_deadlines.forEach((d: AlertsDeadline) => {
    const isImprest = d.module === "imprest";
    items.push({
      id: `deadline-${d.module}-${d.id}`,
      iconName: isImprest ? "receipt_long" : "event_note",
      iconColor: "text-red-600",
      iconBg: "bg-red-100",
      title: isImprest
        ? `Imprest ${d.reference_number ?? d.id} due`
        : `Deadline: ${d.title}`,
      subtitle: isImprest
        ? `Due ${formatDateShort(d.deadline_date)}`
        : `on ${formatDateShort(d.deadline_date)}`,
      timeLabel: formatDateRelative(d.deadline_date),
    });
  });

  return items;
}

export default function NotificationsPanel({ onClose }: NotificationsPanelProps) {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [allRead, setAllRead] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    alertsApi
      .getSummary()
      .then((res) => {
        if (cancelled) return;
        setNotifications(buildNotifications(res.data));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className="fixed right-0 top-0 z-50 flex h-full w-80 flex-col bg-white shadow-xl"
        role="dialog"
        aria-label="Notifications"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-neutral-500">
              notifications
            </span>
            <h2 className="text-sm font-semibold text-neutral-800">
              Notifications
            </h2>
            {!allRead && notifications.length > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                {notifications.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
            aria-label="Close notifications"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Mark all as read */}
        {!loading && notifications.length > 0 && (
          <div className="flex justify-end border-b border-neutral-100 px-4 py-2">
            <button
              onClick={() => setAllRead(true)}
              className={`text-xs font-medium transition-colors ${
                allRead
                  ? "cursor-default text-neutral-400"
                  : "text-primary hover:text-primary/80"
              }`}
              disabled={allRead}
            >
              {allRead ? "All caught up" : "Mark all as read"}
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Loading skeletons */}
          {loading && (
            <ul className="divide-y divide-neutral-100 px-4 py-2">
              {[1, 2, 3].map((n) => (
                <li key={n} className="flex items-start gap-3 py-3">
                  <div className="h-8 w-8 animate-pulse rounded-full bg-neutral-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-3/4 animate-pulse rounded bg-neutral-200" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-200" />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <span className="material-symbols-outlined text-[36px] text-neutral-300">
                error_outline
              </span>
              <p className="text-sm font-medium text-neutral-500">
                Failed to load notifications
              </p>
              <p className="text-xs text-neutral-400">Please try again later.</p>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <span className="material-symbols-outlined text-[40px] text-neutral-300">
                notifications_none
              </span>
              <p className="text-sm font-medium text-neutral-500">
                You&apos;re all caught up
              </p>
              <p className="text-xs text-neutral-400">No new notifications.</p>
            </div>
          )}

          {/* Notification list */}
          {!loading && !error && notifications.length > 0 && (
            <ul className="divide-y divide-neutral-100">
              {notifications.map((item) => (
                <li
                  key={item.id}
                  className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-neutral-50 ${
                    allRead ? "opacity-60" : ""
                  }`}
                >
                  {/* Icon circle */}
                  <span
                    className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${item.iconBg}`}
                  >
                    <span
                      className={`material-symbols-outlined text-[16px] ${item.iconColor}`}
                    >
                      {item.iconName}
                    </span>
                  </span>

                  {/* Text */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-800">
                      {item.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-neutral-500">
                      {item.subtitle}
                    </p>
                    <p className="mt-1 text-[10px] font-medium text-neutral-400">
                      {item.timeLabel}
                    </p>
                  </div>

                  {/* Unread dot */}
                  {!allRead && (
                    <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-200 px-4 py-3">
          <p className="text-center text-[11px] text-neutral-400">
            Showing alerts &amp; upcoming deadlines
          </p>
        </div>
      </aside>
    </>
  );
}
