import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_PROCESSING_MINUTES = 15;

// Kie.ai pipeline is fully asynchronous: n8n / Kie.ai POST the final video URL
// to /functions/v1/ugc-webhook-callback. This poll job only enforces timeouts
// on stuck renders — Shotstack has been fully removed.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl        = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("=== LYRIC VIDEO POLL JOB (Kie.ai callback-only mode) ===");

    const { data: pendingAds, error: fetchError } = await supabase
      .from("generated_ads")
      .select("id, video_status, created_at, video_last_checked_at")
      .in("video_status", ["queued", "processing"])
      .like("prompt_used", "BeatFrame lyric video%")
      .order("video_last_checked_at", { ascending: true, nullsFirst: true })
      .limit(50);

    if (fetchError) throw fetchError;
    if (!pendingAds || pendingAds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No pending lyric videos", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let timedOut = 0;
    let stillProcessing = 0;
    const now = new Date();

    for (const ad of pendingAds) {
      const ageMin = (now.getTime() - new Date(ad.created_at).getTime()) / 1000 / 60;
      if (ageMin > MAX_PROCESSING_MINUTES) {
        await supabase
          .from("generated_ads")
          .update({
            status: "video_failed",
            video_status: "failed",
            video_last_checked_at: now.toISOString(),
          })
          .eq("id", ad.id);
        timedOut++;
      } else {
        await supabase
          .from("generated_ads")
          .update({ video_last_checked_at: now.toISOString() })
          .eq("id", ad.id);
        stillProcessing++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Polled ${pendingAds.length} ads`,
        timedOut,
        stillProcessing,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[poll-lyric-video-status] error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
