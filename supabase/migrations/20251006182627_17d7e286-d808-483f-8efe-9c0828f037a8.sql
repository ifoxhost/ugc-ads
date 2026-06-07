-- Add UPDATE policy for video_generations so webhook can update and users can retry
CREATE POLICY "Users can update their own video generations"
ON video_generations
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add UPDATE policy for image_generations so users can retry
CREATE POLICY "Users can update their own image generations"
ON image_generations
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add UPDATE policy for audio_generations so users can retry
CREATE POLICY "Users can update their own audio generations"
ON audio_generations
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);