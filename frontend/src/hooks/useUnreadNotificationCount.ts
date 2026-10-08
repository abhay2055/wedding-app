import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import * as notificationsApi from "../api/notifications";

const POLL_INTERVAL_MS = 30_000;

// Same "poll, don't hold a persistent connection" tradeoff as
// useUnreadMessageCount - a nav badge only needs to be eventually
// consistent. `refreshToken` lets a caller (e.g. NotificationBell, right
// after marking something read) force an immediate refetch instead of
// waiting for the next poll tick.
export function useUnreadNotificationCount(refreshToken?: unknown): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }

    let cancelled = false;
    function load() {
      notificationsApi
        .getUnreadCount()
        .then((c) => {
          if (!cancelled) setCount(c);
        })
        .catch(() => undefined);
    }

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, refreshToken]);

  return count;
}
