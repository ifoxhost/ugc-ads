# Audio Transcription

## Purpose
Produce word-level timings so storyboard scenes can be aligned to the song
and so the renderer can place lyric typography on the beat.

## Provider chain (with fallback)
1. **ElevenLabs Scribe via Kie.ai** — `POST https://api.kie.ai/v1/audio/transcribe`
   with `{ provider: "elevenlabs", audioUrl, model: "scribe_v1" }`.
   Secret: `KIE_AI_API_KEY`.
2. **ElevenLabs direct** — multipart upload to
   `https://api.elevenlabs.io/v1/speech-to-text`, `model_id=scribe_v1`.
   Secret: `ELEVENLABS_API_KEY`.
3. **OpenAI Whisper-1** — multipart upload to
   `https://api.openai.com/v1/audio/transcriptions`,
   `response_format=verbose_json`. Secret: `OPENAI_API_KEY`.

The orchestrator tries them in order and stores the first successful response
on `generated_ads.ad_copy.transcription`. If all three fail, the pipeline
continues without word timing and notes `transcription.error`.

## Called from
`supabase/functions/_shared/pipeline.ts → runTranscription()`.
