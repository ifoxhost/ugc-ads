# Pexels Gallery

## Purpose
Provide an optional, royalty-free b-roll background for the lyric overlay
when the user doesn't want an AI-rendered backdrop.

## UI
- `src/components/lyric/PexelsBackgroundPicker.tsx`
- `src/components/lyric/PexelsGallery.tsx`

## Edge function
`supabase/functions/pexels-search/index.ts`

- Reads `PEXELS_API_KEY` from secrets.
- Accepts `{ query, orientation, perPage }`.
- Returns normalized `{ id, src, thumbnail, type: 'photo' | 'video', author }`.

## Selection
The chosen `pexelsBackgroundUrl` is forwarded to `submit-lyric-video`,
which puts it into the Kie.ai `params.pexelsBackgroundUrl` so the
render workflow can layer the lyric typography on top of the b-roll
instead of an AI-generated scene.

Pexels is **only** used as background source — never as a substitute for
storyboard frames (those must come from Nano Banana).
