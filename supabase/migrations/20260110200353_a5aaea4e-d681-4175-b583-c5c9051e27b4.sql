-- Add deleted_at column for soft deletes
ALTER TABLE public.generated_ads 
ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;

-- Create index for faster queries on non-deleted ads
CREATE INDEX idx_generated_ads_deleted_at ON public.generated_ads(deleted_at);

-- Update RLS policies to handle soft-deleted ads
-- Users can only view their own non-deleted ads (update existing policy)
DROP POLICY IF EXISTS "Users can view their own ads" ON public.generated_ads;
CREATE POLICY "Users can view their own ads" 
ON public.generated_ads 
FOR SELECT 
USING (auth.uid() = user_id AND deleted_at IS NULL);

-- New policy: Users can view their own deleted ads (for trash page)
CREATE POLICY "Users can view their own deleted ads" 
ON public.generated_ads 
FOR SELECT 
USING (auth.uid() = user_id AND deleted_at IS NOT NULL);

-- Admins can view all ads including deleted
DROP POLICY IF EXISTS "Admins can view all ads" ON public.generated_ads;
CREATE POLICY "Admins can view all ads" 
ON public.generated_ads 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));