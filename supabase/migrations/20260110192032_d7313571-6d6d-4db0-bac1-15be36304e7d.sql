-- Create storage buckets for UGC ad generator
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('ugc-generated', 'ugc-generated', true) ON CONFLICT (id) DO NOTHING;

-- Storage policies for product-images bucket
CREATE POLICY "Users can upload their own product images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Anyone can view product images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "Users can delete their own product images" ON storage.objects FOR DELETE USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for ugc-generated bucket
CREATE POLICY "Anyone can view generated ads" ON storage.objects FOR SELECT USING (bucket_id = 'ugc-generated');
CREATE POLICY "Service role can upload generated ads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'ugc-generated');