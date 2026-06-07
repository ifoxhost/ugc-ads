# Lyric Video Orchestrator (direct, no n8n)

The pipeline is now a single edge-function-driven state machine. n8n and
Shotstack have been removed.

## Stages

```
[submit-lyric-video] → script → transcribe → storyboard → ready_to_render
                                                                │
                                       user clicks "Render" ────┘
                                                                ▼
                                  [render-lyric-video] → rendering
                                                                │
                              [poll-lyric-video-status] cron ───┘
                                                                ▼
                                                              done
```

Stages live on `generated_ads.ad_copy.pipelineStage`:
`script | transcribe | storyboard | ready_to_render | rendering | done | failed`.

## Stage providers

| Stage | Provider | Secret |
| --- | --- | --- |
| script | OpenAI `gpt-4o` (chat completions, JSON mode) | `OPENAI_API_KEY` |
| transcribe (primary) | ElevenLabs Scribe via Kie.ai | `KIE_AI_API_KEY` |
| transcribe (fallback 1) | ElevenLabs direct | `ELEVENLABS_API_KEY` |
| transcribe (fallback 2) | OpenAI Whisper-1 | `OPENAI_API_KEY` |
| storyboard | Nano Banana (`google/gemini-2.5-flash-image`) via Lovable AI Gateway | `LOVABLE_API_KEY` |
| render | Kie.ai (`kling-3.0` or `veo-3.1`) | `KIE_AI_API_KEY` |

## Edge functions

- `submit-lyric-video` — validates, inserts ad row, launches the orchestrator
  in `EdgeRuntime.waitUntil`, returns immediately.
- `_shared/pipeline.ts` — `orchestrateLyricVideo()` runs the four storyboard
  stages serially. Nano Banana fans out at concurrency 3 over up to 8 scenes.
- `regenerate-scene-image` — POST `{ sceneId }`. Auth + ownership check.
  Re-runs Nano Banana for one scene only.
- `render-lyric-video` — POST `{ adId }`. Verifies all scenes are `ready`,
  submits the Kie.ai render job, stores `video_task_id`.
- `poll-lyric-video-status` — cron job. Polls Kie.ai for each in-flight
  `video_task_id`; on success downloads `generated_video_url`, marks `done`,
  and consumes credits via `consume_credit` RPC.

## Database

New table `video_scenes` (one row per storyboard frame):

```
id, ad_id, user_id, index, lyric_lines text[], start_sec, end_sec,
prompt jsonb, image_url, image_status, regen_count, error_message
```

RLS: owner-only read/write; admins read all. Realtime enabled so the
storyboard UI receives live updates.

## Frontend

`/create` tab 1 collects inputs. On submit, the UI switches to tab 2 which
mounts `src/components/lyric/StoryboardStage.tsx`. That component subscribes
to `generated_ads` + `video_scenes` via Supabase Realtime, renders the
storyboard grid (à la OpenArt), exposes per-scene **Regenerate** buttons, and
shows the **Render video** CTA once every scene is ready.

## Removed

- n8n webhook submission and callback wiring
- Shotstack rendering path
- `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET`, `SHOTSTACK_API_KEY` references in
  the lyric video path (the secrets remain in storage until the user removes
  them; nothing in the new code reads them)
