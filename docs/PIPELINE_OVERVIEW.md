# Lyric A Vid — Pipeline Overview

Lyric A Vid is an autonomous AI music-video pipeline inspired by OpenArt's
multi-stage orchestration model. Audio in → storyboarded, lyric-synced video out.

## Allowed providers (locked)

| Layer              | Provider                  | Notes                              |
| ------------------ | ------------------------- | ---------------------------------- |
| Song / audio       | **Suno AI**               | Import via shared link             |
| Lyric transcription| **OpenAI** (Whisper + GPT)| Only when lyrics missing           |
| Storyboard images  | **Nano Banana** (Gemini)  | **Only allowed image engine**      |
| B-roll fallback    | **Pexels**                | Photo/video gallery                |
| Video rendering    | **Kie.ai** (Kling 3.0 / Veo 3.1) | **Only allowed video render path** |
| Orchestration      | n8n                       | Queue + polling                    |

> **Shotstack has been fully removed.** Any code path that previously called
> `api.shotstack.io` is gone. All video composition runs through Kie.ai.

> **Nano Banana is the only image engine.** `submit-ugc-image-ad` and
> `submit-lyric-video` reject any other `imageModel` / `aiImageModel` value
> with HTTP 400.

## High-level flow

```
[ /create UI ]
      │
      ▼
[ SunoLinkParser ] ── suno-parse edge fn ──► song metadata + lyrics + audio URL
      │
      ▼
[ LyricVideoForm ] ── user picks template, ratio, video model (kling | veo) ──
      │
      ▼
[ StoryboardEditor ] ── Nano Banana ──► scene frames (consistency anchors)
      │
      ▼
[ submit-lyric-video ] ── validates engines, debits credits ──┐
                                                              │
                                                              ▼
                                          [ n8n webhook (N8N_WEBHOOK_URL) ]
                                                              │
                                                              ▼
                                            [ Kie.ai (Kling 3.0 / Veo 3.1) ]
                                                              │
                                                  async render + poll loop
                                                              │
                                                              ▼
                                    [ ugc-webhook-callback ] ── final MP4 URL
                                                              │
                                                              ▼
                                          generated_ads.status = 'completed'
                                          + Resend email + web push
```

## Detailed pipeline docs

- [Suno import + lyrics](./pipelines/suno-import.md)
- [Storyboard generation (Nano Banana)](./pipelines/storyboard.md)
- [Scenes / clips / scripts](./pipelines/scenes-and-scripts.md)
- [Audio transcription](./pipelines/audio-transcription.md)
- [Pexels gallery](./pipelines/pexels-gallery.md)
- [Kie.ai render pipeline](./pipelines/kie-render.md)
- [Webhook callback contract](./pipelines/webhook-callback.md)

## Required secrets

| Secret              | Used by                                           |
| ------------------- | ------------------------------------------------- |
| `LOVABLE_API_KEY`   | Nano Banana + OpenAI calls via Lovable AI Gateway |
| `KIE_AI_API_KEY`    | Kie.ai (Kling 3.0 / Veo 3.1) — **add this**       |
| `N8N_WEBHOOK_URL`   | Orchestration webhook                             |
| `N8N_WEBHOOK_SECRET`| HMAC for n8n callbacks                            |
| `PEXELS_API_KEY`    | Pexels gallery                                    |
| `RESEND_API_KEY`    | Completion emails                                 |

`SHOTSTACK_API_KEY` is **deprecated** and no longer read by any function.
