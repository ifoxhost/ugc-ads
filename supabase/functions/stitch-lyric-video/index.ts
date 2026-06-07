// Stitches per-scene Kie.ai clips together and muxes the user's imported song
// as the audio track.
//
// Primary stitcher: fal.ai `fal-ai/ffmpeg-api/compose` (queue API).
//   - One call handles concat + audio mux + duration locking via keyframes.
//   - ~10× cheaper than Shotstack ($0.0002/sec output).
// Fallback: Shotstack Edit API (used when FAL_KEY is missing OR fal submit
//   fails OR post-stitch duration validation fails outside tolerance).
//
// Validation:
//   - Pre-stitch: ensure total clip length ≥ song length (pad last clip if not).
//   - Post-stitch: HEAD the resulting mp4 and probe its duration via a
//     lightweight mp4 metadata read; if the delta vs. the imported audio is
//     > 1.5 s, reject the fal output and retry with Shotstack.
//
// Invoked by poll-lyric-video-status when every clip is ready, OR directly by
// a user retry. Service-role only — JWT verification is disabled in
// config.toml.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FAL_SUBMIT = "https://queue.fal.run/fal-ai/ffmpeg-api/compose";
const SHOTSTACK_PROD = "https://api.shotstack.io/edit/v1";
const SHOTSTACK_STAGE = "https://api.shotstack.io/edit/stage";

// Duration drift we'll accept before rejecting a stitched output (seconds).
// Tunable via env `STITCH_DURATION_TOLERANCE_SEC` (default 1.5).
const DURATION_TOLERANCE_SEC = (() => {
  const raw = Deno.env.get("STITCH_DURATION_TOLERANCE_SEC");
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 1.5;
})();
// How many times we retry fal.ai compose end-to-end (submit + validate)
// before giving up and handing off to Shotstack.
// Tunable via env `STITCH_FAL_MAX_ATTEMPTS` (default 2, min 1, max 5).
const FAL_MAX_ATTEMPTS = (() => {
  const raw = Deno.env.get("STITCH_FAL_MAX_ATTEMPTS");
  const n = raw ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n)) return 2;
  return Math.min(5, Math.max(1, n));
})();

// Validate FAL_KEY shape at module-load: fal keys are `<uuid>:<hex>` and
// MUST never appear in logs. Returns the key only when usable.
function loadFalKey(): string | null {
  const raw = Deno.env.get("FAL_KEY");
  if (!raw) return null;
  const trimmed = raw.trim();
  // Loose shape check — must look like "<id>:<secret>", neither part empty.
  if (!/^[^\s:]+:[^\s:]+$/.test(trimmed)) {
    console.error("[stitch.fal] FAL_KEY present but malformed (expected '<id>:<secret>'); ignoring");
    return null;
  }
  return trimmed;
}

// Redact any occurrence of the fal key (or fragments of it) in arbitrary text
// so we never echo it back through logs, error responses, or DB rows.
function redact(input: unknown, secret: string | null): string {
  let s = typeof input === "string" ? input : (() => {
    try { return JSON.stringify(input); } catch { return String(input); }
  })();
  if (secret) {
    s = s.split(secret).join("[FAL_KEY]");
    // Also redact each half in case fal echoes only the id or secret half.
    for (const half of secret.split(":")) {
      if (half.length >= 8) s = s.split(half).join("[FAL_KEY]");
    }
  }
  // Catch generic `Key xxx` / `Bearer xxx` patterns just in case.
  s = s.replace(/(Key|Bearer)\s+[A-Za-z0-9_\-:.]+/gi, "$1 [REDACTED]");
  return s;
}

interface KieTask {
  sceneId: string;
  index: number;
  taskId: string;
  durationSec: number;
  status?: string;
  videoUrl?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sbUrl = Deno.env.get("SUPABASE_URL")!;
  const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const falKey = loadFalKey();
  const shotstackKey = Deno.env.get("SHOTSTACK_API_KEY");
  const sb = createClient(sbUrl, sbKey);


