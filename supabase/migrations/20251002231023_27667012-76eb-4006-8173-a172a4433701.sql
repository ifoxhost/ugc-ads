-- Create storage bucket for generated images
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-images', 'generated-images', true);

-- Create RLS policies for the bucket
CREATE POLICY "Users can view all generated images"
ON storage.objects FOR SELECT
USING (bucket_id = 'generated-images');

CREATE POLICY "Authenticated users can upload generated images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'generated-images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete their own generated images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'generated-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);