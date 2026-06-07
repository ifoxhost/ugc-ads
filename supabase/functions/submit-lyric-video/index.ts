import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getShotstackBaseUrl(): string {
  return "https://api.shotstack.io/edit/v1";
}

// ── Background clip library ──────────────────────────────────────────────────
const BG_CLIPS: Record<string, string> = {
  kinetic:   "https://templates.shotstack.io/basic/asset/video/rainbow-light-leak-loop.mp4",
  minimal:   "https://templates.shotstack.io/basic/asset/video/black-gradient-loop.mp4",
  neon:      "https://templates.shotstack.io/basic/asset/video/neon-glow-loop.mp4",
  cinematic: "https://templates.shotstack.io/basic/asset/video/bokeh-light-loop.mp4",
  waveform:  "https://templates.shotstack.io/basic/asset/video/audio-wave-loop.mp4",
  karaoke:   "https://templates.shotstack.io/basic/asset/video/stage-light-loop.mp4",
};

// ── Color palette → hex values ────────────────────────────────────────────────
const PALETTE_COLORS: Record<string, { text: string; highlight: string; bg: string }> = {
  dark:       { text: "#ffffff", highlight: "#a78bfa", bg: "rgba(0,0,0,0.55)" },
  neon:       { text: "#00ffcc", highlight: "#ff00ff", bg: "rgba(0,0,0,0.70)" },
  gold:       { text: "#ffd700", highlight: "#ff8c00", bg: "rgba(0,0,0,0.60)" },
  pastel:     { text: "#f9a8d4", highlight: "#a5f3fc", bg: "rgba(255,255,255,0.15)" },
  monochrome: { text: "#ffffff", highlight: "#888888", bg: "rgba(0,0,0,0.60)" },
};

// ── Font theme → Google Fonts TTF URL + CSS stack ────────────────────────────
interface FontDef {
  url: string;
  family: string;
  weight: string;
  style: string;
  extraCss: string;
}

const FONT_MAP: Record<string, FontDef> = {
  bold: {
    url: "https://fonts.gstatic.com/s/montserrat/v25/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Hw5aX8.ttf",
    family: "Montserrat",
    weight: "900",
    style: "normal",
    extraCss: "font-weight:900; letter-spacing:-0.02em; text-transform:uppercase;",
  },
  serif: {
    url: "https://fonts.gstatic.com/s/playfairdisplay/v36/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvUDQ.ttf",
    family: "PlayfairDisplay",
    weight: "700",
    style: "italic",
    extraCss: "font-weight:700; font-style:italic; letter-spacing:0.01em;",
  },
  "modern-sans": {
    url: "https://fonts.gstatic.com/s/raleway/v28/1Ptxg8zYS_SKggPN4iEgvnHyvveLxVvao4CP.ttf",
    family: "Raleway",
    weight: "300",
    style: "normal",
    extraCss: "font-weight:300; letter-spacing:0.18em; text-transform:uppercase;",
  },
  retro: {
    url: "https://fonts.gstatic.com/s/pressstart2p/v15/e3t4euO8T-267oIAQAu6jDQyK3nVivNm4I81.ttf",
    family: "PressStart2P",
    weight: "400",
    style: "normal",
    extraCss: "font-weight:400; letter-spacing:0.06em; font-size:44px;",
  },
  handwritten: {
    url: "https://fonts.gstatic.com/s/dancingscript/v24/If2cXTr6YS-zF4S-kcSWSVi_sxjsohD9F50Ruu7BMSo3ROp6.ttf",
    family: "DancingScript",
    weight: "700",
    style: "normal",
    extraCss: "font-weight:700; letter-spacing:0.03em;",
  },
};

// ── Aspect ratio → Shotstack output dimensions ────────────────────────────────
const RATIO_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "1:1":  { width: 1080, height: 1080 },
  "16:9": { width: 1920, height: 1080 },
};

