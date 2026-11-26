DROP POLICY IF EXISTS "Deny anonymous delete on generated_ads" ON public.generated_ads;
DROP POLICY IF EXISTS "Deny anonymous insert on generated_ads" ON public.generated_ads;
DROP POLICY IF EXISTS "Deny anonymous update on generated_ads" ON public.generated_ads;
DROP POLICY IF EXISTS "Deny anonymous access to user_sessions" ON public.user_sessions;

DROP POLICY IF EXISTS "Authenticated users can upload generated images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload generated ads" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to video-references bucket" ON storage.objects;

CREATE POLICY "Users upload own generated images" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'generated-images' AND (storage.foldername(name))[1] = (select auth.uid()::text));
CREATE POLICY "Users upload own generated ads" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ugc-generated' AND (storage.foldername(name))[1] = (select auth.uid()::text));
CREATE POLICY "Users upload own video references" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'video-references' AND (storage.foldername(name))[1] = (select auth.uid()::text));