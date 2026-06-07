# Storyboard Generation — Nano Banana

## Why storyboards first
Per the OpenArt blueprint: render visual consistency anchors **before**
the expensive video pass. Each chorus / verse gets a key frame that the
video model uses as a start-frame reference for character consistency.

## UI
`src/components/lyric/StoryboardEditor.tsx`

## Engine
**Nano Banana** (`google/gemini-2.5-flash-image`) via Lovable AI Gateway —
this is the only allowed image engine project-wide. All other engines
(Imagen, Midjourney, Flux, …) are rejected at both the UI level and the
edge-function level (`submit-ugc-image-ad`, `submit-lyric-video`).

## Flow
1. Lyrics are split into scenes (one scene per 4–8 lines).
2. For each scene, an OpenAI call produces a cinematic image prompt
   (`storyDescription`, `cameraInstructions`, `colorGradingInstructions`).
3. The prompt is sent to Nano Banana with the user's reference image
   appended for character consistency.
4. The returned URL is stored on the scene and forwarded to Kie.ai
   as `referenceImageUrl` for the corresponding clip.

## Enforcement
```ts
// supabase/functions/submit-lyric-video/index.ts
if (normalizedImage !== "nano-banana" && normalizedImage !== "nano-banana-pro") {
  return 400 "Image engine ... is not allowed";
}
```
```ts
// supabase/functions/submit-ugc-image-ad/index.ts
if (normalizedModel !== "nano-banana" && ...) return 400;
```
