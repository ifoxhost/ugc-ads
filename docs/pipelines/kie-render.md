# Kie.ai Render Pipeline

All video rendering goes through **Kie.ai** directly (no n8n, no Shotstack).

## Models

| `aiModel` | Kie.ai id | Endpoint |
| --- | --- | --- |
| `kling` | `kling-3.0` | `https://api.kie.ai/v1/kling/generate` |
| `veo`   | `veo-3.1`   | `https://api.kie.ai/v1/veo/generate`   |

Anything else is rejected by `render-lyric-video` with HTTP 400.

## Trigger
The user clicks **Render video** in Tab 2 after reviewing the storyboard.
The frontend calls `supabase.functions.invoke("render-lyric-video", { adId })`.

## Edge function — `render-lyric-video`
1. Auth check + ad ownership.
2. Verifies all `video_scenes` rows are `image_status='ready'`.
3. Builds the Kie.ai payload:
   ```jsonc
   {
     "prompt": "<song title>",
     "audioUrl": "<suno mp3>",
     "referenceImageUrl": "<user upload>",
     "pexelsBackgroundUrl": "<optional>",
     "storyboard": [
       { "index": 0, "startSec": 0, "endSec": 12, "imageUrl": "<nano-banana>" },
       ...
     ],
     "aspectRatio": "9:16",
     "width": 1080, "height": 1920,
     "fps": 30, "duration": 60,
     "resolution": "1080p"
   }
   ```
4. POSTs to the model endpoint with `Authorization: Bearer KIE_AI_API_KEY`.
5. Stores `task_id` on `generated_ads.video_task_id`, sets
   `pipelineStage='rendering'`.

## Polling — `poll-lyric-video-status` (cron)
- Pulls every `generated_ads` row with `video_status IN ('queued','processing')`
  and a `BeatFrame lyric video%` prompt.
- Calls `GET https://api.kie.ai/v1/tasks/<taskId>` for each.
- On success: downloads `videoUrl`, sets `status=completed`,
  `pipelineStage='done'`, consumes credits via `consume_credit` RPC.
- On failure or 15-minute timeout: marks `failed`.

## Required secret
`KIE_AI_API_KEY` — used by both `render-lyric-video` and
`poll-lyric-video-status`. Never sent to the browser.
