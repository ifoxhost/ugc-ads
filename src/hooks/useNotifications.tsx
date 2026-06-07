import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  metadata: Record<string, any> | null;
  read_at: string | null;
  created_at: string;
}

/**
 * Subscribes to the current user's notifications (realtime), exposes helpers
 * to mark items read/unread, delete, and clear all.
 */
export function useNotifications(limit = 50) {
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.id) { setItems([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!error && data) setItems(data as AppNotification[]);
    setLoading(false);
  }, [user?.id, limit]);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime updates
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setItems((prev) => {
          if (payload.eventType === "INSERT") {
            return [payload.new as AppNotification, ...prev].slice(0, limit);
          }
          if (payload.eventType === "UPDATE") {
            return prev.map((n) => n.id === (payload.new as any).id ? payload.new as AppNotification : n);
          }
          if (payload.eventType === "DELETE") {
            return prev.filter((n) => n.id !== (payload.old as any).id);
          }
          return prev;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, limit]);

  const unreadCount = items.filter((n) => !n.read_at).length;

  const markRead = useCallback(async (id: string) => {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user?.id) return;
    await supabase.from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id).is("read_at", null);
  }, [user?.id]);

  const remove = useCallback(async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
  }, []);

  const clearAll = useCallback(async () => {
    if (!user?.id) return;
    await supabase.from("notifications").delete().eq("user_id", user.id);
  }, [user?.id]);

  return { items, loading, unreadCount, refresh, markRead, markAllRead, remove, clearAll };
}