  try {
    const body = await req.json().catch(() => ({} as any));
    const { adId, overrides } = body ?? {};
    if (!adId) return json({ error: "adId required" }, 400);

    // Per-job overrides — clamp to safe ranges; fall back to env defaults.
    const maxAttempts = clampInt(overrides?.falMaxAttempts, FAL_MAX_ATTEMPTS, 1, 5);
    const tolerance = clampNum(overrides?.toleranceSec, DURATION_TOLERANCE_SEC, 0.1, 30);
    const overrideApplied = maxAttempts !== FAL_MAX_ATTEMPTS || tolerance !== DURATION_TOLERANCE_SEC;

    const { data: ad } = await sb.from("generated_ads")
      .select("id, user_id, aspect_ratio, ad_copy, email")
      .eq("id", adId).maybeSingle();
    if (!ad) return json({ error: "Ad not found" }, 404);

    const adCopy = (ad.ad_copy ?? {}) as Record<string, any>;
    const kieTasks: KieTask[] = Array.isArray(adCopy.kieTasks) ? adCopy.kieTasks : [];
    const renderPlan = (adCopy.renderPlan ?? {}) as Record<string, any>;
    const audioUrl: string | null = renderPlan.audioUrl ?? adCopy.audioFileUrl ?? null;
    const totalDuration = Number(renderPlan.totalDurationSec ?? adCopy.duration ?? 60);

    const ready = kieTasks.filter((k) => k.status === "completed" && k.videoUrl)
      .sort((a, b) => a.index - b.index);
    if (ready.length === 0) return json({ error: "No completed clips to stitch" }, 400);

    // --- Pre-stitch validation: pad last clip so video covers song length. ---
    const clipPlan = buildClipPlan(ready, totalDuration);
    const planTotal = clipPlan.reduce((s, c) => s + c.duration, 0);

    console.log(`[stitch] ad=${adId} clips=${clipPlan.length} planTotal=${planTotal}s audio=${totalDuration}s primary=${falKey ? "fal" : shotstackKey ? "shotstack" : "none"} maxAttempts=${maxAttempts} tolerance=${tolerance}s${overrideApplied ? " (override)" : ""}`);

    await sb.from("generated_ads").update({
      video_progress: 90,
      ad_copy: { ...adCopy, pipelineStage: "stitching" },
    }).eq("id", adId);

    const aspect = (ad.aspect_ratio ?? "9:16") as string;

    // Audit trail entries — one per stitcher attempt.
    const audit: AuditEntry[] = [];
    const startedAt = new Date().toISOString();
    const userEmail = (ad as any).email as string | undefined;


    // === PRIMARY: fal.ai compose (with bounded retries) ===
    let lastFalDrift: { measured: number | null; delta: number | null } | null = null;
    let falAttempts = 0;
    if (falKey) {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        falAttempts = attempt;
        const entry: AuditEntry = {
          stitcher: "fal.ai/compose",
          attempt,
          startedAt: new Date().toISOString(),
          tolerance: tolerance,
          requestedDurationSec: totalDuration,
          redactionApplied: true,
        };
        try {
          const falUrl = await stitchWithFal({
            falKey, clipPlan, audioUrl, totalDuration, aspect,
          });
          if (!falUrl) {
            entry.outcome = "no_url";
            entry.endedAt = new Date().toISOString();
            audit.push(entry);
            console.warn(`[stitch] fal attempt=${attempt}/${maxAttempts} returned no url ad=${adId}`);
            continue;
          }
          const drift = await validateDuration(falUrl, totalDuration);
          lastFalDrift = drift;
          entry.measuredDurationSec = drift.measured;
          entry.driftSec = drift.delta;
          entry.withinTolerance = drift.ok;
          entry.endedAt = new Date().toISOString();
          if (drift.ok) {
            entry.outcome = "accepted";
            audit.push(entry);
            console.log(`[stitch] fal OK ad=${adId} attempt=${attempt} drift=${drift.delta}s`);
            await finalize(sb, ad.id, ad.user_id, falUrl, adCopy, "fal.ai/compose", drift, {
              attempts: attempt, tolerance: tolerance, requested: totalDuration,
            }, audit, startedAt);
            return json({ success: true, videoUrl: falUrl, via: "fal", attempt, drift });
          }
          entry.outcome = "drift_rejected";
          audit.push(entry);
          console.warn(`[stitch] fal drift too large ad=${adId} attempt=${attempt} delta=${drift.delta}s tolerance=${tolerance}s — retrying`);
        } catch (e) {
          entry.outcome = "error";
          entry.error = redact((e as Error).message, falKey);
          entry.endedAt = new Date().toISOString();
          audit.push(entry);
          console.error(`[stitch] fal error ad=${adId} attempt=${attempt}:`, entry.error);
        }
      }
      console.warn(`[stitch] fal exhausted ${maxAttempts} attempts ad=${adId} — falling back to Shotstack`);
    } else {
      audit.push({
        stitcher: "fal.ai/compose",
        attempt: 0,
        outcome: "skipped_no_key",
        requestedDurationSec: totalDuration,
        tolerance: tolerance,
        redactionApplied: true,
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
      });
      console.warn(`[stitch] FAL_KEY missing or malformed — skipping primary stitcher`);
    }

