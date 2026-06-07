import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { pollKieTask } from "../_shared/pipeline.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_PROCESSING_MINUTES = 15;

// Polls Kie.ai directly for in-flight lyric-video renders. No n8n callbacks.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: pending } = await sb.from("generated_ads")
      .select("id, user_id, video_task_id, created_at, ad_copy")
      .in("video_status", ["queued","processing"])
      .like("prompt_used", "BeatFrame lyric video%")
      .order("video_last_checked_at", { ascending: true, nullsFirst: true })
      .limit(40);
    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let done = 0, failed = 0, still = 0;
    const now = new Date();
    for (const ad of pending) {
      const ageMin = (now.getTime() - new Date(ad.created_at).getTime()) / 60000;
      if (ageMin > MAX_PROCESSING_MINUTES) {
        await sb.from("generated_ads").update({
          status: "video_failed", video_status: "failed",
          video_last_checked_at: now.toISOString(),
        }).eq("id", ad.id);
        failed++;
        continue;
      }
      if (!ad.video_task_id) {
        await sb.from("generated_ads").update({ video_last_checked_at: now.toISOString() }).eq("id", ad.id);
        still++;
        continue;
      }
      try {
        const { status, videoUrl } = await pollKieTask(ad.video_task_id);
        if (videoUrl && (status === "completed" || status === "success" || status === "succeeded")) {
          await sb.from("generated_ads").update({
            status: "completed", video_status: "completed",
            video_progress: 100, generated_video_url: videoUrl,
            completed_at: now.toISOString(), video_last_checked_at: now.toISOString(),
            ad_copy: { ...(ad.ad_copy as any ?? {}), pipelineStage: "done" },
          }).eq("id", ad.id);
          await sb.rpc("consume_credit", { _user_id: ad.user_id, _amount: 3 });
          done++;
        } else if (status === "failed" || status === "error") {
          await sb.from("generated_ads").update({
            status: "video_failed", video_status: "failed",
            video_last_checked_at: now.toISOString(),
          }).eq("id", ad.id);
          failed++;
        } else {
          await sb.from("generated_ads").update({ video_last_checked_at: now.toISOString() }).eq("id", ad.id);
          still++;
        }
      } catch (e) {
        console.error("poll error for", ad.id, (e as Error).message);
        await sb.from("generated_ads").update({ video_last_checked_at: now.toISOString() }).eq("id", ad.id);
        still++;
      }
    }
    return new Response(JSON.stringify({ success: true, done, failed, still, processed: pending.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[poll-lyric-video-status] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
