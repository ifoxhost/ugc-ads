# Storyboard Generation — Nano Banana

## Why storyboards first
Render visual consistency anchors **before** the expensive video pass. Each
scene gets a key frame the video model uses as a start-frame reference.

## UI
`src/components/lyric/StoryboardStage.tsx` — OpenArt-style grid that
subscribes to `video_scenes` via Realtime and lets the user re-roll any
scene before render.

## Engine
**Nano Banana** (`google/gemini-2.5-flash-image`) via Lovable AI Gateway.
This is the only allowed image engine. Both `submit-lyric-video` and
`submit-ugc-image-ad` reject any other model with HTTP 400.

## Flow
1. The script stage produces a `prompt` per scene.
2. For each scene `_shared/pipeline.ts → generateSceneImage()` composes a
   cinematic prompt + the user's reference image and calls Nano Banana.
3. The returned base64 PNG is uploaded to the `generated-images` storage
   bucket; the public URL is written to `video_scenes.image_url`.
4. `image_status` flips to `ready`. Realtime pushes the change to the UI.

Per-scene regeneration uses the same function via the
`regenerate-scene-image` edge function (auth + ownership check, bumps
`regen_count`).

## Enforcement
```ts
// supabase/functions/submit-lyric-video/index.ts
if (String(aiImageModel).toLowerCase().trim() !== "nano-banana") return 400;
```
```ts
// supabase/functions/submit-ugc-image-ad/index.ts
if (normalizedModel !== "nano-banana" && ...) return 400;
```
