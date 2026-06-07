import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { pollKieTask } from "../_shared/pipeline.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_PROCESSING_MINUTES = 45;

interface KieTask {
  sceneId: string;
  index: number;
  taskId: string;
  durationSec: number;
  status?: string;
  videoUrl?: string;
}

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

    let done = 0, failed = 0, still = 0, stitched = 0;
    const now = new Date();

    for (const ad of pending) {
      const ageMin = (now.getTime() - new Date(ad.created_at).getTime()) / 60000;
      const overBudget = ageMin > MAX_PROCESSING_MINUTES;
      const adCopy = (ad.ad_copy ?? {}) as Record<string, any>;
      const kieTasks: KieTask[] = Array.isArray(adCopy.kieTasks) ? adCopy.kieTasks : [];

      if (overBudget && kieTasks.length === 0 && !ad.video_task_id) {
        await sb.from("generated_ads").update({
          status: "video_failed", video_status: "failed",
          video_last_checked_at: now.toISOString(),
        }).eq("id", ad.id);
        failed++;
        continue;
      }

      // Legacy / unsubmitted: nothing to poll yet.
      if (kieTasks.length === 0 && !ad.video_task_id) {
        await sb.from("generated_ads").update({ video_last_checked_at: now.toISOString() }).eq("id", ad.id);
        still++;
        continue;
      }

      // --- Multi-clip path: poll every Kie task, then stitch when all ready ---
      if (kieTasks.length > 0) {
        let anyFailed = false;
        let allDone = true;
        const updated: KieTask[] = [];
        for (const k of kieTasks) {
          if (k.status === "completed" && k.videoUrl) { updated.push(k); continue; }
          if (k.status === "failed") { updated.push(k); anyFailed = true; continue; }
          try {
            const r = await pollKieTask(k.taskId);
            if (r.videoUrl && (r.status === "completed" || r.status === "success")) {
              updated.push({ ...k, status: "completed", videoUrl: r.videoUrl });
            } else if (r.status === "failed" || r.status === "error") {
              updated.push({ ...k, status: "failed" });
              anyFailed = true;
              allDone = false;
            } else {
              updated.push({ ...k, status: r.status });
              allDone = false;
            }
          } catch (e) {
            console.error("[poll] kie task error", k.taskId, (e as Error).message);
            updated.push(k);
            allDone = false;
          }
        }

        const completedCount = updated.filter((u) => u.status === "completed").length;
        const progress = 60 + Math.round((completedCount / updated.length) * 25); // 60→85
        await sb.from("generated_ads").update({
          video_last_checked_at: now.toISOString(),
          video_progress: progress,
          ad_copy: { ...adCopy, kieTasks: updated },
        }).eq("id", ad.id);

        if (anyFailed) {
          await sb.from("generated_ads").update({
            status: "video_failed", video_status: "failed",
            ad_copy: { ...adCopy, kieTasks: updated, pipelineStage: "failed",
              pipelineError: "One or more Kie clips failed" },
          }).eq("id", ad.id);
          failed++;
          continue;
        }

        if (allDone) {
          // Trigger stitching (Shotstack + Suno audio mux). The stitcher
          // finalizes the ad row and consumes credits.
          try {
            const stitchRes = await fetch(
              `${Deno.env.get("SUPABASE_URL")}/functions/v1/stitch-lyric-video`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                },
                body: JSON.stringify({ adId: ad.id }),
              },
            );
            if (!stitchRes.ok) {
              console.error("[poll] stitch failed", ad.id, await stitchRes.text());
            } else {
              stitched++;
            }
          } catch (e) {
            console.error("[poll] stitch invoke error", ad.id, (e as Error).message);
          }
          continue;
        }

        still++;
        continue;
      }

      // --- Legacy single-task path (kept for in-flight pre-migration rows) ---
      try {
        const { status, videoUrl } = await pollKieTask(ad.video_task_id!);
        if (videoUrl && (status === "completed" || status === "success")) {
          await sb.from("generated_ads").update({
            status: "completed", video_status: "completed",
            video_progress: 100, generated_video_url: videoUrl,
            completed_at: now.toISOString(), video_last_checked_at: now.toISOString(),
            ad_copy: { ...adCopy, pipelineStage: "done" },
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

    return new Response(JSON.stringify({ success: true, done, failed, still, stitched, processed: pending.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[poll-lyric-video-status] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
