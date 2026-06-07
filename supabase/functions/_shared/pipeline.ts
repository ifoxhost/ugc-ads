// Lyric Video Pipeline orchestrator — direct (no n8n).
// Stages: script (OpenAI gpt-4o) → transcribe (ElevenLabs/Kie → Whisper fallback)
//         → storyboard (Nano Banana via Lovable AI Gateway) → ready_to_render.
// Final render is triggered separately by render-lyric-video.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type PipelineStage =
  | "script"
  | "transcribe"
  | "storyboard"
  | "ready_to_render"
  | "rendering"
  | "done"
  | "failed";

interface SceneSpec {
  index: number;
  lyric_lines: string[];
  start_sec: number;
  end_sec: number;
  prompt: {
    story: string;
    camera: string;
    environment: string;
    colorGrading: string;
    vfx: string;
  };
}

const MAX_SCENES = 12;
const MIN_SCENES = 4;
// Kling clamps clip length to 5s or 10s. Target ~8s per scene so a 4-min song
// produces ~30 clips — but we cap at MAX_SCENES and let stitching loop/extend
// the last clip to fill any remaining audio.
const TARGET_SECONDS_PER_SCENE = 8;
export function planSceneCount(durationSec: number): number {
  const n = Math.ceil((durationSec || 60) / TARGET_SECONDS_PER_SCENE);
  return Math.max(MIN_SCENES, Math.min(MAX_SCENES, n));
}
const NANO_BANANA_CONCURRENCY = 3;
const OPENAI_API = "https://api.openai.com/v1";
const LOVABLE_AI_API = "https://ai.gateway.lovable.dev/v1";
const KIE_AI_API = "https://api.kie.ai";

