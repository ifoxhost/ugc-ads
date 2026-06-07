// Slice the imported Suno audio into ≤15s windows aligned to each scene's
// start_sec, then store the per-scene reference URLs in
// `generated_ads.ad_copy.sceneAudioSlices`. Designed for Seedance 2.0's
// reference_audio_urls input (which caps each clip at 15 s).
//
// The actual audio is uploaded once to Cloudinary; per-scene slice URLs are
// virtual transform URLs (so_X,du_Y) — no extra rendering required.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  readCloudinaryEnv,
  uploadAudioByUrl,
  sliceUrl,
  type UploadedAudio,
} from "../_shared/cloudinary.ts";
import {
  validateSeedanceAudioRefs,
  SeedanceAudioRefError,
  validateJobSeedanceAudioRefs,
} from "../_shared/pipeline.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_SLICE_SEC = 15;

interface SceneSlice {
  sceneId: string;
  index: number;
  startSec: number;
  durationSec: number;
  url: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  let failedAdId: string | undefined;
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const cld = readCloudinaryEnv();
    if (!cld) return json({ error: "Cloudinary not configured" }, 500);

    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "No auth" }, 401);
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { adId, force = false } = await req.json().catch(() => ({}));
    if (!adId) return json({ error: "adId required" }, 400);
    failedAdId = adId;

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: ad } = await sb.from("generated_ads")
      .select("id, user_id, ad_copy").eq("id", adId).maybeSingle();
    if (!ad || ad.user_id !== user.id) return json({ error: "Not found" }, 404);

    const adCopy = (ad.ad_copy ?? {}) as Record<string, any>;
    const audioUrl: string | undefined = adCopy.audioFileUrl;
    if (!audioUrl) return json({ error: "No audioFileUrl on this ad" }, 400);

    // Real-time progress: write a tiny `sliceStatus` object to ad_copy on
    // each phase so the Library UI (which subscribes to row updates) can
    // surface queued → uploading → slicing → validating → done/failed.
    const writeStatus = async (
      phase: "queued" | "uploading" | "slicing" | "validating" | "done" | "failed",
      extra: Record<string, unknown> = {},
    ) => {
      const { data: row } = await sb
        .from("generated_ads").select("ad_copy").eq("id", adId).maybeSingle();
      const cur = (row?.ad_copy ?? {}) as Record<string, any>;
      await sb.from("generated_ads").update({
        ad_copy: {
          ...cur,
          sliceStatus: { phase, at: new Date().toISOString(), ...extra },
        },
      }).eq("id", adId);
    };

    await writeStatus("queued");

    // 1) Upload audio to Cloudinary once. Cached on ad_copy for retries.
    let uploaded: UploadedAudio | null = adCopy.cloudinaryAudio ?? null;
    if (!uploaded || force) {
      await writeStatus("uploading");
      uploaded = await uploadAudioByUrl(cld, audioUrl, `lyricavid/${user.id}`);
    }

    // 2) Pull scenes, derive ≤15s windows aligned to start_sec.
    await writeStatus("slicing");
    const { data: scenes } = await sb.from("video_scenes")
      .select("id, index, start_sec, end_sec")
      .eq("ad_id", adId).order("index", { ascending: true });
    if (!scenes || scenes.length === 0) {
      await writeStatus("failed", { error: "No scenes" });
      return json({ error: "No scenes" }, 400);
    }

    const totalDuration = uploaded.durationSec || Number(adCopy.duration) || 0;
    const slices: SceneSlice[] = scenes.map((s: any) => {
      const sceneLen = Math.max(1, Number(s.end_sec) - Number(s.start_sec));
      const dur = Math.min(MAX_SLICE_SEC, Math.round(sceneLen));
      const maxStart = Math.max(0, (totalDuration || 0) - dur);
      const start = Math.max(0, Math.min(Number(s.start_sec) || 0, maxStart));
      return {
        sceneId: s.id,
        index: s.index,
        startSec: start,
        durationSec: dur,
        url: sliceUrl(cld, uploaded!.publicId, start, dur, uploaded!.format),
      };
    });

    // 2b) Validate each slice against Seedance limits (max 3 / 15s).
    await writeStatus("validating", { sliceCount: slices.length });
    const sliceErrors: Array<{ sceneId: string; index: number; reason: string; durationSec: number }> = [];
    for (const sl of slices) {
      try {
        validateSeedanceAudioRefs([sl.url], [sl.durationSec]);
      } catch (e) {
        if (e instanceof SeedanceAudioRefError) {
          for (const d of e.details) {
            sliceErrors.push({
              sceneId: sl.sceneId,
              index: sl.index,
              reason: d.reason,
              durationSec: sl.durationSec,
            });
          }
        } else {
          sliceErrors.push({
            sceneId: sl.sceneId,
            index: sl.index,
            reason: (e as Error).message,
            durationSec: sl.durationSec,
          });
        }
      }
    }

    // 2c) Job-level validator (max 3 files / 15s total per job).
    const jobValidation = validateJobSeedanceAudioRefs(slices);

    // 3) Persist slices + cached Cloudinary metadata + validation summary.
    const { data: latest } = await sb
      .from("generated_ads").select("ad_copy").eq("id", adId).maybeSingle();
    const merged = (latest?.ad_copy ?? {}) as Record<string, any>;
    const newCopy = {
      ...merged,
      cloudinaryAudio: uploaded,
      sceneAudioSlices: slices,
      sceneAudioSliceErrors: sliceErrors,
      sceneAudioJobValidation: jobValidation,
      sceneAudioSlicesGeneratedAt: new Date().toISOString(),
      sliceStatus: {
        phase: "done",
        at: new Date().toISOString(),
        sliceCount: slices.length,
        errorCount: sliceErrors.length,
        jobValid: jobValidation.valid,
      },
    };
    const { error: upErr } = await sb.from("generated_ads")
      .update({ ad_copy: newCopy }).eq("id", adId);
    if (upErr) throw upErr;

    return json({
      success: true,
      count: slices.length,
      errorCount: sliceErrors.length,
      cloudinaryPublicId: uploaded.publicId,
      sourceDurationSec: uploaded.durationSec,
      slices,
      errors: sliceErrors,
      jobValidation,
    });

  } catch (e) {
    console.error("[slice-suno-audio] error:", e);
    if (failedAdId) {
      try {
        const sb2 = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        const { data: row } = await sb2
          .from("generated_ads").select("ad_copy").eq("id", failedAdId).maybeSingle();
        const cur = (row?.ad_copy ?? {}) as Record<string, any>;
        await sb2.from("generated_ads").update({
          ad_copy: {
            ...cur,
            sliceStatus: {
              phase: "failed",
              at: new Date().toISOString(),
              error: e instanceof Error ? e.message : "Unknown",
            },
          },
        }).eq("id", failedAdId);
      } catch (_) { /* ignore */ }
    }
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
