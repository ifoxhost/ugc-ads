-- Create generated_ads table for the UGC Ad Generator
CREATE TABLE public.generated_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  product_image_url TEXT NOT NULL,
  generated_image_url TEXT,
  generated_video_url TEXT,
  style_template TEXT NOT NULL,
  prompt_used TEXT,
  ad_copy JSONB,
  aspect_ratio TEXT DEFAULT '1:1',
  status TEXT NOT NULL DEFAULT 'processing',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  email TEXT NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.generated_ads ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own ads" 
ON public.generated_ads 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own ads" 
ON public.generated_ads 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ads" 
ON public.generated_ads 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ads" 
ON public.generated_ads 
FOR DELETE 
USING (auth.uid() = user_id);

-- Admin access
CREATE POLICY "Admins can view all ads" 
ON public.generated_ads 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.generated_ads;