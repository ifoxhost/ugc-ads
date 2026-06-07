# Suno Import + Lyrics

## UI
`src/components/lyric/SunoLinkParser.tsx` — user pastes a `https://suno.com/song/<id>` URL.

## Edge function
`supabase/functions/suno-parse/index.ts`

1. Extracts the song id from the URL.
2. Calls Suno's public song endpoint (no API key required for shared songs).
3. Returns:
   - `title`, `artist`, `coverImage`
   - `audioUrl` (MP3 stream) — re-hosted client-side if needed
   - `lyrics` (when available)
   - `genre`, `duration`, `bpm` (best effort)

## Fallback
If Suno does not expose lyrics for a track, the form prompts the user to:
- paste lyrics manually, **or**
- upload the audio for OpenAI Whisper transcription
  (see [audio-transcription.md](./audio-transcription.md)).

## Output contract → `LyricVideoFormData`
```ts
{
  songTitle: string;
  artist: string;
  lyrics: string;
  audioFileUrl: string | null;  // direct Suno mp3 URL
  bpm: number;
}
```
No mock data — the form only populates from a real `suno-parse` response.
