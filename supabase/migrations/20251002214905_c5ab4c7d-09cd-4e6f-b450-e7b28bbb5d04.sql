-- Allow users to delete their own image generations
CREATE POLICY "Users can delete their own generations"
ON public.image_generations
FOR DELETE
USING (auth.uid() = user_id);