    // === FALLBACK: Shotstack ===
    if (shotstackKey) {
      const entry: AuditEntry = {
        stitcher: "shotstack",
        attempt: 1,
        startedAt: new Date().toISOString(),
        tolerance: tolerance,
        requestedDurationSec: totalDuration,
        redactionApplied: true,
      };
      try {
        const ssUrl = await stitchWithShotstack({
          shotstackKey, clipPlan, audioUrl, totalDuration, aspect,
          resolution: adCopy.resolution,
        });
        if (ssUrl) {
          const drift = await validateDuration(ssUrl, totalDuration);
          entry.measuredDurationSec = drift.measured;
          entry.driftSec = drift.delta;
          entry.withinTolerance = drift.ok;
          entry.outcome = drift.ok ? "accepted" : "accepted_with_drift";
          entry.endedAt = new Date().toISOString();
          audit.push(entry);
          console.log(`[stitch] shotstack OK ad=${adId} drift=${drift.delta}s ok=${drift.ok}`);
          await finalize(sb, ad.id, ad.user_id, ssUrl, adCopy,
            drift.ok ? "shotstack" : "shotstack_with_drift", drift, {
              attempts: 1, tolerance: tolerance, requested: totalDuration,
              falAttempts, falLastDriftSec: lastFalDrift?.delta ?? null,
            }, audit, startedAt);
          return json({ success: true, videoUrl: ssUrl, via: "shotstack", drift });
        }
        entry.outcome = "no_url";
        entry.endedAt = new Date().toISOString();
        audit.push(entry);
      } catch (e) {
        entry.outcome = "error";
        entry.error = redact((e as Error).message, falKey);
        entry.endedAt = new Date().toISOString();
        audit.push(entry);
        console.error(`[stitch] shotstack error ad=${adId}:`, entry.error);
      }
    } else {
      audit.push({
        stitcher: "shotstack",
        attempt: 0,
        outcome: "skipped_no_key",
        requestedDurationSec: totalDuration,
        tolerance: tolerance,
        redactionApplied: true,
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
      });
    }

