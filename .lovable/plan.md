# Lyric Video Pipeline — Direct Orchestration (no n8n)

## Goal
Replace the n8n webhook pipeline with edge-function-driven orchestration. `/create` becomes a 2-tab flow: **Tab 1** collects inputs, **Tab 2** shows live storyboard generation (script → transcription → scene images) before final render. Each stage updates the DB so the UI can poll progress; Nano Banana frames can be re-rolled per scene.

## Architecture

```text
Tab 1 (form)            Tab 2 (storyboard + render)
─────────────────       ──────────────────────────────────
song info               ├─ poll generated_ads + scenes table
ref images              ├─ stage 1: script   (OpenAI gpt-4o)
audio source            ├─ stage 2: transcribe (ElevenLabs via Kie → Whisper fallback)
style + model           ├─ stage 3: scenes   (Nano Banana per scene)
─────────────► submit   ├─ user reviews / re-rolls a scene
                        └─ stage 4: render  (Kie.ai Kling/Veo) → callback updates row
```

All stages run server-side. Tab 2 polls every 2s. Heavy work runs in `EdgeRuntime.waitUntil` so the HTTP response returns fast.

## Data model
New table `video_scenes`:
- `id`, `ad_id` (FK generated_ads), `index`, `lyric_lines text[]`, `start_sec`, `end_sec`
- `prompt jsonb` (story/camera/env/grading/vfx)
- `image_url`, `image_status` (`pending|generating|ready|failed`)
- `regen_count int default 0`
- RLS: owner via ad_id → user_id; service_role full.

Extend `generated_ads.ad_copy` with `pipelineStage` (`script|transcribe|storyboard|ready_to_render|rendering|done|failed`), `script jsonb`, `transcription jsonb`.

## Edge functions (all direct, no n8n)
1. **`submit-lyric-video`** (rewrite) — validate, insert ad row at stage `script`, `waitUntil(orchestrateLyricVideo(adId))`, return adId immediately.
2. **`_shared/pipeline.ts`** — `orchestrateLyricVideo()`:
   - `runScript()` → OpenAI `gpt-4o` → JSON shot list → write `script`, scenes rows, advance to `transcribe`.
   - `runTranscription()` → ElevenLabs (via Kie.ai `/v1/audio/transcribe` route) with Whisper fallback (`OPENAI_API_KEY` → `/v1/audio/transcriptions whisper-1`); align word timings to scenes.
   - `runStoryboard()` → for each scene, call Nano Banana (`google/gemini-2.5-flash-image` via Lovable AI Gateway) with composed prompt + reference image; upload base64 to `generated-images` bucket; update scene row. Parallelized (max 3 concurrent).
   - Stop at `ready_to_render`. User must press "Render video" in Tab 2.
3. **`regenerate-scene-image`** (new) — POST `{ sceneId, promptOverride? }`. Auth + ownership check, re-runs Nano Banana, bumps `regen_count`.
4. **`render-lyric-video`** (new) — POST `{ adId }`. Verifies all scenes ready, calls Kie.ai (`KIE_AI_API_KEY`) Kling/Veo submit endpoint directly, stores `kie_task_id` on ad, sets stage `rendering`.
5. **`poll-lyric-video-status`** (rewrite) — polls Kie.ai for in-flight tasks (not n8n callbacks), downloads finished MP4 to storage, marks done + consumes credits + sends notification email.
6. **Remove Shotstack**: delete `SHOTSTACK_API_KEY` references, remove `submit-video-ad` shotstack branch, drop `N8N_WEBHOOK_*` from `submit-lyric-video`.

## Frontend
- **`/create`** updated: tab structure (`Details` → `Storyboard & Render`).
- **Tab 1**: existing `LyricVideoForm` trimmed — keep Suno parser, lyrics, ref images, Pexels, style, aspect, video model (kling/veo only), image engine locked to Nano Banana (UI hidden).
- **Tab 2** (`StoryboardStage.tsx` new): subscribes (Realtime) to `video_scenes` for the ad; renders OpenArt-style grid (scene image | prompt | regenerate button); top progress bar shows current pipeline stage; "Render Video" CTA enabled when all scenes ready.
- Update `useCreateSubmit` to switch tab on success instead of redirecting to Library.

## Security
- All new functions: JWT verify, ownership check on `ad_id`/`sceneId`, input validation with Zod, never log secret values.
- `startup-checks.requireSecrets()` extended per function:
  - submit: `OPENAI_API_KEY`, `LOVABLE_API_KEY`, `KIE_AI_API_KEY`, `ELEVENLABS_API_KEY`
  - regenerate-scene: `LOVABLE_API_KEY`
  - render: `KIE_AI_API_KEY`
  - poll: `KIE_AI_API_KEY`

## Docs
Update `docs/pipelines/*`:
- Remove all n8n references.
- New `docs/pipelines/orchestrator.md` describing direct stage machine.
- Update `kie-render.md` (direct call, not via n8n).
- Update `storyboard.md`, `audio-transcription.md` with provider fallback chain.

## Out of scope (this iteration)
- Per-scene prompt editing (only regenerate from existing prompt).
- Per-scene reference image override.
- Realtime collaboration on storyboard.

## Risk notes
- Edge function CPU/wall time: Nano Banana fan-out limited to 3 concurrent, total scenes capped at 8 for now.
- Kie.ai poll job replaces callback model for reliability; n8n callback path stays only for legacy in-flight jobs (will be removed once drained).