// ── Build a Shotstack HTML asset string with @font-face injected ─────────────
function buildHtmlAsset(opts: {
  text: string;
  fontDef: FontDef;
  colors: { text: string; highlight: string; bg: string };
  width: number;
  height: number;
  isTitle?: boolean;
}): { type: "html"; html: string; css: string; width: number; height: number } {
  const { text, fontDef, colors, width, height, isTitle } = opts;

  const fontFaceDeclaration = `
@font-face {
  font-family: '${fontDef.family}';
  src: url('${fontDef.url}') format('truetype');
  font-weight: ${fontDef.weight};
  font-style: ${fontDef.style};
}`.trim();

  const htmlContent = isTitle
    ? `<div class="title-card"><p class="title">${text.replace(/\n/g, "<br/>")}</p></div>`
    : `<div class="lyric-card"><p class="lyric">${text.replace(/\n/g, "<br/>")}</p></div>`;

  const css = `
${fontFaceDeclaration}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  width: ${width}px;
  height: ${height}px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
}

.title-card, .lyric-card {
  width: 100%;
  padding: 40px 48px;
  background: ${colors.bg};
  backdrop-filter: blur(4px);
  border-radius: 16px;
  text-align: center;
}

.title {
  font-family: '${fontDef.family}', sans-serif;
  color: ${colors.highlight};
  font-size: 72px;
  line-height: 1.2;
  text-shadow: 0 0 40px ${colors.highlight}66, 0 4px 20px rgba(0,0,0,0.9);
  ${fontDef.extraCss}
}

.lyric {
  font-family: '${fontDef.family}', sans-serif;
  color: ${colors.text};
  font-size: 64px;
  line-height: 1.35;
  text-shadow: 0 2px 24px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6);
  ${fontDef.extraCss}
}
`.trim();

  return { type: "html", html: htmlContent, css, width, height };
}

