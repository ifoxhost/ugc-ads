# Audio Transcription

## When it runs
Only when the user uploads audio (or Suno didn't expose lyrics) and the
`lyrics` field is empty.

## Provider
OpenAI (Whisper) via Lovable AI Gateway. No third-party transcription
service is allowed — Suno / OpenAI / Pexels are the only non-Kie.ai
external services in the pipeline.

## Steps
1. Client uploads audio to the `video-references` Supabase storage bucket.
2. Edge function fetches the audio and forwards it to OpenAI Whisper.
3. Response (`segments[]` with timestamps) is reduced to:
   ```
   [00:14.20] First line of lyrics
   [00:18.05] Second line
   ...
   ```
4. The timestamped lyric block populates `LyricVideoFormData.lyrics`
   and is used by Kie.ai to time clip transitions on the beat.
