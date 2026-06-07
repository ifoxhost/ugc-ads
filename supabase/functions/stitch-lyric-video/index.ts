// Stitches per-scene Kie.ai clips together and muxes the user's imported song
// as the audio track. Uses Shotstack's Edit API. Invoked by
// poll-lyric-video-status when every clip is ready, OR directly by a user
// retry. Service-role only — JWT verification is disabled in config.toml.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SHOTSTACK_OWN = "https://api.shotstack.io/edit/stage"; // works for stage/prod
const SHOTSTACK_PROD = "https://api.shotstack.io/edit/v1";

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

  const sbUrl = Deno.env.get("SUPABASE_URL")!;
  const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const shotstackKey = Deno.env.get("SHOTSTACK_API_KEY");
  const sb = createClient(sbUrl, sbKey);

  try {
    const { adId } = await req.json();
    if (!adId) {
      return json({ error: "adId required" }, 400);
    }

    const { data: ad } = await sb.from("generated_ads")
      .select("id, user_id, aspect_ratio, ad_copy")
      .eq("id", adId).maybeSingle();
    if (!ad) return json({ error: "Ad not found" }, 404);

    const adCopy = (ad.ad_copy ?? {}) as Record<string, any>;
    const kieTasks: KieTask[] = Array.isArray(adCopy.kieTasks) ? adCopy.kieTasks : [];
    const renderPlan = (adCopy.renderPlan ?? {}) as Record<string, any>;
    const audioUrl = renderPlan.audioUrl ?? adCopy.audioFileUrl ?? null;
    const totalDuration = Number(renderPlan.totalDurationSec ?? adCopy.duration ?? 60);

    const ready = kieTasks.filter((k) => k.status === "completed" && k.videoUrl)
      .sort((a, b) => a.index - b.index);
    if (ready.length === 0) {
      return json({ error: "No completed clips to stitch" }, 400);
    }

    await sb.from("generated_ads").update({
      video_progress: 90,
      ad_copy: { ...adCopy, pipelineStage: "stitching" },
    }).eq("id", adId);

    // --- Build the Shotstack timeline ---
    // Concatenate clips in order; loop/extend the last clip to cover the full
    // song duration so video length always matches the imported audio.
    let cursor = 0;
    const clips = ready.map((c) => {
      const clip = {
        asset: { type: "video", src: c.videoUrl! },
        start: cursor,
        length: c.durationSec,
        fit: "cover",
      };
      cursor += c.durationSec;
      return clip;
    });
    // Pad: if total clip length < song length, stretch the last clip.
    if (audioUrl && cursor < totalDuration) {
      const last = clips[clips.length - 1];
      last.length = (last.length as number) + (totalDuration - cursor);
      cursor = totalDuration;
    }

    const tracks: Array<{ clips: any[] }> = [{ clips }];

    if (audioUrl) {
      tracks.push({
        clips: [{
          asset: { type: "audio", src: audioUrl },
          start: 0,
          length: totalDuration,
        }],
      });
    }

    const aspect = (ad.aspect_ratio ?? "9:16") as string;
    const resolution = adCopy.resolution === "4k" ? "4k"
      : adCopy.resolution === "720p" ? "sd"
      : "hd";

    const payload = {
      timeline: { background: "#000000", tracks },
      output: {
        format: "mp4",
        resolution,
        aspectRatio: aspect === "16:9" ? "16:9" : aspect === "1:1" ? "1:1" : "9:16",
        fps: 30,
      },
    };

    if (!shotstackKey) {
      // Fallback: no Shotstack — just publish the first clip with the original
      // audio inline (the URL is the clip; user gets motion + audio mismatch
      // length but at least no AI-generated song).
      const firstUrl = ready[0].videoUrl!;
      await finalize(sb, ad.id, ad.user_id, firstUrl, adCopy, "shotstack_missing");
      return json({ success: true, fallback: "first_clip", videoUrl: firstUrl });
    }

    // Try prod endpoint first, then stage.
    let renderId: string | null = null;
    let usedBase = SHOTSTACK_PROD;
    for (const base of [SHOTSTACK_PROD, SHOTSTACK_OWN]) {
      const res = await fetch(`${base}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": shotstackKey },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const j = await res.json();
        renderId = j?.response?.id ?? j?.id ?? null;
        usedBase = base;
        break;
      }
      console.warn("[stitch] shotstack submit failed", base, res.status, await res.text());
    }

    if (!renderId) {
      // Fall back to first clip so user still gets *something* and we don't
      // burn the credit on a stuck pipeline.
      const firstUrl = ready[0].videoUrl!;
      await finalize(sb, ad.id, ad.user_id, firstUrl, adCopy, "shotstack_submit_failed");
      return json({ success: true, fallback: "first_clip", videoUrl: firstUrl });
    }

    // Poll Shotstack until done (cap ~3 min total).
    let finalUrl: string | null = null;
    for (let i = 0; i < 36; i++) {
      await sleep(5000);
      const r = await fetch(`${usedBase}/render/${renderId}`, {
        headers: { "x-api-key": shotstackKey },
      });
      if (!r.ok) continue;
      const j = await r.json();
      const status = j?.response?.status ?? j?.status;
      if (status === "done") {
        finalUrl = j?.response?.url ?? j?.url ?? null;
        break;
      }
      if (status === "failed") {
        console.error("[stitch] shotstack render failed", j);
        break;
      }
    }

    if (!finalUrl) {
      const firstUrl = ready[0].videoUrl!;
      await finalize(sb, ad.id, ad.user_id, firstUrl, adCopy, "shotstack_timeout");
      return json({ success: true, fallback: "first_clip", videoUrl: firstUrl });
    }

    await finalize(sb, ad.id, ad.user_id, finalUrl, adCopy, "shotstack");
    return json({ success: true, videoUrl: finalUrl, renderId });
  } catch (e) {
    console.error("[stitch-lyric-video] error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function finalize(
  sb: any,
  adId: string,
  userId: string,
  videoUrl: string,
  adCopy: Record<string, any>,
  via: string,
) {
  await sb.from("generated_ads").update({
    status: "completed",
    video_status: "completed",
    video_progress: 100,
    generated_video_url: videoUrl,
    completed_at: new Date().toISOString(),
    ad_copy: { ...adCopy, pipelineStage: "done", stitchedBy: via },
  }).eq("id", adId);
  try {
    await sb.rpc("consume_credit", { _user_id: userId, _amount: 3 });
  } catch (e) {
    console.warn("[stitch] consume_credit error", (e as Error).message);
  }
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
