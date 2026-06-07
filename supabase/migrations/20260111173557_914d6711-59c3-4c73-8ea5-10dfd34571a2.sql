-- Add video generation tracking fields to generated_ads table
ALTER TABLE public.generated_ads
ADD COLUMN IF NOT EXISTS video_duration integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS video_status text DEFAULT 'idle' CHECK (video_status IN ('idle', 'queued', 'processing', 'retrying', 'complete', 'failed')),
ADD COLUMN IF NOT EXISTS video_task_id text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS video_retry_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS video_last_checked_at timestamp with time zone DEFAULT NULL;

-- Add index for efficient polling queries
CREATE INDEX IF NOT EXISTS idx_generated_ads_video_status ON public.generated_ads(video_status) WHERE video_status IN ('queued', 'processing', 'retrying');

-- Add index for task ID lookups
CREATE INDEX IF NOT EXISTS idx_generated_ads_video_task_id ON public.generated_ads(video_task_id) WHERE video_task_id IS NOT NULL;