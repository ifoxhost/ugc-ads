import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireSecrets, jsonError } from "../_shared/startup-checks.ts";
import {
  getKieModel,
  submitKieClip,
  pollKieTask,
  klingDuration,
  seedanceDuration,
} from "../_shared/pipeline.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let env: Record<string, string>;
    try {
      env = requireSecrets([
        "SUPABASE_URL",
        "SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "KIE_AI_API_KEY",
      ]);
    } catch (e) { return jsonError(e, corsHeaders); }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No auth" }, 401);
    const userClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { sceneId } = await req.json().catch(() => ({}));
    if (!sceneId || typeof sceneId !== "string") {
      return json({ error: "sceneId required" }, 400);
    }

    const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: scene } = await sb.from("video_scenes")
      .select("id, ad_id, user_id, index, image_url, image_status, prompt, start_sec, end_sec")
      .eq("id", sceneId).maybeSingle();
    if (!scene) return json({ error: "Scene not found" }, 404);
    if (scene.user_id !== user.id) return json({ error: "Forbidden" }, 403);
    if (!scene.image_url || scene.image_status !== "ready") {
      return json({ error: "Scene image not ready — regenerate the image first." }, 400);
    }

    const { data: ad } = await sb.from("generated_ads")
      .select("id, aspect_ratio, ad_copy")
      .eq("id", scene.ad_id).maybeSingle();
    if (!ad) return json({ error: "Ad not found" }, 404);

    const adCopy = (ad.ad_copy ?? {}) as Record<string, unknown>;
    const rawModel = String(adCopy.aiModel ?? "seedance").toLowerCase();
    const modelKey =
      rawModel.includes("seedance")
        ? (rawModel === "seedance-pro" || rawModel === "bytedance/seedance-2" ? "seedance-pro" : "seedance")
      : rawModel.startsWith("veo") ? "veo"
      : rawModel.startsWith("kling") ? "kling"
      : "seedance";
    const kieModel = getKieModel(modelKey)!;
    const aspect = ad.aspect_ratio ?? "9:16";
    const songTitle = String(adCopy.title ?? "Lyric video");
    const sceneDur = Math.max(1, Number(scene.end_sec) - Number(scene.start_sec));
    const clipDur = kieModel.kind === "seedance"
      ? seedanceDuration(sceneDur)
      : Number(klingDuration(sceneDur));

    const promptText = [
      `"${songTitle}" — scene ${(scene.index ?? 0) + 1}.`,
      (scene.prompt as any)?.story,
      (scene.prompt as any)?.camera,
      (scene.prompt as any)?.vfx,
    ].filter(Boolean).join(" ");

    // Look up the per-scene Suno slice if the original render computed one.
    const slices = Array.isArray((adCopy as any).sceneAudioSlices)
      ? ((adCopy as any).sceneAudioSlices as Array<{ sceneId: string; url: string }>)
      : [];
    const refAudio = slices.find((s) => s.sceneId === scene.id)?.url;

    let taskId: string;
    try {
      taskId = await submitKieClip({
        kind: kieModel.kind,
        endpoint: kieModel.endpoint,
        modelId: kieModel.id,
        clip: {
          sceneId: scene.id,
          index: scene.index,
          imageUrl: scene.image_url,
          prompt: promptText,
          durationSec: clipDur,
          aspectRatio: aspect,
          referenceAudioUrl: refAudio,
          resolution: "720p",
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const lower = msg.toLowerCase();
      if (lower.includes("credits insufficient") || lower.includes("insufficient") || lower.includes("top up")) {
        console.error("[regenerate-scene-video] Kie.ai provider out of credits:", msg);
        return json({
          error: "Video provider (Kie.ai) is temporarily out of credits. Our team has been notified — please try again shortly.",
          providerError: true,
          code: "PROVIDER_CREDITS_EXHAUSTED",
        }, 503);
      }
      throw e;
    }

    // Poll up to ~5 minutes. Edge functions can run longer; we cap politely.
    const startedAt = Date.now();
    const TIMEOUT_MS = 5 * 60 * 1000;
    let videoUrl: string | undefined;
    let lastStatus = "pending";
    while (Date.now() - startedAt < TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, 4000));
      try {
        const r = await pollKieTask(taskId);
        lastStatus = r.status;
        if (r.status === "completed" && r.videoUrl) { videoUrl = r.videoUrl; break; }
        if (r.status === "failed") {
          return json({ error: "Kie reported the clip as failed", taskId }, 502);
        }
      } catch (e) {
        console.warn("[regenerate-scene-video] poll error:", (e as Error).message);
      }
    }

    if (!videoUrl) {
      return json({ error: "Timed out waiting for clip", taskId, status: lastStatus }, 504);
    }

    return json({ success: true, videoUrl, taskId });
  } catch (e) {
    console.error("[regenerate-scene-video] error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
