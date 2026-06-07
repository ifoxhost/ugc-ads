-- Drop the existing SELECT policies that are incorrectly configured
DROP POLICY IF EXISTS "Users can view their own ads" ON public.generated_ads;
DROP POLICY IF EXISTS "Users can view their own deleted ads" ON public.generated_ads;
DROP POLICY IF EXISTS "Admins can view all ads" ON public.generated_ads;
DROP POLICY IF EXISTS "Deny anonymous access to generated_ads" ON public.generated_ads;

-- Recreate as PERMISSIVE policies (using OR logic)
-- Users can only see their own non-deleted ads
CREATE POLICY "Users can view their own ads" 
ON public.generated_ads 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Users can only see their own deleted ads (for trash view)
CREATE POLICY "Users can view their own deleted ads" 
ON public.generated_ads 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id AND deleted_at IS NOT NULL);

-- Admins can view all ads (separate permissive policy)
CREATE POLICY "Admins can view all ads" 
ON public.generated_ads 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));