# Webhook Callback Contract

## Endpoint
`POST {SUPABASE_URL}/functions/v1/ugc-webhook-callback`

n8n (after Kie.ai finishes a render) POSTs the final result here.

## Expected body
```jsonc
{
  "adId": "<uuid from generated_ads>",
  "status": "complete" | "failed",
  "videoUrl": "https://cdn.kie.ai/.../final.mp4",  // when complete
  "thumbnailUrl": "https://...",                    // optional
  "durationSec": 62.4,                              // optional
  "error": "string"                                 // when failed
}
```

## Behaviour
- On `complete`: sets `status='completed'`, `video_status='complete'`,
  `generated_video_url=<videoUrl>`, `completed_at=now()`,
  `video_progress=100`. Then dispatches:
  - Resend completion email (template in
    `supabase/functions/poll-lyric-video-status/index.ts → sendCompletionEmail`)
  - Web push via `send-push-notification`.
- On `failed`: sets `status='video_failed'`, `video_status='failed'`.

## Signature
Optionally validate `x-webhook-secret === N8N_WEBHOOK_SECRET`.
For n8n-originated payloads the project explicitly bypasses HMAC and
trusts the secret header (see security memory entry "Webhook Bypass").
