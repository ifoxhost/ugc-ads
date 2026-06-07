-- Create image_generations table to track UGC image requests
CREATE TABLE public.image_generations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  image_description TEXT NOT NULL,
  reference_image_url TEXT,
  generated_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'processing',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE public.image_generations ENABLE ROW LEVEL SECURITY;

-- Users can view their own generations
CREATE POLICY "Users can view their own generations"
ON public.image_generations
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own generations
CREATE POLICY "Users can insert their own generations"
ON public.image_generations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_image_generations_user_id ON public.image_generations(user_id);
CREATE INDEX idx_image_generations_status ON public.image_generations(status);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.image_generations;