-- Add DELETE policy for notification_preferences to allow users to delete their own preferences
CREATE POLICY "Users can delete their own preferences"
ON public.notification_preferences
FOR DELETE
USING (auth.uid() = user_id);