function service(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function patchAd(adId: string, patch: Record<string, unknown>, copyPatch?: Record<string, unknown>) {
  const sb = service();
  if (copyPatch) {
    const { data: row } = await sb.from("generated_ads").select("ad_copy").eq("id", adId).maybeSingle();
    const merged = { ...(row?.ad_copy as Record<string, unknown> ?? {}), ...copyPatch };
    await sb.from("generated_ads").update({ ...patch, ad_copy: merged }).eq("id", adId);
  } else {
    await sb.from("generated_ads").update(patch).eq("id", adId);
  }
}

async function setStage(adId: string, stage: PipelineStage, progress?: number) {
  await patchAd(adId, progress != null ? { video_progress: progress } : {}, { pipelineStage: stage });
}

// ── Stage 1: Script (OpenAI gpt-4o) ─────────────────────────────────────────
async function runScript(adId: string, opts: {
  lyrics: string; songTitle: string; artist: string; duration: number;
  storyDescription?: string; cameraInstructions?: string;
  environmentInstructions?: string; colorGradingInstructions?: string;
  visualEffectsInstructions?: string; characterInstructions?: string;
  userId: string;
}): Promise<SceneSpec[]> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY missing");

  const targetScenes = planSceneCount(opts.duration);
  const system = `You are a music-video director. Given lyrics and direction, return a JSON shot list of EXACTLY ${targetScenes} scenes that together span the FULL ${opts.duration}s of the song. Each scene must have start_sec, end_sec, lyric_lines (array), and prompt {story, camera, environment, colorGrading, vfx}. Distribute timings evenly across the song. Respond ONLY with JSON: {"scenes":[...]}.`;
  const user = `Song: "${opts.songTitle}" by ${opts.artist || "Unknown"}
Total duration: ${opts.duration}s
Lyrics:
${opts.lyrics}

Direction:
- Story: ${opts.storyDescription || "—"}
- Camera: ${opts.cameraInstructions || "—"}
- Environment: ${opts.environmentInstructions || "—"}
- Color grading: ${opts.colorGradingInstructions || "—"}
- VFX: ${opts.visualEffectsInstructions || "—"}
- Character: ${opts.characterInstructions || "—"}`;

  const res = await fetch(`${OPENAI_API}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.7,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI script failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content);
  const raw = (parsed.scenes ?? []).slice(0, targetScenes);
  // Enforce evenly spaced timings spanning the full song duration so the
  // final stitched video always matches the imported audio length.
  const segLen = (opts.duration || 60) / Math.max(1, raw.length);
  const scenes: SceneSpec[] = raw.map((s: any, i: number) => ({
    index: i,
    lyric_lines: Array.isArray(s.lyric_lines) ? s.lyric_lines : [],
    start_sec: Math.round(i * segLen * 100) / 100,
    end_sec: Math.round((i + 1) * segLen * 100) / 100,
    prompt: {
      story: String(s.prompt?.story ?? ""),
      camera: String(s.prompt?.camera ?? ""),
      environment: String(s.prompt?.environment ?? ""),
      colorGrading: String(s.prompt?.colorGrading ?? ""),
      vfx: String(s.prompt?.vfx ?? ""),
    },
  }));
  if (scenes.length === 0) throw new Error("Script returned no scenes");

  const sb = service();
  await sb.from("video_scenes").insert(
    scenes.map((s) => ({
      ad_id: adId,
      user_id: opts.userId,
      index: s.index,
      lyric_lines: s.lyric_lines,
      start_sec: s.start_sec,
      end_sec: s.end_sec,
      prompt: s.prompt,
      image_status: "pending",
    })),
  );
  await patchAd(adId, { video_progress: 25 }, { script: { scenes } });
  return scenes;
}

// ── Stage 2: Transcription (ElevenLabs via Kie → Whisper fallback) ──────────
async function runTranscription(adId: string, audioUrl: string | null): Promise<unknown> {
  if (!audioUrl) {
    await patchAd(adId, { video_progress: 40 }, { transcription: null });
    return null;
  }

  // 2a: Try ElevenLabs via Kie.ai
  const kie = Deno.env.get("KIE_AI_API_KEY");
  const eleven = Deno.env.get("ELEVENLABS_API_KEY");
  if (kie) {
    try {
      const res = await fetch(`${KIE_AI_API}/audio/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${kie}` },
        body: JSON.stringify({ provider: "elevenlabs", audioUrl, model: "scribe_v1" }),
      });
      if (res.ok) {
        const data = await res.json();
        await patchAd(adId, { video_progress: 45 }, { transcription: { provider: "elevenlabs-kie", ...data } });
        return data;
      }
      console.warn("[pipeline] elevenlabs/kie failed, falling back:", res.status);
    } catch (e) {
      console.warn("[pipeline] elevenlabs/kie error, falling back:", (e as Error).message);
    }
  }

  // 2b: Direct ElevenLabs if available
  if (eleven) {
    try {
      const fileRes = await fetch(audioUrl);
      const blob = await fileRes.blob();
      const fd = new FormData();
      fd.append("file", blob, "audio.mp3");
      fd.append("model_id", "scribe_v1");
      const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        headers: { "xi-api-key": eleven },
        body: fd,
      });
      if (res.ok) {
        const data = await res.json();
        await patchAd(adId, { video_progress: 45 }, { transcription: { provider: "elevenlabs", ...data } });
        return data;
      }
    } catch (e) {
      console.warn("[pipeline] elevenlabs direct failed, falling back:", (e as Error).message);
    }
  }

  // 2c: OpenAI Whisper fallback
  const openai = Deno.env.get("OPENAI_API_KEY");
  if (openai) {
    try {
      const fileRes = await fetch(audioUrl);
      const blob = await fileRes.blob();
      const fd = new FormData();
      fd.append("file", blob, "audio.mp3");
      fd.append("model", "whisper-1");
      fd.append("response_format", "verbose_json");
      const res = await fetch(`${OPENAI_API}/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${openai}` },
        body: fd,
      });
      if (res.ok) {
        const data = await res.json();
        await patchAd(adId, { video_progress: 45 }, { transcription: { provider: "whisper", ...data } });
        return data;
      }
      console.error("[pipeline] whisper failed:", res.status, await res.text());
    } catch (e) {
      console.error("[pipeline] whisper error:", (e as Error).message);
    }
  }

  // No provider worked — proceed without timing
  await patchAd(adId, { video_progress: 45 }, { transcription: { error: "no_provider_succeeded" } });
  return null;
}

// ── Helper: persist external/temp reference images into our bucket ─────────
// Pexels/uploaded blob/temp URLs are mirrored into `video-references` so we
// keep permanent public URLs even if the source expires.
export async function persistReferenceImages(
  userId: string,
  adId: string,
  urls: string[],
): Promise<string[]> {
  const sb = service();
  const out: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < urls.length; i++) {
    const src = urls[i];
    if (!src || typeof src !== "string" || seen.has(src)) continue;
    seen.add(src);
    // If already in our own bucket, keep as-is.
    if (src.includes("/storage/v1/object/public/video-references/") ||
        src.includes("/storage/v1/object/public/generated-images/")) {
      out.push(src);
      continue;
    }
    try {
      const r = await fetch(src);
      if (!r.ok) { console.warn("[refs] fetch failed", src, r.status); continue; }
      const ct = r.headers.get("content-type") || "image/jpeg";
      const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
      const buf = new Uint8Array(await r.arrayBuffer());
      const path = `${userId}/${adId}/ref-${i}-${Date.now()}.${ext}`;
      const { error } = await sb.storage.from("video-references").upload(path, buf, {
        contentType: ct, upsert: true,
      });
      if (error) { console.warn("[refs] upload failed", error.message); continue; }
      const { data: pub } = sb.storage.from("video-references").getPublicUrl(path);
      out.push(pub.publicUrl);
    } catch (e) {
      console.warn("[refs] mirror error", (e as Error).message);
    }
  }
  return out;
}

// ── Stage 3: Storyboard (Nano Banana via Lovable AI Gateway) ───────────────
async function generateSceneImage(args: {
  sceneId: string;
  prompt: SceneSpec["prompt"];
  referenceImageUrls: string[];
  songTitle: string;
  userId: string;
}): Promise<{ url: string }> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) throw new Error("LOVABLE_API_KEY missing");

  const refs = (args.referenceImageUrls ?? []).filter(Boolean).slice(0, 4);
  const refNote = refs.length
    ? `\nUse the ${refs.length} attached reference image${refs.length > 1 ? "s" : ""} to steer subject, wardrobe, palette and overall look — preserve recognizable visual identity across all scenes.`
    : "";

  const composed = [
    `Cinematic music-video storyboard frame for "${args.songTitle}".`,
    `Story: ${args.prompt.story}`,
    `Camera: ${args.prompt.camera}`,
    `Environment: ${args.prompt.environment}`,
    `Color grading: ${args.prompt.colorGrading}`,
    `VFX: ${args.prompt.vfx}`,
    `Photorealistic, 16:9, rich depth of field, professional film stock.${refNote}`,
  ].join("\n");

  const userContent: any[] = [{ type: "text", text: composed }];
  for (const url of refs) {
    userContent.push({ type: "image_url", image_url: { url } });
  }

  const res = await fetch(`${LOVABLE_AI_API}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      modalities: ["image", "text"],
      messages: [{ role: "user", content: userContent }],
    }),
  });
  if (!res.ok) throw new Error(`Nano Banana failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const b64 =
    json?.choices?.[0]?.message?.images?.[0]?.image_url?.url?.replace(/^data:image\/\w+;base64,/, "") ??
    json?.choices?.[0]?.message?.content?.match(/data:image\/\w+;base64,([^"'\s)]+)/)?.[1];
  if (!b64) throw new Error("Nano Banana returned no image");

  // Upload to permanent storage — versioned filename to bust caches on regen.
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const sb = service();
  const path = `${args.userId}/${args.sceneId}-${Date.now()}.png`;
  const { error: upErr } = await sb.storage.from("generated-images").upload(path, bytes, {
    contentType: "image/png", upsert: true,
  });
  if (upErr) throw upErr;
  const { data: pub } = sb.storage.from("generated-images").getPublicUrl(path);
  return { url: pub.publicUrl };
}

// Resolve reference image URLs for an ad — combines persisted refs + pexels +
// fallback to product_image_url. Always returns permanent URLs.
function resolveAdReferences(adCopy: Record<string, unknown>, productImageUrl: string | null): string[] {
  const arr = Array.isArray(adCopy.referenceImages) ? (adCopy.referenceImages as string[]) : [];
  const out = [...arr];
  const pexels = adCopy.pexelsBackgroundUrl as string | undefined;
  const single = adCopy.referenceImageUrl as string | undefined;
  if (single && !out.includes(single)) out.push(single);
  if (pexels && !out.includes(pexels)) out.push(pexels);
  if (out.length === 0 && productImageUrl && !productImageUrl.includes("placehold.co")) {
    out.push(productImageUrl);
  }
  return out.filter(Boolean).slice(0, 4);
}

async function runStoryboard(adId: string, songTitle: string, referenceImageUrls: string[], userId: string) {
  const sb = service();
  const { data: scenes } = await sb
    .from("video_scenes")
    .select("id, prompt")
    .eq("ad_id", adId)
    .order("index", { ascending: true });
  if (!scenes || scenes.length === 0) throw new Error("No scenes to render");

  await sb.from("video_scenes").update({ image_status: "generating" }).eq("ad_id", adId);

  let cursor = 0;
  let done = 0;
  const total = scenes.length;
  const worker = async () => {
    while (true) {
      const i = cursor++;
      if (i >= total) return;
      const s = scenes[i];
      try {
        const { url } = await generateSceneImage({
          sceneId: s.id,
          prompt: s.prompt as SceneSpec["prompt"],
          referenceImageUrls,
          songTitle,
          userId,
        });
        await sb.from("video_scenes").update({ image_url: url, image_status: "ready" }).eq("id", s.id);
      } catch (e) {
        await sb.from("video_scenes").update({
          image_status: "failed",
          error_message: (e as Error).message.slice(0, 500),
          failed_step: "nano-banana",
        }).eq("id", s.id);
      } finally {
        done++;
        const pct = 45 + Math.round((done / total) * 45);
        await patchAd(adId, { video_progress: pct });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(NANO_BANANA_CONCURRENCY, total) }, worker));
}

// ── Orchestrator entrypoint ─────────────────────────────────────────────────
export interface OrchestrateOpts {
  adId: string;
  userId: string;
  songTitle: string;
  artist: string;
  lyrics: string;
  duration: number;
  audioUrl: string | null;
  referenceImageUrls: string[];
  storyDescription?: string;
  characterInstructions?: string;
  cameraInstructions?: string;
  environmentInstructions?: string;
  colorGradingInstructions?: string;
  visualEffectsInstructions?: string;
}

export async function orchestrateLyricVideo(opts: OrchestrateOpts): Promise<void> {
  const { adId } = opts;
  try {
    await setStage(adId, "script", 10);
    await runScript(adId, opts);

    await setStage(adId, "transcribe", 30);
    await runTranscription(adId, opts.audioUrl);

    await setStage(adId, "storyboard", 45);
    await runStoryboard(adId, opts.songTitle, opts.referenceImageUrls, opts.userId);

    await setStage(adId, "ready_to_render", 90);
    await patchAd(adId, { video_status: "queued" });
  } catch (e) {
    console.error("[orchestrateLyricVideo] failed:", (e as Error).message);
    await patchAd(adId, { status: "video_failed", video_status: "failed" }, {
      pipelineStage: "failed",
      pipelineError: (e as Error).message.slice(0, 1000),
    });
  }
}

// ── Re-roll a single scene ─────────────────────────────────────────────────
export async function regenerateScene(opts: { sceneId: string; userId: string }): Promise<{ url: string }> {
  const sb = service();
  const { data: scene, error } = await sb
    .from("video_scenes")
    .select("id, user_id, prompt, ad_id, regen_count")
    .eq("id", opts.sceneId).maybeSingle();
  if (error || !scene) throw new Error("Scene not found");
  if (scene.user_id !== opts.userId) throw new Error("Forbidden");

  const { data: ad } = await sb.from("generated_ads")
    .select("ad_copy, product_image_url").eq("id", scene.ad_id).maybeSingle();
  const adCopy = (ad?.ad_copy ?? {}) as Record<string, unknown>;
  const songTitle = String(adCopy.title ?? "Untitled");
  const referenceImageUrls = resolveAdReferences(adCopy, ad?.product_image_url ?? null);

  await sb.from("video_scenes").update({ image_status: "generating", error_message: null, failed_step: null }).eq("id", scene.id);
  try {
    const { url } = await generateSceneImage({
      sceneId: scene.id,
      prompt: scene.prompt as SceneSpec["prompt"],
      referenceImageUrls,
      songTitle,
      userId: opts.userId,
    });
    await sb.from("video_scenes").update({
      image_url: url, image_status: "ready", regen_count: (scene.regen_count ?? 0) + 1,
    }).eq("id", scene.id);
    return { url };
  } catch (e) {
    await sb.from("video_scenes").update({
      image_status: "failed",
      error_message: (e as Error).message.slice(0, 500),
      failed_step: "nano-banana",
    }).eq("id", scene.id);
    throw e;
  }
}

// ── Re-roll ALL scenes for an ad (same script + references) ────────────────
export async function regenerateAllScenes(opts: { adId: string; userId: string }): Promise<{ count: number }> {
  const sb = service();
  const { data: ad } = await sb.from("generated_ads")
    .select("id, user_id, ad_copy, product_image_url").eq("id", opts.adId).maybeSingle();
  if (!ad) throw new Error("Ad not found");
  if (ad.user_id !== opts.userId) throw new Error("Forbidden");

  const adCopy = (ad.ad_copy ?? {}) as Record<string, unknown>;
  const songTitle = String(adCopy.title ?? "Untitled");
  const referenceImageUrls = resolveAdReferences(adCopy, ad.product_image_url ?? null);

  // Reset all scenes to pending and bump regen_count.
  const { data: existing } = await sb.from("video_scenes")
    .select("id, regen_count").eq("ad_id", opts.adId);
  const count = existing?.length ?? 0;
  if (count === 0) throw new Error("No scenes to regenerate");

  await sb.from("video_scenes").update({
    image_status: "pending", error_message: null, image_url: null, failed_step: null,
  }).eq("ad_id", opts.adId);

  await patchAd(opts.adId, { video_progress: 45 }, { pipelineStage: "storyboard" });

  // Run in background so the request returns immediately.
  // @ts-ignore Deno
  EdgeRuntime.waitUntil((async () => {
    try {
      await runStoryboard(opts.adId, songTitle, referenceImageUrls, opts.userId);
      // bump regen counters
      for (const s of existing ?? []) {
        await sb.from("video_scenes").update({
          regen_count: (s.regen_count ?? 0) + 1,
        }).eq("id", s.id);
      }
      await patchAd(opts.adId, { video_progress: 90 }, { pipelineStage: "ready_to_render" });
    } catch (e) {
      console.error("[regenerateAllScenes] failed:", (e as Error).message);
    }
  })());

  return { count };
}

// ── Re-roll ONLY failed scenes for an ad ───────────────────────────────────
export async function regenerateFailedScenes(opts: { adId: string; userId: string }): Promise<{ count: number }> {
  const sb = service();
  const { data: ad } = await sb.from("generated_ads")
    .select("id, user_id, ad_copy, product_image_url").eq("id", opts.adId).maybeSingle();
  if (!ad) throw new Error("Ad not found");
  if (ad.user_id !== opts.userId) throw new Error("Forbidden");

  const adCopy = (ad.ad_copy ?? {}) as Record<string, unknown>;
  const songTitle = String(adCopy.title ?? "Untitled");
  const referenceImageUrls = resolveAdReferences(adCopy, ad.product_image_url ?? null);

  const { data: failed } = await sb.from("video_scenes")
    .select("id, prompt, regen_count")
    .eq("ad_id", opts.adId)
    .eq("image_status", "failed");
  const count = failed?.length ?? 0;
  if (count === 0) return { count: 0 };

  const failedIds = (failed ?? []).map((f: any) => f.id);
  await sb.from("video_scenes").update({
    image_status: "pending", error_message: null, failed_step: null,
  }).in("id", failedIds);

  // @ts-ignore Deno
  EdgeRuntime.waitUntil((async () => {
    for (const s of failed ?? []) {
      try {
        await sb.from("video_scenes").update({ image_status: "generating" }).eq("id", s.id);
        const { url } = await generateSceneImage({
          sceneId: s.id,
          prompt: s.prompt as SceneSpec["prompt"],
          referenceImageUrls,
          songTitle,
          userId: opts.userId,
        });
        await sb.from("video_scenes").update({
          image_url: url, image_status: "ready", regen_count: (s.regen_count ?? 0) + 1,
        }).eq("id", s.id);
      } catch (e) {
        await sb.from("video_scenes").update({
          image_status: "failed",
          error_message: (e as Error).message.slice(0, 500),
          failed_step: "nano-banana",
        }).eq("id", s.id);
      }
    }
  })());

  return { count };
}


// ── Kie.ai render submit + poll helpers (used by render & poll functions) ───
// Kie.ai uses three endpoint shapes:
//   - Market models (Kling, Seedance, Seedream, etc.) → POST /api/v1/jobs/createTask
//     with body { model, input } and are polled via /api/v1/jobs/recordInfo
//   - Veo has its own endpoint → POST /api/v1/veo/generate, polled at
//     /api/v1/veo/record-info (recordInfo also accepts veo taskIds).
//   - Seedance 2.0 (ByteDance) is a market model that natively accepts
//     reference images + audio and beat-matches motion. Per kie.ai spec
//     each clip is capped at ~15s of output and ~15s of reference audio,
//     so we still emit one clip per scene and stitch the full song over
//     them in stitch-lyric-video.
const KIE_MODELS: Record<string, { id: string; endpoint: string; kind: "market" | "veo" | "seedance" }> = {
  seedance: { id: "bytedance/seedance-2-fast", endpoint: `${KIE_AI_API}/api/v1/jobs/createTask`, kind: "seedance" },
  "seedance-pro": { id: "bytedance/seedance-2", endpoint: `${KIE_AI_API}/api/v1/jobs/createTask`, kind: "seedance" },
  kling: { id: "kling-2.6", endpoint: `${KIE_AI_API}/api/v1/jobs/createTask`, kind: "market" },
  veo:   { id: "veo-3.1",   endpoint: `${KIE_AI_API}/api/v1/veo/generate`,   kind: "veo"    },
};

export function getKieModel(key: string) {
  return KIE_MODELS[key] ?? null;
}

// Map our internal aspect ratios to Kie-supported ones.
function kieAspect(r: unknown): "16:9" | "9:16" | "1:1" {
  const s = String(r ?? "9:16");
  if (s === "16:9" || s === "9:16" || s === "1:1") return s;
  if (s === "4:5") return "9:16";
  return "9:16";
}

// Kling clamps duration to 5 or 10 seconds (string). Pick the closest.
export function klingDuration(sec: unknown): "5" | "10" {
  const n = Number(sec ?? 5);
  return n >= 8 ? "10" : "5";
}

// Seedance 2.0 accepts arbitrary integer seconds up to ~15s per clip.
export function seedanceDuration(sec: unknown): number {
  const n = Math.round(Number(sec ?? 8));
  if (!Number.isFinite(n) || n < 3) return 5;
  if (n > 15) return 15;
  return n;
}

export interface KieClipSpec {
  sceneId: string;
  index: number;
  imageUrl: string;
  prompt: string;
  durationSec: number; // 5 or 10 for Kling/Veo; up to 15 for Seedance
  aspectRatio: string;
  // Optional ≤15s audio slice for Seedance beat-matching. The full song is
  // still muxed over the final stitched video by stitch-lyric-video.
  referenceAudioUrl?: string;
}

/**
 * Strict validation for Seedance 2.0 `reference_audio_urls`:
 *   - kie.ai caps at 3 files per clip
 *   - each file must be ≤15 s
 *   - total length across files must also be ≤15 s
 * Throws a SeedanceAudioRefError with a structured `.details` array so the
 * caller can surface per-violation messages. Pass `urls` plus optional
 * `durationsSec` (when known); if a duration is unknown for a given URL we
 * skip the per-file / total-length checks for it.
 */
export class SeedanceAudioRefError extends Error {
  details: Array<{ index: number; url: string; reason: string }>;
  constructor(details: Array<{ index: number; url: string; reason: string }>) {
    super(`Seedance reference_audio_urls invalid: ${details.map((d) => d.reason).join("; ")}`);
    this.details = details;
    this.name = "SeedanceAudioRefError";
  }
}

export function validateSeedanceAudioRefs(
  urls: string[] | undefined,
  durationsSec?: number[],
): void {
  if (!urls || urls.length === 0) return; // optional field
  const errs: Array<{ index: number; url: string; reason: string }> = [];

  if (urls.length > 3) {
    errs.push({
      index: -1,
      url: "",
      reason: `Max 3 reference_audio_urls per Seedance clip (got ${urls.length})`,
    });
  }

  let total = 0;
  urls.forEach((u, i) => {
    if (typeof u !== "string" || !/^https?:\/\//i.test(u)) {
      errs.push({ index: i, url: String(u), reason: `Entry ${i} is not an http(s) URL` });
      return;
    }
    const d = durationsSec?.[i];
    if (typeof d === "number" && Number.isFinite(d)) {
      if (d > 15) {
        errs.push({ index: i, url: u, reason: `Entry ${i} duration ${d.toFixed(2)}s exceeds 15s cap` });
      }
      total += d;
    }
  });

  if (durationsSec && total > 15.05) {
    errs.push({
      index: -1,
      url: "",
      reason: `Sum of reference_audio_urls (${total.toFixed(2)}s) exceeds 15s cap`,
    });
  }

  if (errs.length > 0) throw new SeedanceAudioRefError(errs);
}


/**
 * Submit ONE Kie.ai clip per scene with `sound: false` (Kling) or
 * `generate_audio: false` (Seedance). The imported song is muxed back in
 * by `stitch-lyric-video` after every clip finishes. Returns the Kie task
 * id for polling.
 */
export async function submitKieClip(args: {
  kind: "market" | "veo" | "seedance";
  endpoint: string;
  modelId: string;
  clip: KieClipSpec;
}): Promise<string> {
  const key = Deno.env.get("KIE_AI_API_KEY");
  if (!key) throw new Error("KIE_AI_API_KEY missing");
  const aspect = kieAspect(args.clip.aspectRatio);

  let body: Record<string, unknown>;
  if (args.kind === "veo") {
    body = {
      prompt: args.clip.prompt,
      imageUrls: [args.clip.imageUrl],
      model: "veo3_fast",
      aspectRatio: aspect,
      enableFallback: true,
    };
  } else if (args.kind === "seedance") {
    const duration = seedanceDuration(args.clip.durationSec);
    const input: Record<string, unknown> = {
      prompt: args.clip.prompt,
      reference_image_urls: [args.clip.imageUrl],
      generate_audio: false, // stitch-lyric-video muxes the real song
      resolution: "1080p",
      aspect_ratio: aspect,
      duration,
    };
    // Pass the scene-aligned audio reference if provided. Kie caps total
    // reference audio at 15s, so callers must pre-slice longer songs.
    if (args.clip.referenceAudioUrl) {
      input.reference_audio_urls = [args.clip.referenceAudioUrl];
    }
    body = { model: args.modelId || "bytedance/seedance-2-fast", input };
  } else {
    const duration = klingDuration(args.clip.durationSec);
    const baseModel = (args.modelId || "kling-2.6").replace(/\/(image|text)-to-video$/, "");
    body = {
      model: `${baseModel}/image-to-video`,
      input: {
        prompt: args.clip.prompt,
        image_urls: [args.clip.imageUrl],
        sound: false, // imported song is muxed in by stitch-lyric-video
        duration,
      },
    };
  }

  const res = await fetch(args.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Kie.ai submit failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const d = data?.data ?? data;
  const taskId = d?.taskId ?? d?.task_id ?? d?.id ?? data?.taskId;
  if (!taskId) throw new Error(`Kie.ai returned no taskId: ${JSON.stringify(data).slice(0, 300)}`);
  return String(taskId);
}


export async function pollKieTask(taskId: string): Promise<{ status: string; videoUrl?: string }> {
  const key = Deno.env.get("KIE_AI_API_KEY");
  if (!key) throw new Error("KIE_AI_API_KEY missing");
  const res = await fetch(
    `${KIE_AI_API}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
    { headers: { Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) throw new Error(`Kie.ai poll failed: ${res.status}`);
  const json = await res.json();
  const d = json?.data ?? json;
  // recordInfo returns { state: "waiting|queuing|generating|success|fail", resultJson, ... }
  const rawState = String(d?.state ?? d?.status ?? "pending").toLowerCase();
  const status =
    rawState === "success" ? "completed" :
    rawState === "fail" ? "failed" :
    rawState;

  let videoUrl: string | undefined;
  const candidates = [d?.resultJson, d?.response, d?.result, d?.output];
  for (const c of candidates) {
    if (!c) continue;
    const parsed = typeof c === "string" ? safeJsonParse(c) : c;
    videoUrl ??=
      parsed?.videoUrl ??
      parsed?.video_url ??
      parsed?.resultUrls?.[0] ??
      parsed?.videos?.[0]?.url ??
      parsed?.videos?.[0] ??
      undefined;
  }
  return { status, videoUrl };
}

function safeJsonParse(s: string): any {
  try { return JSON.parse(s); } catch { return null; }
}
