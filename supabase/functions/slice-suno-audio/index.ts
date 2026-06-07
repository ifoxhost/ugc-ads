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

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: ad } = await sb.from("generated_ads")
      .select("id, user_id, ad_copy").eq("id", adId).maybeSingle();
    if (!ad || ad.user_id !== user.id) return json({ error: "Not found" }, 404);

    const adCopy = (ad.ad_copy ?? {}) as Record<string, any>;
    const audioUrl: string | undefined = adCopy.audioFileUrl;
    if (!audioUrl) return json({ error: "No audioFileUrl on this ad" }, 400);

    // 1) Upload audio to Cloudinary once. Cached on ad_copy for retries.
    let uploaded: UploadedAudio | null = adCopy.cloudinaryAudio ?? null;
    if (!uploaded || force) {
      uploaded = await uploadAudioByUrl(cld, audioUrl, `lyricavid/${user.id}`);
    }

    // 2) Pull scenes, derive ≤15s windows aligned to start_sec.
    const { data: scenes } = await sb.from("video_scenes")
      .select("id, index, start_sec, end_sec")
      .eq("ad_id", adId).order("index", { ascending: true });
    if (!scenes || scenes.length === 0) return json({ error: "No scenes" }, 400);

    const totalDuration = uploaded.durationSec || Number(adCopy.duration) || 0;
    const slices: SceneSlice[] = scenes.map((s: any) => {
      const sceneLen = Math.max(1, Number(s.end_sec) - Number(s.start_sec));
      const dur = Math.min(MAX_SLICE_SEC, Math.round(sceneLen));
      // Clamp the window so we never seek past the end of the song.
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

    // 3) Persist slices + cached Cloudinary metadata.
    const newCopy = {
      ...adCopy,
      cloudinaryAudio: uploaded,
      sceneAudioSlices: slices,
      sceneAudioSlicesGeneratedAt: new Date().toISOString(),
    };
    const { error: upErr } = await sb.from("generated_ads")
      .update({ ad_copy: newCopy }).eq("id", adId);
    if (upErr) throw upErr;

    return json({
      success: true,
      count: slices.length,
      cloudinaryPublicId: uploaded.publicId,
      sourceDurationSec: uploaded.durationSec,
      slices,
    });
  } catch (e) {
    console.error("[slice-suno-audio] error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
