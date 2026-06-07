import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireSecrets, jsonError } from "../_shared/startup-checks.ts";
import {
  getKieModel, submitKieClip, klingDuration, seedanceDuration,
  validateSeedanceAudioRefs, SeedanceAudioRefError,
} from "../_shared/pipeline.ts";
import { readCloudinaryEnv, uploadAudioByUrl, sliceUrl } from "../_shared/cloudinary.ts";

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

    const { data: scenesRaw } = await sb.from("video_scenes")
      .select("id, index, image_url, image_status, prompt, start_sec, end_sec, locked")
      .eq("ad_id", adId).order("index", { ascending: true });
    if (!scenesRaw || scenesRaw.length === 0) {
      return new Response(JSON.stringify({error:"No scenes"}),{status:400,headers:{...corsHeaders,"Content-Type":"application/json"}});
    }
    const scenes = scenesRaw.filter((s: any) => !s.locked);
    if (scenes.length === 0) {
      return new Response(JSON.stringify({error:"All scenes are locked"}),{status:400,headers:{...corsHeaders,"Content-Type":"application/json"}});
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

    // === Seedance audio slicing ===
    // For Seedance, we slice the imported Suno audio into ≤15s windows
    // aligned to each scene's start_sec via Cloudinary transform URLs and
    // pass them as reference_audio_urls. Strict per-clip validation is
    // enforced before any Kie submission so failures surface early.
    let sceneSlices: Record<string, { url: string; durationSec: number; startSec: number }> = {};
    const sceneSliceErrors: Array<{ sceneId: string; index: number; reason: string; durationSec: number }> = [];
    if (kieModel.kind === "seedance" && audioUrl) {
      const cld = readCloudinaryEnv();
      if (cld) {
        try {
          let uploaded = (adCopy as any).cloudinaryAudio as {
            publicId: string; durationSec: number; format: string;
          } | undefined;
          if (!uploaded?.publicId) {
            const up = await uploadAudioByUrl(cld, audioUrl, `lyricavid/${user.id}`);
            uploaded = { publicId: up.publicId, durationSec: up.durationSec, format: up.format };
          }
          const songLen = uploaded.durationSec || totalDuration;
          for (const s of scenes) {
            const dur = Math.min(15, Math.max(3, Math.round(Math.max(1, Number(s.end_sec) - Number(s.start_sec)))));
            const start = Math.max(0, Math.min(Number(s.start_sec) || 0, Math.max(0, songLen - dur)));
            const url = sliceUrl(cld, uploaded.publicId, start, dur, uploaded.format);
            // Validate this individual reference before we submit it.
            try {
              validateSeedanceAudioRefs([url], [dur]);
              sceneSlices[s.id] = { url, durationSec: dur, startSec: start };
            } catch (e) {
              if (e instanceof SeedanceAudioRefError) {
                console.warn(`[render] scene ${s.index} audio ref rejected:`, e.details);
                for (const d of e.details) {
                  sceneSliceErrors.push({ sceneId: s.id, index: s.index, reason: d.reason, durationSec: dur });
                }
              } else {
                const reason = (e as Error).message;
                console.warn(`[render] scene ${s.index} audio ref error:`, reason);
                sceneSliceErrors.push({ sceneId: s.id, index: s.index, reason, durationSec: dur });
              }
            }
          }
          // Cache uploaded metadata for retries / re-stitches.
          (adCopy as any).cloudinaryAudio = uploaded;
          (adCopy as any).sceneAudioSlices = Object.entries(sceneSlices).map(
            ([sceneId, v]) => ({ sceneId, ...v }),
          );
          (adCopy as any).sceneAudioSliceErrors = sceneSliceErrors;
          (adCopy as any).sceneAudioSlicesGeneratedAt = new Date().toISOString();
        } catch (e) {
          console.warn("[render] Cloudinary slicing failed, proceeding without reference audio:",
            (e as Error).message);
        }
      } else {
        console.warn("[render] CLOUDINARY_* secrets missing — Seedance will run without reference audio");
      }
    }

    // Submit one Kie clip per scene. Each clip is silent — the user's imported
    // song is muxed in by stitch-lyric-video after all clips finish.
    const kieTasks: Array<{ sceneId: string; index: number; taskId: string; durationSec: number; referenceAudioUrl?: string }> = [];
    const failures: Array<{ sceneId: string; error: string }> = [];

    // Seedance via Kie only supports 480p / 720p. We default to 720p because
    // 1080p (and resolution-less submits) return HTTP 422 / "Invalid resolution"
    // which forces a costly per-scene regeneration. Keep this constant.
    const seedanceResolution: "480p" | "720p" = "720p";

    // Validate audio before rendering — without it the stitcher can't mux the
    // song and we'd ship a silent video.
    if (!audioUrl) {
      await sb.from("generated_ads").update({
        ad_copy: { ...adCopy, pipelineStage: "ready_to_render", audioMissing: true },
      }).eq("id", adId);
      return new Response(JSON.stringify({
        error: "Missing audio track. Re-import your Suno link or upload an audio file before rendering.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const MAX_SUBMIT_ATTEMPTS = 2;
    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i];
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
      const refAudio = sceneSlices[s.id]?.url;

      let submitted = false;
      let lastErr = "";
      for (let attempt = 1; attempt <= MAX_SUBMIT_ATTEMPTS && !submitted; attempt++) {
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
              referenceAudioUrl: refAudio,
              resolution: seedanceResolution,
            },
          });
          kieTasks.push({ sceneId: s.id, index: s.index, taskId, durationSec: clipDur, referenceAudioUrl: refAudio });
          submitted = true;
        } catch (e) {
          lastErr = (e as Error).message;
          // Credit exhaustion will not heal on retry — bail out of the loop.
          if (/credits?\s*insufficient|insufficient\s*credit|top\s*up/i.test(lastErr)) break;
          if (attempt < MAX_SUBMIT_ATTEMPTS) {
            await new Promise((r) => setTimeout(r, 1000 * attempt));
          }
        }
      }
      if (!submitted) failures.push({ sceneId: s.id, error: lastErr || "unknown" });

      // Small inter-scene delay to avoid hammering Kie's submit endpoint.
      if (i < scenes.length - 1) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }


    // Detect upstream credit exhaustion — partial renders waste user credits
    // and produce a video that doesn't match the song, so abort cleanly.
    const creditFailure = failures.find((f) => /credits?\s*insufficient|insufficient\s*credit|top\s*up/i.test(f.error));
    if (creditFailure || (kieTasks.length > 0 && failures.length > 0 && kieTasks.length < scenes.length)) {
      await sb.from("generated_ads").update({
        status: "video_failed",
        video_status: "failed",
        video_progress: 0,
        ad_copy: { ...adCopy, pipelineStage: "render_failed", kieSubmitFailures: failures, kieTasks: [] },
      }).eq("id", adId);
      const msg = creditFailure
        ? "Video provider (Kie.ai) credits are exhausted. Please top up the KIE_AI account to continue rendering."
        : `Only ${kieTasks.length} of ${scenes.length} scenes could be submitted. Aborting to avoid a partial render.`;
      return new Response(JSON.stringify({ error: msg, failures }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (kieTasks.length === 0) {
      await sb.from("generated_ads").update({
        status: "video_failed", video_status: "failed", video_progress: 0,
        ad_copy: { ...adCopy, pipelineStage: "render_failed", kieSubmitFailures: failures },
      }).eq("id", adId);
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
