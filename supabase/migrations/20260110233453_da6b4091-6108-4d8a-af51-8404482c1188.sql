-- Add UPDATE policy for user_prompt_presets
CREATE POLICY "Users can update their own presets"
ON public.user_prompt_presets
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);