// ── Build the full Shotstack timeline ────────────────────────────────────────
function buildTimeline(opts: {
  lyrics: string;
  template: string;
  fontTheme: string;
  colorPalette: string;
  aspectRatio: string;
  songTitle: string;
  artist: string;
  pexelsBackgroundUrl?: string | null;
}) {
  const { lyrics, template, fontTheme, colorPalette, aspectRatio, songTitle, artist, pexelsBackgroundUrl } = opts;

  const bgSrc = pexelsBackgroundUrl ?? BG_CLIPS[template] ?? BG_CLIPS.kinetic;
  const bgIsPhoto = bgSrc && !bgSrc.includes(".mp4") && !bgSrc.includes("video");
  const colors  = PALETTE_COLORS[colorPalette] ?? PALETTE_COLORS.dark;
  const fontDef = FONT_MAP[fontTheme] ?? FONT_MAP.bold;
  const dims    = RATIO_DIMENSIONS[aspectRatio] ?? RATIO_DIMENSIONS["9:16"];

  const lines = lyrics.split("\n").map(l => l.trim()).filter(Boolean);
  const slides: string[] = [];
  for (let i = 0; i < lines.length; i += 2) {
    slides.push(lines.slice(i, i + 2).join("\n"));
  }
  if (slides.length === 0) slides.push(songTitle || "♪");

  const slideDuration = 3;
  const introDuration = 2;
  const totalDuration = introDuration + slides.length * slideDuration;

  const clips: unknown[] = [];

  if (bgIsPhoto) {
    clips.push({
      asset: { type: "image", src: bgSrc },
      start: 0,
      length: totalDuration,
      fit: "cover",
      effect: "zoomIn",
    });
  } else {
    clips.push({
      asset: { type: "video", src: bgSrc, volume: 0 },
      start: 0,
      length: totalDuration,
      fit: "cover",
    });
  }

  const titleText = artist ? `${songTitle}\n${artist}` : (songTitle || "BeatFrame");
  const titleAsset = buildHtmlAsset({
    text: titleText,
    fontDef,
    colors,
    width: dims.width,
    height: Math.round(dims.height * 0.4),
    isTitle: true,
  });

  clips.push({
    asset: titleAsset,
    start: 0,
    length: introDuration,
    position: "center",
    transition: { in: "fade", out: "fade" },
  });

  slides.forEach((slideText, idx) => {
    const start = introDuration + idx * slideDuration;
    const lyricAsset = buildHtmlAsset({
      text: slideText,
      fontDef,
      colors,
      width: dims.width,
      height: Math.round(dims.height * 0.5),
      isTitle: false,
    });

    clips.push({
      asset: lyricAsset,
      start,
      length: slideDuration,
      position: "center",
      transition: { in: "slideUp", out: "fade" },
    });
  });

  const output: Record<string, unknown> = {
    format: "mp4",
    fps: 25,
    size: {
      width: dims.width,
      height: dims.height,
    },
  };

  return {
    timeline: {
      background: "#000000",
      tracks: [{ clips }],
    },
    output,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl        = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey    = Deno.env.get("SUPABASE_ANON_KEY")!;
    const n8nWebhookUrl      = Deno.env.get("N8N_WEBHOOK_URL");
    const n8nWebhookSecret   = Deno.env.get("N8N_WEBHOOK_SECRET");

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
      songTitle     = "",
      artist        = "",
      lyrics        = "",
      template      = "kinetic",
      aspectRatio   = "9:16",
      fontTheme     = "bold",
      colorPalette  = "dark",
      variationCount = 1,
      pexelsBackgroundUrl = null,
      pexelsBackgroundThumbnail = null,
      referenceImageUrl = null,
      referenceImageName = null,
      aiModel = "kling",
      resolution = "1080p",
    } = await req.json();

    if (!songTitle && !lyrics) {
      return new Response(JSON.stringify({ error: "Song title or lyrics is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    const email      = user.email || "";
    const adRecords: string[] = [];

    // Build the Shotstack timeline payload once (shared across variations)
    const timelinePayload = buildTimeline({
      lyrics, template, fontTheme, colorPalette, aspectRatio, songTitle, artist, pexelsBackgroundUrl,
    });

    // Callback URL — n8n will POST the result here when rendering completes
    const callbackUrl = `${supabaseUrl}/functions/v1/ugc-webhook-callback`;

    for (let i = 0; i < variationCount; i++) {
      const { data: adRecord, error: insertError } = await serviceClient
        .from("generated_ads")
        .insert({
          user_id:           user.id,
          email,
          style_template:    template,
          aspect_ratio:      aspectRatio,
          product_image_url: "https://placehold.co/1080x1920/0a0a0a/ffffff?text=Lyric+Video",
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
            aiModel:                   aiModel ?? undefined,
            resolution:                resolution ?? undefined,
          },
          prompt_used: `BeatFrame lyric video: "${songTitle}" by ${artist || "Unknown"} | Template: ${template} | Font: ${fontTheme} | Ratio: ${aspectRatio} | Model: ${aiModel} | Res: ${resolution}`,
        })
        .select("id")
        .single();

      if (insertError || !adRecord) {
        console.error("Insert error:", insertError);
        continue;
      }

      adRecords.push(adRecord.id);

      if (n8nWebhookUrl) {
        try {
          // ── Route through n8n instead of calling Shotstack directly ──────────
          const n8nPayload = {
            jobType:     "lyric_video",
            adId:        adRecord.id,
            userId:      user.id,
            email,
            callbackUrl,
            // Shotstack-ready timeline — n8n submits this to Shotstack and polls
            shotstackPayload: timelinePayload,
            // Metadata for logging / OpenAI enrichment in n8n
            metadata: {
              songTitle,
              artist,
              template,
              fontTheme,
              colorPalette,
              aspectRatio,
              pexelsBackgroundUrl:       pexelsBackgroundUrl ?? undefined,
              pexelsBackgroundThumbnail: pexelsBackgroundThumbnail ?? undefined,
              referenceImageUrl:         referenceImageUrl ?? undefined,
              referenceImageName:        referenceImageName ?? undefined,
              aiModel:                   aiModel ?? undefined,
              resolution:                resolution ?? undefined,
            },
          };

          const n8nHeaders: Record<string, string> = {
            "Content-Type": "application/json",
          };
          if (n8nWebhookSecret) {
            n8nHeaders["x-webhook-secret"] = n8nWebhookSecret;
          }

          console.log(`[submit-lyric-video] Routing adId=${adRecord.id} to n8n: ${n8nWebhookUrl}`);
          console.log("[submit-lyric-video] n8n payload:", JSON.stringify({
            jobType: n8nPayload.jobType,
            adId: n8nPayload.adId,
            userId: n8nPayload.userId,
            callbackUrl: n8nPayload.callbackUrl,
            shotstackOutputFormat: timelinePayload.output,
          }));

          const n8nRes = await fetch(n8nWebhookUrl, {
            method: "POST",
            headers: n8nHeaders,
            body: JSON.stringify(n8nPayload),
          });

          const n8nResponseText = await n8nRes.text();
          console.log(`[submit-lyric-video] n8n response status: ${n8nRes.status}`);
          console.log(`[submit-lyric-video] n8n response body: ${n8nResponseText}`);

          if (n8nRes.ok) {
            // Update DB to reflect n8n accepted the job
            await serviceClient
              .from("generated_ads")
              .update({ video_status: "queued", video_progress: 10 })
              .eq("id", adRecord.id);
            console.log(`[submit-lyric-video] n8n accepted job for adId=${adRecord.id}`);
          } else {
            console.error(`[submit-lyric-video] n8n rejected job (${n8nRes.status}): ${n8nResponseText}`);
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
        // No n8n URL configured — use placeholder completed state for local dev
        console.warn("[submit-lyric-video] No N8N_WEBHOOK_URL — using placeholder completed state");
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
        message: `${adRecords.length} lyric video${adRecords.length > 1 ? "s" : ""} queued via n8n`,
        n8nEnabled: !!n8nWebhookUrl,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[submit-lyric-video] error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
