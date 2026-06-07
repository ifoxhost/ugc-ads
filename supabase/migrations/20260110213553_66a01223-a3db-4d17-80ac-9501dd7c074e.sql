-- Add restrictive policies to deny anonymous access to profiles table
CREATE POLICY "Deny anonymous access to profiles"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Add restrictive policies to deny anonymous access to generated_ads table  
CREATE POLICY "Deny anonymous access to generated_ads"
ON public.generated_ads
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Also protect INSERT/UPDATE/DELETE on generated_ads from anonymous users
CREATE POLICY "Deny anonymous insert on generated_ads"
ON public.generated_ads
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Deny anonymous update on generated_ads"
ON public.generated_ads
FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Deny anonymous delete on generated_ads"
ON public.generated_ads
FOR DELETE
USING (auth.uid() IS NOT NULL);