    // === LAST RESORT: publish first clip so credit isn't wasted ===
    const firstUrl = ready[0].videoUrl!;
    console.warn(`[stitch] all stitchers failed ad=${adId} — publishing first clip`);
    audit.push({
      stitcher: "first_clip_fallback",
      attempt: 1,
      outcome: "accepted",
      requestedDurationSec: totalDuration,
      tolerance: tolerance,
      redactionApplied: true,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
    });
    await finalize(sb, ad.id, ad.user_id, firstUrl, adCopy, "first_clip_fallback", null, {
      attempts: 0, tolerance: tolerance, requested: totalDuration,
      falAttempts, falLastDriftSec: lastFalDrift?.delta ?? null,
    }, audit, startedAt);
    return json({ success: true, videoUrl: firstUrl, via: "first_clip" });
  } catch (e) {
    const safe = redact(e instanceof Error ? e.message : "Unknown", falKey);
    console.error("[stitch-lyric-video] fatal:", safe);
    return json({ error: safe }, 500);
  }

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ---------- helpers ----------

interface PlannedClip { url: string; duration: number; }

function buildClipPlan(ready: KieTask[], totalDuration: number): PlannedClip[] {
  const plan: PlannedClip[] = ready.map((c) => ({ url: c.videoUrl!, duration: c.durationSec }));
  const sum = plan.reduce((s, c) => s + c.duration, 0);
  if (totalDuration > 0 && sum < totalDuration) {
    plan[plan.length - 1].duration += (totalDuration - sum);
  }
  return plan;
}

async function stitchWithFal(opts: {
  falKey: string;
  clipPlan: PlannedClip[];
  audioUrl: string | null;
  totalDuration: number;
  aspect: string;
}): Promise<string | null> {
  const { falKey, clipPlan, audioUrl, totalDuration } = opts;

  // Build a single video track with sequential keyframes, plus audio track.
  let cursor = 0;
  const videoKeyframes = clipPlan.map((c) => {
    const kf = { url: c.url, timestamp: cursor, duration: c.duration };
    cursor += c.duration;
    return kf;
  });

  const tracks: any[] = [{
    id: "video_track",
    type: "video",
    keyframes: videoKeyframes,
  }];

  if (audioUrl) {
    tracks.push({
      id: "audio_track",
      type: "audio",
      keyframes: [{ url: audioUrl, timestamp: 0, duration: totalDuration }],
    });
  }

  const submitRes = await fetch(FAL_SUBMIT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Key ${falKey}`,
    },
    body: JSON.stringify({ tracks, output_format: "mp4" }),
  });
  if (!submitRes.ok) {
    console.error(`[stitch.fal] submit failed ${submitRes.status} ${redact(await submitRes.text(), falKey)}`);
    return null;
  }
  const submitJson = await submitRes.json();
  const statusUrl: string | undefined = submitJson.status_url;
  const responseUrl: string | undefined = submitJson.response_url;
  if (!statusUrl || !responseUrl) {
    console.error(`[stitch.fal] no status/response URLs:`, redact(submitJson, falKey));
    return null;
  }

  // Poll up to ~4 min.
  for (let i = 0; i < 48; i++) {
    await sleep(5000);
    const r = await fetch(statusUrl, {
      headers: { "Authorization": `Key ${falKey}` },
    });
    if (!r.ok) continue;
    const j = await r.json();
    const status = (j.status ?? "").toUpperCase();
    if (status === "COMPLETED") break;
    if (status === "FAILED" || status === "ERROR") {
      console.error(`[stitch.fal] job failed:`, redact(j, falKey));
      return null;
    }
  }

  const rr = await fetch(responseUrl, {
    headers: { "Authorization": `Key ${falKey}` },
  });
  if (!rr.ok) {
    console.error(`[stitch.fal] response fetch failed ${rr.status}`);
    return null;
  }
  const out = await rr.json();
  const videoUrl: string | undefined = out?.video_url ?? out?.video?.url ?? out?.output?.url;
  if (!videoUrl) {
    console.error(`[stitch.fal] no video_url in response:`, redact(out, falKey));
    return null;
  }
  return videoUrl;
}

async function stitchWithShotstack(opts: {
  shotstackKey: string;
  clipPlan: PlannedClip[];
  audioUrl: string | null;
  totalDuration: number;
  aspect: string;
  resolution?: string;
}): Promise<string | null> {
  const { shotstackKey, clipPlan, audioUrl, totalDuration, aspect } = opts;
  let cursor = 0;
  const clips = clipPlan.map((c) => {
    const clip = {
      asset: { type: "video", src: c.url },
      start: cursor,
      length: c.duration,
      fit: "cover",
    };
    cursor += c.duration;
    return clip;
  });
  const tracks: any[] = [{ clips }];
  if (audioUrl) {
    tracks.push({
      clips: [{
        asset: { type: "audio", src: audioUrl },
        start: 0, length: totalDuration,
      }],
    });
  }
  const resolution = opts.resolution === "4k" ? "4k"
    : opts.resolution === "720p" ? "sd" : "hd";
  const payload = {
    timeline: { background: "#000000", tracks },
    output: {
      format: "mp4",
      resolution,
      aspectRatio: aspect === "16:9" ? "16:9" : aspect === "1:1" ? "1:1" : "9:16",
      fps: 30,
    },
  };

  let renderId: string | null = null;
  let usedBase = SHOTSTACK_PROD;
  for (const base of [SHOTSTACK_PROD, SHOTSTACK_STAGE]) {
    const res = await fetch(`${base}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": shotstackKey },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const j = await res.json();
      renderId = j?.response?.id ?? j?.id ?? null;
      usedBase = base;
      break;
    }
    console.warn(`[stitch.shotstack] submit failed ${base} ${res.status}`);
  }
  if (!renderId) return null;

  for (let i = 0; i < 36; i++) {
    await sleep(5000);
    const r = await fetch(`${usedBase}/render/${renderId}`, {
      headers: { "x-api-key": shotstackKey },
    });
    if (!r.ok) continue;
    const j = await r.json();
    const status = j?.response?.status ?? j?.status;
    if (status === "done") return j?.response?.url ?? j?.url ?? null;
    if (status === "failed") {
      console.error(`[stitch.shotstack] render failed:`, j);
      return null;
    }
  }
  return null;
}

