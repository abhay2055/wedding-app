import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as notificationsApi from "../api/notifications";
import { Notification } from "../types/api";
import { useAuth } from "../context/AuthContext";
import { useUnreadNotificationCount } from "../hooks/useUnreadNotificationCount";
import { notificationTarget } from "../utils/notificationTarget";
import { formatDate } from "../utils/format";

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const unreadCount = useUnreadNotificationCount(refreshToken);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    notificationsApi
      .listMyNotifications({ limit: 8 })
      .then((res) => setItems(res.items))
      .catch(() => undefined)
      .finally(() => setIsLoading(false));
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  async function handleClickNotification(notification: Notification) {
    if (!user) return;
    if (!notification.isRead) {
      await notificationsApi.markRead(notification.id);
      setItems((prev) => prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)));
      setRefreshToken((t) => t + 1);
    }
    setOpen(false);
    const target = notificationTarget(notification, user.role);
    if (target) navigate(target);
  }

  async function handleMarkAllRead() {
    await notificationsApi.markAllRead();
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setRefreshToken((t) => t + 1);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full p-1.5 text-neutral-600 hover:bg-neutral-100 hover:text-brand-700"
        aria-label="Notifications"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-medium text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-80 rounded-lg border border-neutral-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
            <p className="text-sm font-medium text-neutral-900">Notifications</p>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-brand-700 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {isLoading && <p className="px-3 py-4 text-center text-sm text-neutral-500">Loading...</p>}
            {!isLoading && items.length === 0 && (
              <p className="px-3 py-4 text-center text-sm text-neutral-500">No notifications yet.</p>
            )}
            {!isLoading &&
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClickNotification(n)}
                  className={`block w-full border-b border-neutral-50 px-3 py-2.5 text-left last:border-0 hover:bg-neutral-50 ${
                    n.isRead ? "" : "bg-brand-50/60"
                  }`}
                >
                  <p className="text-sm font-medium text-neutral-900">{n.title}</p>
                  <p className="mt-0.5 text-xs text-neutral-600">{n.message}</p>
                  <p className="mt-1 text-[11px] text-neutral-400">{formatDate(n.createdAt)}</p>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
