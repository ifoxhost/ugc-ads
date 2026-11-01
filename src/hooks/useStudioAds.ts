import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { StudioAd } from "@/components/ugc/studio-types";
export function useStudioAds() {
  const { user } = useAuth(); const [ads, setAds] = useState<StudioAd[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const sequence = useRef(0);
  const refresh = useCallback(async () => { if (!user) { setLoading(false); return; } const run = ++sequence.current; const { data, error } = await supabase.from("generated_ads").select("*").eq("user_id", user.id).is("deleted_at", null).order("created_at", { ascending: false }); if (run !== sequence.current) return; setError(error?.message || null); if (data) setAds(data as unknown as StudioAd[]); setLoading(false); }, [user?.id]);
  useEffect(() => { if (!user) return; let disposed = false; let channel: ReturnType<typeof supabase.channel> | null = null; let timer: ReturnType<typeof setTimeout> | undefined; let attempt = 0;
    const connect = () => { if (disposed) return; if (timer) clearTimeout(timer); if (channel) void supabase.removeChannel(channel); channel = supabase.channel(`ugc-library-${user.id}-${crypto.randomUUID()}`).on("postgres_changes", { event: "*", schema: "public", table: "generated_ads", filter: `user_id=eq.${user.id}` }, () => void refresh()).subscribe(status => { if (disposed) return; if (status === "SUBSCRIBED") { attempt = 0; void refresh(); } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) { timer = setTimeout(connect, Math.min(15000, 500 * 2 ** ++attempt)); } }); };
    const resume = () => { if (document.visibilityState === "visible") { void refresh(); connect(); } }; void refresh(); connect(); document.addEventListener("visibilitychange", resume); window.addEventListener("online", resume);
    return () => { disposed = true; ++sequence.current; if (timer) clearTimeout(timer); if (channel) void supabase.removeChannel(channel); document.removeEventListener("visibilitychange", resume); window.removeEventListener("online", resume); };
  }, [user?.id, refresh]); return { ads, loading, error, refresh };
}