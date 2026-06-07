import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireSecrets, jsonError } from "../_shared/startup-checks.ts";
import { orchestrateLyricVideo, getKieModel, persistReferenceImages } from "../_shared/pipeline.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let env: Record<string, string>;
    try {
      env = requireSecrets([
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_ANON_KEY",
        "OPENAI_API_KEY",
        "LOVABLE_API_KEY",
        "KIE_AI_API_KEY",
      ]);
    } catch (e) { return jsonError(e, corsHeaders); }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const {
      songTitle = "", artist = "", lyrics = "",
      template = "kinetic", aspectRatio = "9:16",
      fontTheme = "bold", colorPalette = "dark",
      variationCount = 1,
      pexelsBackgroundUrl = null, pexelsBackgroundThumbnail = null,
      pexelsBackgroundUrls = null, // optional array of selected pexels stills/videos
      referenceImageUrl = null, referenceImageName = null,
      referenceImageUrls = null,   // optional array of uploaded ref image URLs
      aiModel = "kling", aiImageModel = "nano-banana",
      resolution = "1080p",
      audioFileUrl = null, audioUrl = null,
      duration = 60,
      storyDescription, characterInstructions, cameraInstructions,
      environmentInstructions, colorGradingInstructions, visualEffectsInstructions,
    } = body;

    if (!songTitle && !lyrics) {
      return new Response(JSON.stringify({ error: "Song title or lyrics is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Enforce Nano Banana
    if (String(aiImageModel).toLowerCase().trim() !== "nano-banana") {
      return new Response(JSON.stringify({
        error: `Image engine "${aiImageModel}" is not allowed. Only Nano Banana is supported.`,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const kieModel = getKieModel(aiModel);
    if (!kieModel) {
      return new Response(JSON.stringify({
        error: `Video model "${aiModel}" is not supported. Allowed: kling, veo (Kie.ai)`,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    // Credit check (3 credits per variation; storyboard generation only consumes after render success)
    const { data: subscription } = await sb.from("subscriptions")
      .select("id, credits, credits_used, status")
      .eq("user_id", user.id).eq("status", "active").maybeSingle();
    if (!subscription) {
      return new Response(JSON.stringify({ error: "No active subscription" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const remaining = (subscription.credits || 0) - (subscription.credits_used || 0);
    if (remaining < variationCount * 3) {
      return new Response(JSON.stringify({ error: "Insufficient credits" }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adIds: string[] = [];
    for (let i = 0; i < variationCount; i++) {
      const { data: row, error: insErr } = await sb.from("generated_ads").insert({
        user_id: user.id,
        email: user.email || "",
        style_template: template,
        aspect_ratio: aspectRatio,
        product_image_url: referenceImageUrl ?? "https://placehold.co/1080x1920/0a0a0a/ffffff?text=Lyric+Video",
        status: "processing",
        video_status: "queued",
        video_progress: 5,
        ad_copy: {
          title: songTitle, artist, lyricsPreview: lyrics.slice(0, 200),
          fontTheme, colorPalette,
          pexelsBackgroundUrl: pexelsBackgroundUrl ?? undefined,
          pexelsBackgroundThumbnail: pexelsBackgroundThumbnail ?? undefined,
          referenceImageUrl: referenceImageUrl ?? undefined,
          referenceImageName: referenceImageName ?? undefined,
          audioFileUrl: audioFileUrl ?? undefined,
          aiModel: kieModel.id, aiImageModel: "nano-banana",
          resolution, renderProvider: "kie.ai",
          pipelineStage: "script",
          duration,
        },
        prompt_used: `BeatFrame lyric video: "${songTitle}" by ${artist || "Unknown"} | ${template} | ${aspectRatio} | ${kieModel.id} | nano-banana`,
      }).select("id").single();
      if (insErr || !row) { console.error("insert error", insErr); continue; }
      adIds.push(row.id);

      // Run pipeline in background — submit returns immediately.
      // @ts-ignore Deno-specific
      EdgeRuntime.waitUntil(orchestrateLyricVideo({
        adId: row.id,
        userId: user.id,
        songTitle, artist, lyrics,
        duration: Number(duration) || 60,
        audioUrl: audioFileUrl ?? audioUrl ?? null,
        referenceImageUrl,
        storyDescription, characterInstructions, cameraInstructions,
        environmentInstructions, colorGradingInstructions, visualEffectsInstructions,
      }));
    }

    return new Response(JSON.stringify({
      success: true,
      adIds,
      pipeline: "direct",
      message: `${adIds.length} lyric video${adIds.length > 1 ? "s" : ""} queued — generating storyboard.`,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[submit-lyric-video] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
