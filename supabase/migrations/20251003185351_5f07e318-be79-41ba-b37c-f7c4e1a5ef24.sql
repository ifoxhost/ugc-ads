-- Create audio_generations table
CREATE TABLE public.audio_generations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  voice_script TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  voice_name TEXT NOT NULL,
  duration TEXT NOT NULL,
  generated_audio_url TEXT,
  reference_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'processing',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.audio_generations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own audio generations"
ON public.audio_generations
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own audio generations"
ON public.audio_generations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own audio generations"
ON public.audio_generations
FOR DELETE
USING (auth.uid() = user_id);