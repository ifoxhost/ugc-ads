-- Create video_generations table
CREATE TABLE public.video_generations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  video_description TEXT NOT NULL,
  reference_image_url TEXT,
  generated_video_url TEXT,
  status TEXT NOT NULL DEFAULT 'processing',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE public.video_generations ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own video generations"
ON public.video_generations
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own video generations"
ON public.video_generations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own video generations"
ON public.video_generations
FOR DELETE
USING (auth.uid() = user_id);

-- Create storage bucket for video reference images
INSERT INTO storage.buckets (id, name, public)
VALUES ('video-references', 'video-references', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for video reference images
CREATE POLICY "Users can upload their own video reference images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'video-references' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Video reference images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'video-references');