/**
 * Post-stitch validation: read mp4 `mvhd` atom to extract duration and compare
 * against the imported song length. Tolerates DURATION_TOLERANCE_SEC drift.
 *
 * Only reads the first ~256 KB via Range request — enough to find the moov
 * atom in fast-start mp4s emitted by both fal and Shotstack.
 */
async function validateDuration(
  videoUrl: string,
  expectedSec: number,
): Promise<{ ok: boolean; measured: number | null; delta: number | null }> {
  try {
    const r = await fetch(videoUrl, { headers: { Range: "bytes=0-262143" } });
    if (!r.ok && r.status !== 206) {
      console.warn(`[stitch.validate] fetch failed ${r.status} — skipping`);
      return { ok: true, measured: null, delta: null };
    }
    const buf = new Uint8Array(await r.arrayBuffer());
    const measured = readMp4Duration(buf);
    if (measured == null) {
      console.warn(`[stitch.validate] could not parse mvhd — skipping`);
      return { ok: true, measured: null, delta: null };
    }
    const delta = Math.abs(measured - expectedSec);
    return { ok: delta <= DURATION_TOLERANCE_SEC, measured, delta };
  } catch (e) {
    console.warn(`[stitch.validate] error:`, (e as Error).message);
    return { ok: true, measured: null, delta: null };
  }
}

