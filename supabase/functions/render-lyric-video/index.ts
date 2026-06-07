import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireSecrets, jsonError } from "../_shared/startup-checks.ts";
import { getKieModel, submitKieClip, klingDuration, seedanceDuration } from "../_shared/pipeline.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    let env: Record<string, string>;
    try {
      env = requireSecrets(["SUPABASE_URL","SUPABASE_ANON_KEY","SUPABASE_SERVICE_ROLE_KEY","KIE_AI_API_KEY"]);
    } catch (e) { return jsonError(e, corsHeaders); }

    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({error:"No auth"}),{status:401,headers:{...corsHeaders,"Content-Type":"application/json"}});
    const userClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { global:{headers:{Authorization:auth}}});
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:{...corsHeaders,"Content-Type":"application/json"}});

    const { adId } = await req.json();
    if (!adId) return new Response(JSON.stringify({error:"adId required"}),{status:400,headers:{...corsHeaders,"Content-Type":"application/json"}});

    const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: ad } = await sb.from("generated_ads")
      .select("id, user_id, aspect_ratio, ad_copy")
      .eq("id", adId).maybeSingle();
    if (!ad || ad.user_id !== user.id) {
      return new Response(JSON.stringify({error:"Not found"}),{status:404,headers:{...corsHeaders,"Content-Type":"application/json"}});
    }

    const { data: scenes } = await sb.from("video_scenes")
      .select("id, index, image_url, image_status, prompt, start_sec, end_sec")
      .eq("ad_id", adId).order("index", { ascending: true });
    if (!scenes || scenes.length === 0) {
      return new Response(JSON.stringify({error:"No scenes"}),{status:400,headers:{...corsHeaders,"Content-Type":"application/json"}});
    }
    if (scenes.some((s) => s.image_status !== "ready" || !s.image_url)) {
      return new Response(JSON.stringify({error:"Storyboard not complete"}),{status:400,headers:{...corsHeaders,"Content-Type":"application/json"}});
    }

    const adCopy = (ad.ad_copy ?? {}) as Record<string, unknown>;
    // Resolve model key: aiModel may be a short key ("seedance"|"kling"|"veo")
    // or a full Kie id ("bytedance/seedance-2-fast"|"kling-2.6"|"veo-3.1").
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
    const audioUrl = (adCopy.audioFileUrl ?? null) as string | null;
    const totalDuration = Number(adCopy.duration ?? 60);

    // Submit one Kie clip per scene. Each clip is silent — the user's imported
    // song is muxed in by stitch-lyric-video after all clips finish.
    const kieTasks: Array<{ sceneId: string; index: number; taskId: string; durationSec: number }> = [];
    const failures: Array<{ sceneId: string; error: string }> = [];

    for (const s of scenes) {
      const sceneDur = Math.max(1, Number(s.end_sec) - Number(s.start_sec));
      const clipDur = kieModel.kind === "seedance"
        ? seedanceDuration(sceneDur)
        : Number(klingDuration(sceneDur)); // Kling/Veo: 5 or 10
      const promptText = [
        `"${songTitle}" — scene ${s.index + 1}/${scenes.length}.`,
        (s.prompt as any)?.story,
        (s.prompt as any)?.camera,
        (s.prompt as any)?.vfx,
      ].filter(Boolean).join(" ");
      try {
        const taskId = await submitKieClip({
          kind: kieModel.kind,
          endpoint: kieModel.endpoint,
          modelId: kieModel.id,
          clip: {
            sceneId: s.id,
            index: s.index,
            imageUrl: s.image_url!,
            prompt: promptText,
            durationSec: clipDur,
            aspectRatio: aspect,
          },
        });
        kieTasks.push({ sceneId: s.id, index: s.index, taskId, durationSec: clipDur });
      } catch (e) {
        failures.push({ sceneId: s.id, error: (e as Error).message });
      }
    }

    if (kieTasks.length === 0) {
      return new Response(JSON.stringify({ error: "All Kie submissions failed", failures }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const renderPlan = {
      audioUrl,
      totalDurationSec: totalDuration,
      aspectRatio: aspect,
      scenes: kieTasks.map((k) => ({ sceneId: k.sceneId, index: k.index, durationSec: k.durationSec })),
    };

    await sb.from("generated_ads").update({
      // Keep video_task_id pointing at the first clip for backwards compat;
      // the source-of-truth is ad_copy.kieTasks.
      video_task_id: kieTasks[0].taskId,
      video_status: "processing",
      video_progress: 60,
      ad_copy: {
        ...adCopy,
        pipelineStage: "rendering",
        kieTasks,
        kieSubmitFailures: failures,
        renderPlan,
      },
    }).eq("id", adId);

    return new Response(JSON.stringify({
      success: true,
      submitted: kieTasks.length,
      failed: failures.length,
      taskIds: kieTasks.map((k) => k.taskId),
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[render-lyric-video] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
