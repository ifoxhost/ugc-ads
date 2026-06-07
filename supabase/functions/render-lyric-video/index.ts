import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireSecrets, jsonError } from "../_shared/startup-checks.ts";
import { getKieModel, submitKieRender } from "../_shared/pipeline.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RATIO: Record<string, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "1:1":  { width: 1080, height: 1080 },
  "16:9": { width: 1920, height: 1080 },
  "4:5":  { width: 1080, height: 1350 },
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
    const modelKey = String(adCopy.aiModel ?? "kling-3.0").startsWith("veo") ? "veo" : "kling";
    const kieModel = getKieModel(modelKey)!;
    const dims = RATIO[ad.aspect_ratio ?? "9:16"] ?? RATIO["9:16"];

    const storyboard = scenes.map((s) => ({
      index: s.index, startSec: s.start_sec, endSec: s.end_sec, imageUrl: s.image_url,
    }));

    const taskId = await submitKieRender(adId, {
      endpoint: kieModel.endpoint,
      kind: kieModel.kind,
      modelId: kieModel.id,
      params: {
        prompt: String(adCopy.title ?? "Lyric video"),
        audioUrl: adCopy.audioFileUrl ?? null,
        referenceImageUrl: adCopy.referenceImageUrl ?? null,
        pexelsBackgroundUrl: adCopy.pexelsBackgroundUrl ?? null,
        storyboard,
        aspectRatio: ad.aspect_ratio,
        width: dims.width, height: dims.height,
        fps: 30,
        duration: Number(adCopy.duration ?? 60),
        resolution: adCopy.resolution ?? "1080p",
      },
    });

    await sb.from("generated_ads").update({
      ad_copy: { ...adCopy, pipelineStage: "rendering" },
    }).eq("id", adId);

    return new Response(JSON.stringify({ success: true, taskId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[render-lyric-video] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
