# Kie.ai Render Pipeline

All video rendering goes through **Kie.ai** directly (no n8n, no AI-generated
audio) and is then stitched together with the user's imported song by
`stitch-lyric-video`.

## Models

| `aiModel` | Kie.ai id | Endpoint                                  | kind  |
| --------- | --------- | ----------------------------------------- | ----- |
| `kling`   | `kling-2.6` | `/api/v1/jobs/createTask`               | market |
| `veo`     | `veo-3.1`   | `/api/v1/veo/generate`                  | veo    |

Anything else is rejected by `render-lyric-video` with HTTP 400.

## Why per-scene clips

Kling caps each render at 10 seconds and ignores any custom audio track. To
match a song that's several minutes long AND keep the user's imported audio,
we submit **one Kling clip per storyboard scene** (`sound: false`) and then
mux the original mp3 in via Shotstack.

## Trigger
The user clicks **Render video** in Tab 2 after reviewing the storyboard.
The frontend calls `supabase.functions.invoke("render-lyric-video", { adId })`.

## `render-lyric-video`
1. Auth + ad ownership check.
2. Verifies all `video_scenes` rows are `image_status='ready'`.
3. For each scene:
   - Builds a scene-specific prompt from `prompt.story / camera / vfx`.
   - Picks `5` or `10` seconds as the clip duration (closest to
     `end_sec - start_sec`).
   - Submits a Kling **image-to-video** job with that scene's image and
     `sound: false`.
4. Persists the task list on `generated_ads.ad_copy.kieTasks` and a summary on
   `ad_copy.renderPlan = { audioUrl, totalDurationSec, aspectRatio, scenes:[…] }`.
5. Sets `video_status='processing'`, `pipelineStage='rendering'`.

## `poll-lyric-video-status` (cron)
- Picks up every ad in `video_status IN ('queued','processing')`.
- For each ad with `ad_copy.kieTasks`, polls every task via
  `/api/v1/jobs/recordInfo`. Tracks per-clip `status` + `videoUrl` back into
  `ad_copy.kieTasks` and bumps `video_progress` from 60 → 85.
- When **all** clips are `completed`, calls the new **`stitch-lyric-video`**
  function with `{ adId }`.
- If any clip fails, the ad is marked `failed`.

## `stitch-lyric-video` (new)
1. Loads `ad_copy.kieTasks` (sorted by `index`) and `renderPlan.audioUrl`.
2. Builds a Shotstack timeline:
   - **Video track**: every clip concatenated in scene order. If the total
     clip length is shorter than the song, the **last clip is stretched** to
     fill so the final video matches the song duration exactly.
   - **Audio track**: the imported Suno mp3 spanning `0..totalDurationSec`.
3. Submits to `POST /edit/v1/render` (with `/edit/stage` fallback), polls
   `GET /edit/v1/render/{id}` until `done`.
4. Writes the final mp4 URL to `generated_ads.generated_video_url`, sets
   `status='completed'`, `pipelineStage='done'`, and calls `consume_credit`.
5. Fallbacks (so the user always gets a video):
   - `SHOTSTACK_API_KEY` missing → publish the first clip + flag
     `stitchedBy='shotstack_missing'`.
   - Shotstack submit fails on both endpoints → same fallback with
     `stitchedBy='shotstack_submit_failed'`.
   - Shotstack render times out → `stitchedBy='shotstack_timeout'`.

## Required secrets
- `KIE_AI_API_KEY` — used by `render-lyric-video` and `poll-lyric-video-status`.
- `FAL_KEY` — primary stitcher (`fal-ai/ffmpeg-api/compose`). Format `<id>:<secret>`. Always redacted from logs and audit trail.
- `SHOTSTACK_API_KEY` — fallback stitcher (used when fal.ai exhausts retries or `FAL_KEY` is missing/malformed).

## Tunable stitch env vars
Set in Lovable Cloud → Secrets (no code change / redeploy needed beyond restarting the function):

| Env var | Default | Range | Effect |
| --- | --- | --- | --- |
| `STITCH_FAL_MAX_ATTEMPTS` | `2` | 1–5 | How many fal.ai compose attempts before falling back to Shotstack. Each attempt re-submits and re-validates duration. |
| `STITCH_DURATION_TOLERANCE_SEC` | `1.5` | > 0 | Max allowed drift (seconds) between the imported Suno audio length and the measured mp4 duration. Larger drift is rejected and triggers a retry/fallback. |

## Stitch audit trail
Every run writes `ad_copy.stitchAudit` with one entry per attempt:
`{ stitcher, attempt, outcome, measuredDurationSec, driftSec, withinTolerance, error?, redactionApplied }`.
The Library "Render details" panel renders this list and exposes a **Re-stitch** action plus a **Download audit (JSON)** button.
