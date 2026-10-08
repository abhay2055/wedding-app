import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as notificationsApi from "../api/notifications";
import { Notification } from "../types/api";
import { useAuth } from "../context/AuthContext";
import { notificationTarget } from "../utils/notificationTarget";
import { Button } from "../components/Button";
import { Pagination } from "../components/Pagination";
import { LoadingState } from "../components/LoadingState";
import { EmptyState } from "../components/EmptyState";
import { ErrorMessage, extractErrorMessage } from "../components/ErrorMessage";
import { formatDate } from "../utils/format";

const FILTERS: { value: "all" | "unread"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
];

export function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Notification[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setIsLoading(true);
    setError(null);
    notificationsApi
      .listMyNotifications({ unreadOnly: filter === "unread", page, limit: 20 })
      .then((res) => {
        setItems(res.items);
        setPagination(res.pagination);
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [filter, page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleClick(notification: Notification) {
    if (!user) return;
    if (!notification.isRead) {
      await notificationsApi.markRead(notification.id);
      setItems((prev) => prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)));
    }
    const target = notificationTarget(notification, user.role);
    if (target) navigate(target);
  }

  async function handleMarkAllRead() {
    await notificationsApi.markAllRead();
    load();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-brand-800">Notifications</h1>
        <Button variant="secondary" onClick={handleMarkAllRead}>Mark all read</Button>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setFilter(f.value); setPage(1); }}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              filter === f.value ? "bg-brand-600 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <ErrorMessage message={error} />}

      {isLoading ? (
        <LoadingState label="Loading notifications..." />
      ) : items.length === 0 ? (
        <EmptyState title="No notifications here." />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                  n.isRead ? "border-neutral-200 bg-white" : "border-brand-200 bg-brand-50"
                } hover:shadow-sm`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-neutral-900">{n.title}</p>
                  <span className="flex-shrink-0 text-xs text-neutral-400">{formatDate(n.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm text-neutral-600">{n.message}</p>
              </button>
            ))}
          </div>
          <Pagination pagination={pagination} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
