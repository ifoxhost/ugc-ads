## Problem
Two real bugs in the current Kie.ai render path (`supabase/functions/_shared/pipeline.ts → submitKieRender`):

1. **Imported Suno audio is never sent to the renderer.** `params.audioUrl` is built in `render-lyric-video/index.ts` but `submitKieRender` ignores it. It also sets `sound: true`, so Kling auto-generates its own soundtrack.
2. **Output duration is always 5 or 10 seconds and only one scene image is used.** `klingDuration()` clamps to `"5"` or `"10"`, and only `storyboard[0].imageUrl` is passed to Kling. The remaining 5–7 storyboard frames are discarded, so a 3:54 song becomes a 5–10s clip of the first frame.

Kling itself does **not** accept a custom audio track and caps each job at 10s, so we must change the render strategy — not just the parameters.

## Fix — per-scene Kling clips, then stitch + mux the imported audio

### Scene planning (already partly in place)
- `runScript()` keeps producing up to 8 scenes, but we'll size them to the song:
  - `sceneCount = clamp(ceil(duration / 8), 4, 12)` (raise `MAX_SCENES` to 12).
  - `start_sec`/`end_sec` are spaced evenly across `duration`; OpenAI is instructed to honor those bounds.
- Persist final scene timing back to `video_scenes` so the renderer trusts the DB, not the model.

### Render (rewrite `render-lyric-video` + `submitKieRender`)
- For each `video_scenes` row:
  - Compute `clipSec = round(end_sec - start_sec)` and clamp to Kling's allowed `"5"` or `"10"`.
  - Submit one Kling **image-to-video** job per scene with that scene's `image_url`, `sound: false`, and a scene-specific prompt.
- Store the list of Kie task ids on `generated_ads.ad_copy.kieTasks = [{sceneId, taskId, durationSec}]` and set a new `ad_copy.renderPlan = { audioUrl, totalDurationSec, scenes:[…] }`.
- Set `video_status = "processing"`, `pipelineStage = "rendering"`.

### Poll + finalize (`poll-lyric-video-status`)
- Poll every `kieTasks[*].taskId`. When all succeed, download each MP4 to the `generated-images` bucket (new prefix `renders/{adId}/clip-{i}.mp4`).
- Call a new **`stitch-lyric-video`** edge function that:
  1. Downloads all clip URLs + the original `audioUrl` (Suno mp3).
  2. Uses **Shotstack's Edit API** (already have `SHOTSTACK_API_KEY` in secrets — repurposed only for stitching, not generation) to build a timeline:
     - Video track: clips concatenated in scene order, each trimmed to its `durationSec`, total length = song length.
     - If clips total < song length, loop the last clip or stretch with `fit: "cover"` to fill.
     - Audio track: the Suno mp3 spanning `0..duration`, replaces any clip audio.
  3. Submits the render, polls Shotstack, stores the final mp4 URL on `generated_ads.generated_video_url`.
  4. Marks `status = "completed"`, `video_status = "completed"`, `pipelineStage = "done"`, and calls `consume_credit`.
- If Shotstack isn't reachable, fall back to publishing the **first clip muxed with audio via Cloudinary's `l_video` + `au_*` URL transform** (no extra secret — uses `referenceImages` bucket's public delivery). This guarantees the user always gets a video whose length and audio match the song.

### Frontend
- No UI change beyond the existing render-progress bar; it already polls `video_progress`. We'll bump progress in stages: 60 (clips submitted) → 80 (all clips ready) → 95 (stitching) → 100 (done).

## Files touched
- `supabase/functions/_shared/pipeline.ts` — scene sizing, `submitKieRender` per-scene loop, `sound:false`, new helpers `submitKieRenderBatch`, `downloadClip`.
- `supabase/functions/render-lyric-video/index.ts` — orchestrates the per-scene submission and writes `kieTasks` + `renderPlan`.
- `supabase/functions/poll-lyric-video-status/index.ts` — polls every task, triggers stitching when all are ready, no longer assumes a single task id.
- `supabase/functions/stitch-lyric-video/index.ts` — **new**. Shotstack timeline + Suno audio mux, with Cloudinary fallback.
- `supabase/config.toml` — register the new function.
- `docs/pipelines/kie-render.md`, `docs/pipelines/orchestrator.md` — document the per-scene + stitch flow.

## Out of scope
- True lyric-synced subtitles burned into the video (the transcription is stored but not yet rendered as captions). Easy follow-up once stitching works.
- Replacing Kling with Veo for built-in audio — keeps current model choice intact.

## Risk
- Shotstack render adds ~1–2 min to total wall time. We surface this in the progress bar.
- Per-scene Kling submission multiplies Kie cost by `sceneCount`. We cap at 12 scenes.
