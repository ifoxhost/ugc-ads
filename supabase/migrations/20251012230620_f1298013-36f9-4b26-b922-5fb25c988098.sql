-- Enable realtime for video and audio generation tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_generations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audio_generations;