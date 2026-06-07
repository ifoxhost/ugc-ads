# Kie.ai Render Pipeline

All video rendering runs through **Kie.ai**. Shotstack has been removed.

## Models

| `aiModel` | Kie.ai id   | Endpoint                                  |
| --------- | ----------- | ----------------------------------------- |
| `kling`   | `kling-3.0` | `https://api.kie.ai/v1/kling/generate`    |
| `veo`     | `veo-3.1`   | `https://api.kie.ai/v1/veo/generate`      |

Anything else is rejected by `submit-lyric-video` with HTTP 400.

## Edge function
`supabase/functions/submit-lyric-video/index.ts`

1. Authenticates the user, checks subscription credits (3 per variation).
2. Validates `aiImageModel === "nano-banana"`.
3. Validates `aiModel ∈ {kling, veo}`.
4. Inserts a `generated_ads` row (`video_status = 'queued'`).
5. POSTs to `N8N_WEBHOOK_URL` with:
   ```jsonc
   {
     "jobType": "lyric_video",
     "renderEngine": "kie.ai",
     "adId": "<uuid>",
     "callbackUrl": "<SUPABASE_URL>/functions/v1/ugc-webhook-callback",
     "kiePayload": {
       "provider": "kie.ai",
       "model": "kling-3.0",
       "endpoint": "https://api.kie.ai/v1/kling/generate",
       "params": {
         "prompt": "<lyrics>",
         "audioUrl": "<suno mp3>",
         "storyboard": [ { "imageUrl": "...", "startSec": 0, "endSec": 12 } ],
         "referenceImageUrl": "<nano-banana hero frame>",
         "pexelsBackgroundUrl": null,
         "aspectRatio": "9:16",
         "width": 1080, "height": 1920,
         "fps": 30, "duration": 60,
         "imageEngine": "nano-banana"
       }
     }
   }
   ```
6. Returns immediately. n8n handles Kie.ai submission, polling, and
   eventual callback.

## Polling
`supabase/functions/poll-lyric-video-status/index.ts` runs on cron but
**only enforces the 15-minute timeout** — it never calls Kie.ai or
Shotstack. All progress comes via webhook callback.

## Required secret
`KIE_AI_API_KEY` — pass through `x-kie-api-key` header to n8n so the
workflow can authenticate with Kie.ai.
