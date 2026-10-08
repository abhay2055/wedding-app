import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import * as conversationsApi from "../api/conversations";

const POLL_INTERVAL_MS = 30_000;

// A simple poll rather than a persistent global socket connection just for
// a nav badge - the conversation view itself is real-time (see
// useConversationSocket); this only needs to be "eventually" up to date.
export function useUnreadMessageCount(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user || (user.role !== "CUSTOMER" && user.role !== "VENDOR")) {
      setCount(0);
      return;
    }

    let cancelled = false;
    function load() {
      conversationsApi
        .listConversations()
        .then((conversations) => {
          if (cancelled) return;
          setCount(conversations.reduce((sum, c) => sum + (c._count?.messages ?? 0), 0));
        })
        .catch(() => undefined);
    }

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user?.id, user?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  return count;
}
