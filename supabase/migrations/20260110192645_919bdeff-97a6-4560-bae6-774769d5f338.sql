-- Fix the overly permissive storage policy for ugc-generated bucket
DROP POLICY IF EXISTS "Service role can upload generated ads" ON storage.objects;

-- Create proper policy - only allow authenticated users to upload to ugc-generated
CREATE POLICY "Authenticated users can upload generated ads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'ugc-generated');

-- Allow users to delete their own generated ads
CREATE POLICY "Users can delete their own generated ads"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'ugc-generated' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- Fix video-references delete policy to be more restrictive
DROP POLICY IF EXISTS "Users can delete their uploads in video-references" ON storage.objects;
CREATE POLICY "Users can delete their own video references"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'video-references' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- Fix video-references update policy to be more restrictive
DROP POLICY IF EXISTS "Users can update their uploads in video-references" ON storage.objects;
CREATE POLICY "Users can update their own video references"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'video-references' AND (auth.uid())::text = (storage.foldername(name))[1]);