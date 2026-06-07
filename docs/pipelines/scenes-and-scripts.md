# Scenes, Clips & Scripts

## Scene model
A scene is one storyboard frame + the lyric lines that play under it.

```ts
interface Scene {
  index: number;
  lyricLines: string[];   // 2–8 lines
  durationSec: number;    // derived from BPM + line count
  storyboardImageUrl: string;   // Nano Banana
  videoClipUrl?: string;        // Kie.ai render
  prompt: {
    story: string;
    camera: string;
    environment: string;
    colorGrading: string;
    vfx: string;
  };
}
```

## Script generation
`LyricVideoForm.tsx` exposes six "Advanced Prompt Instructions":
`storyDescription`, `characterInstructions`, `cameraInstructions`,
`environmentInstructions`, `colorGradingInstructions`, `visualEffectsInstructions`.

An OpenAI call (`google/gemini-3-flash-preview` via Lovable AI Gateway)
turns these + the lyrics into a per-scene shot list:

```
Scene 1 — 0:00–0:12 — INTRO
  Camera: slow push-in from black, 35mm anamorphic
  Subject: <referenceImageUrl> wearing gold-lit silhouette
  Action: turns toward camera as the beat drops
  Grade: teal & gold, soft halation
```

## Clip rendering
Each scene's prompt + storyboard URL + audio segment is sent to Kie.ai
as a discrete clip. The Kie.ai orchestrator stitches clips on the audio
timeline. See [kie-render.md](./kie-render.md).
