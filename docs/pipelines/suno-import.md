# Suno Import & Lyrics

## Purpose
Parse a Suno share link or pasted lyrics into `{ songTitle, artist, lyrics,
audioFileUrl, duration }`. This becomes the input to the orchestrator (see
[orchestrator.md](./orchestrator.md)).

## UI
`src/components/lyric/SunoLinkParser.tsx` + `LyricEditor.tsx`.

## Edge function
`supabase/functions/suno-parse/index.ts` — fetches the Suno page and extracts
title, artist, lyrics, and the public mp3 URL. Falls back to manual paste when
parsing fails.

## Downstream
- `lyrics` → OpenAI `gpt-4o` script stage
- `audioFileUrl` → transcription stage (ElevenLabs/Kie → Whisper)
- `duration` → used to time scenes
