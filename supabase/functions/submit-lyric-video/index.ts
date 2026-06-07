import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireSecrets, jsonError } from "../_shared/startup-checks.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Aspect ratio → output dimensions for Kie.ai video models ────────────────
const RATIO_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "1:1":  { width: 1080, height: 1080 },
  "16:9": { width: 1920, height: 1080 },
  "4:5":  { width: 1080, height: 1350 },
};

// ── Kie.ai video model registry ─────────────────────────────────────────────
// Per project decision: ALL video rendering goes through Kie.ai
// (Shotstack has been removed). Suno = audio source, Pexels = b-roll only,
// OpenAI = prompt enrichment.
const KIE_MODELS: Record<string, { id: string; endpoint: string; label: string }> = {
  kling: {
    id: "kling-3.0",
    endpoint: "https://api.kie.ai/v1/kling/generate",
    label: "Kling 3.0",
  },
  veo: {
    id: "veo-3.1",
    endpoint: "https://api.kie.ai/v1/veo/generate",
    label: "Google Veo 3.1",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Fail fast if any required secret is missing — returns 503 with clear error.
    let env: Record<string, string>;
    try {
      env = requireSecrets([
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_ANON_KEY",
        "N8N_WEBHOOK_URL",
        "N8N_WEBHOOK_SECRET",
        "KIE_AI_API_KEY",
      ]);
    } catch (e) {
      return jsonError(e, corsHeaders);
    }
    const supabaseUrl        = env.SUPABASE_URL;
    const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey    = env.SUPABASE_ANON_KEY;
    const n8nWebhookUrl      = env.N8N_WEBHOOK_URL;
    const n8nWebhookSecret   = env.N8N_WEBHOOK_SECRET;
    const kieApiKey          = env.KIE_AI_API_KEY;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      songTitle      = "",
      artist         = "",
      lyrics         = "",
      template       = "kinetic",
      aspectRatio    = "9:16",
      fontTheme      = "bold",
      colorPalette   = "dark",
      variationCount = 1,
      pexelsBackgroundUrl       = null,
      pexelsBackgroundThumbnail = null,
      referenceImageUrl         = null,
      referenceImageName        = null,
      aiModel       = "kling",
      aiImageModel  = "nano-banana",
      resolution    = "1080p",
      audioFileUrl  = null,
      storyboard    = null,
      duration      = 60,
    } = await req.json();

    if (!songTitle && !lyrics) {
      return new Response(JSON.stringify({ error: "Song title or lyrics is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Enforce Nano Banana as the only allowed image engine ─────────────────
    const normalizedImage = String(aiImageModel).toLowerCase().trim();
    if (normalizedImage !== "nano-banana" && normalizedImage !== "nano-banana-pro") {
      return new Response(
        JSON.stringify({
          error: `Image engine "${aiImageModel}" is not allowed. Only Nano Banana is supported.`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Enforce Kie.ai video model whitelist ─────────────────────────────────
    const kieModel = KIE_MODELS[aiModel as keyof typeof KIE_MODELS];
    if (!kieModel) {
      return new Response(
        JSON.stringify({
          error: `Video model "${aiModel}" is not supported. Allowed: ${Object.keys(KIE_MODELS).join(", ")} (Kie.ai)`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: subscription, error: subError } = await serviceClient
      .from("subscriptions")
      .select("id, credits, credits_used, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (subError || !subscription) {
      return new Response(JSON.stringify({ error: "No active subscription" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const creditsRemaining = (subscription.credits || 0) - (subscription.credits_used || 0);
    const creditsNeeded    = variationCount * 3;

    if (creditsRemaining < creditsNeeded) {
      return new Response(JSON.stringify({ error: "Insufficient credits" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email   = user.email || "";
    const dims    = RATIO_DIMENSIONS[aspectRatio] ?? RATIO_DIMENSIONS["9:16"];
    const adRecords: string[] = [];

    // Callback URL — n8n / Kie.ai will POST the final video URL here
    const callbackUrl = `${supabaseUrl}/functions/v1/ugc-webhook-callback`;

    for (let i = 0; i < variationCount; i++) {
      const { data: adRecord, error: insertError } = await serviceClient
        .from("generated_ads")
        .insert({
          user_id:           user.id,
          email,
          style_template:    template,
          aspect_ratio:      aspectRatio,
          product_image_url: referenceImageUrl ?? "https://placehold.co/1080x1920/0a0a0a/ffffff?text=Lyric+Video",
          status:            "processing",
          video_status:      "queued",
          video_progress:    5,
          ad_copy: {
            title:        songTitle,
            artist,
            lyricsPreview: lyrics.slice(0, 200),
            fontTheme,
            colorPalette,
            pexelsBackgroundUrl:       pexelsBackgroundUrl ?? undefined,
            pexelsBackgroundThumbnail: pexelsBackgroundThumbnail ?? undefined,
            referenceImageUrl:         referenceImageUrl ?? undefined,
            referenceImageName:        referenceImageName ?? undefined,
            aiModel:                   kieModel.id,
            aiImageModel:              "nano-banana",
            resolution,
            renderProvider:            "kie.ai",
          },
          prompt_used: `BeatFrame lyric video: "${songTitle}" by ${artist || "Unknown"} | Template: ${template} | Font: ${fontTheme} | Ratio: ${aspectRatio} | Video: ${kieModel.id} (Kie.ai) | Image: nano-banana | Res: ${resolution}`,
        })
        .select("id")
        .single();

      if (insertError || !adRecord) {
        console.error("Insert error:", insertError);
        continue;
      }

      adRecords.push(adRecord.id);

      // ── Build the Kie.ai job payload (Kling 3.0 / Veo 3.1) ─────────────────
      const kiePayload = {
        provider: "kie.ai",
        model:    kieModel.id,
        endpoint: kieModel.endpoint,
        params: {
          prompt: lyrics || songTitle,
          songTitle,
          artist,
          aspectRatio,
          width:      dims.width,
          height:     dims.height,
          fps:        30,
          duration,
          resolution,
          // Storyboard frames generated upstream by Nano Banana
          storyboard: storyboard ?? null,
          // Audio track from Suno (or uploaded)
          audioUrl:   audioFileUrl ?? null,
          // Reference image for character consistency
          referenceImageUrl: referenceImageUrl ?? null,
          // Optional Pexels b-roll for backgrounds
          pexelsBackgroundUrl: pexelsBackgroundUrl ?? null,
          template,
          fontTheme,
          colorPalette,
          imageEngine: "nano-banana",
        },
      };

      if (n8nWebhookUrl) {
        try {
          const n8nPayload = {
            jobType:      "lyric_video",
            renderEngine: "kie.ai",
            adId:         adRecord.id,
            userId:       user.id,
            email,
            callbackUrl,
            // Kie.ai job spec — n8n submits to Kie.ai, polls, and POSTs the URL back
            kiePayload,
            metadata: {
              songTitle,
              artist,
              template,
              fontTheme,
              colorPalette,
              aspectRatio,
              videoModel:  kieModel.id,
              imageEngine: "nano-banana",
              resolution,
            },
          };

          const n8nHeaders: Record<string, string> = { "Content-Type": "application/json" };
          if (n8nWebhookSecret) n8nHeaders["x-webhook-secret"] = n8nWebhookSecret;
          if (kieApiKey)        n8nHeaders["x-kie-api-key"]    = kieApiKey;

          console.log(`[submit-lyric-video] Routing adId=${adRecord.id} → n8n → Kie.ai (${kieModel.id})`);

          const n8nRes = await fetch(n8nWebhookUrl, {
            method: "POST",
            headers: n8nHeaders,
            body: JSON.stringify(n8nPayload),
          });

          const n8nResponseText = await n8nRes.text();
          console.log(`[submit-lyric-video] n8n response status: ${n8nRes.status}`);

          if (n8nRes.ok) {
            await serviceClient
              .from("generated_ads")
              .update({ video_status: "queued", video_progress: 10 })
              .eq("id", adRecord.id);
          } else {
            console.error(`[submit-lyric-video] n8n rejected (${n8nRes.status}): ${n8nResponseText}`);
            await serviceClient
              .from("generated_ads")
              .update({ status: "video_failed", video_status: "failed" })
              .eq("id", adRecord.id);
          }
        } catch (n8nErr) {
          console.error("[submit-lyric-video] n8n submission error:", n8nErr);
          await serviceClient
            .from("generated_ads")
            .update({ status: "video_failed", video_status: "failed" })
            .eq("id", adRecord.id);
        }
      } else {
        console.warn("[submit-lyric-video] No N8N_WEBHOOK_URL — placeholder completed state for local dev");
        await serviceClient
          .from("generated_ads")
          .update({
            status:         "completed",
            video_status:   "idle",
            video_progress: 100,
            completed_at:   new Date().toISOString(),
          })
          .eq("id", adRecord.id);
      }
    }

    if (adRecords.length > 0) {
      await serviceClient.rpc("consume_credit", {
        _user_id: user.id,
        _amount:  adRecords.length * 3,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        adIds:   adRecords,
        renderEngine: "kie.ai",
        videoModel:   kieModel.id,
        imageEngine:  "nano-banana",
        message: `${adRecords.length} lyric video${adRecords.length > 1 ? "s" : ""} queued via Kie.ai (${kieModel.label})`,
        n8nEnabled: !!n8nWebhookUrl,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[submit-lyric-video] error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
