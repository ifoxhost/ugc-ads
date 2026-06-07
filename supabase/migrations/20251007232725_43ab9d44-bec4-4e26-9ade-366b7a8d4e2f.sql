-- Add generated_images column to video_generations table
ALTER TABLE public.video_generations 
ADD COLUMN generated_images jsonb DEFAULT '[]'::jsonb;