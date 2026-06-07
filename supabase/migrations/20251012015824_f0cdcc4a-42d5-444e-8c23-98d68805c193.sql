-- Add RLS policies for video-references bucket to allow uploads
CREATE POLICY "Users can upload to video-references bucket"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'video-references');

CREATE POLICY "Users can view video-references"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'video-references');

CREATE POLICY "Users can update their uploads in video-references"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'video-references');

CREATE POLICY "Users can delete their uploads in video-references"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'video-references');