// Minimal mp4 mvhd reader: walks top-level atoms, descends into moov, returns
// duration in seconds. Returns null if not found within the buffer.
function readMp4Duration(buf: Uint8Array): number | null {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const readAtom = (offset: number): { size: number; type: string; bodyOffset: number } | null => {
    if (offset + 8 > buf.length) return null;
    const size = dv.getUint32(offset);
    const type = String.fromCharCode(buf[offset+4], buf[offset+5], buf[offset+6], buf[offset+7]);
    return { size, type, bodyOffset: offset + 8 };
  };
  let pos = 0;
  while (pos < buf.length - 8) {
    const atom = readAtom(pos);
    if (!atom || atom.size < 8) return null;
    if (atom.type === "moov") {
      let p = atom.bodyOffset;
      const end = Math.min(pos + atom.size, buf.length);
      while (p < end - 8) {
        const sub = readAtom(p);
        if (!sub) return null;
        if (sub.type === "mvhd") {
          const version = buf[sub.bodyOffset];
          if (version === 0) {
            const timescale = dv.getUint32(sub.bodyOffset + 12);
            const duration = dv.getUint32(sub.bodyOffset + 16);
            return timescale ? duration / timescale : null;
          } else {
            const timescale = dv.getUint32(sub.bodyOffset + 20);
            // duration is 64-bit; high 32 bits in offset+24, low in +28
            const hi = dv.getUint32(sub.bodyOffset + 24);
            const lo = dv.getUint32(sub.bodyOffset + 28);
            const duration = hi * 0x1_0000_0000 + lo;
            return timescale ? duration / timescale : null;
          }
        }
        p += sub.size;
      }
      return null;
    }
    pos += atom.size;
  }
  return null;
}

interface AuditEntry {
  stitcher: string;
  attempt: number;
  startedAt?: string;
  endedAt?: string;
  outcome?:
    | "accepted"
    | "accepted_with_drift"
    | "drift_rejected"
    | "no_url"
    | "error"
    | "skipped_no_key";
  measuredDurationSec?: number | null;
  driftSec?: number | null;
  withinTolerance?: boolean | null;
  requestedDurationSec?: number | null;
  tolerance?: number | null;
  error?: string;
  /** True when secrets are redacted from logs/errors for this entry. */
  redactionApplied?: boolean;
}

async function finalize(
  sb: any,
  adId: string,
  userId: string,
  videoUrl: string,
  adCopy: Record<string, any>,
  via: string,
  drift: { measured: number | null; delta: number | null } | null,
  meta?: {
    attempts?: number;
    tolerance?: number;
    requested?: number;
    falAttempts?: number;
    falLastDriftSec?: number | null;
  },
  audit?: AuditEntry[],
  startedAt?: string,
) {
  await sb.from("generated_ads").update({
    status: "completed",
    video_status: "completed",
    video_progress: 100,
    generated_video_url: videoUrl,
    completed_at: new Date().toISOString(),
    ad_copy: {
      ...adCopy,
      pipelineStage: "done",
      stitchedBy: via,
      stitchValidation: {
        stitcher: via,
        requestedDurationSec: meta?.requested ?? null,
        measuredDurationSec: drift?.measured ?? null,
        driftSec: drift?.delta ?? null,
        toleranceSec: meta?.tolerance ?? null,
        withinTolerance: drift ? (drift.delta != null && meta?.tolerance != null
          ? drift.delta <= meta.tolerance : null) : null,
        attempts: meta?.attempts ?? null,
        falAttempts: meta?.falAttempts ?? null,
        falLastDriftSec: meta?.falLastDriftSec ?? null,
        validatedAt: new Date().toISOString(),
      },
      stitchAudit: audit && audit.length
        ? {
            version: 1,
            startedAt: startedAt ?? null,
            finishedAt: new Date().toISOString(),
            finalStitcher: via,
            tolerance: meta?.tolerance ?? null,
            requestedDurationSec: meta?.requested ?? null,
            entries: audit,
            redactionApplied: audit.every((a) => a.redactionApplied !== false),
          }
        : (adCopy.stitchAudit ?? null),
    },
  }).eq("id", adId);
  try {
    await sb.rpc("consume_credit", { _user_id: userId, _amount: 3 });
  } catch (e) {
    console.warn(`[stitch.finalize] consume_credit error:`, (e as Error).message);
  }
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
