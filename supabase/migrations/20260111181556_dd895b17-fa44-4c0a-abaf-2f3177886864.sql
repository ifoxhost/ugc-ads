-- Add video_status_emails column to notification_preferences table
ALTER TABLE public.notification_preferences
ADD COLUMN video_status_emails BOOLEAN NOT NULL DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.notification_preferences.video_status_emails IS 'Whether to receive email notifications for video generation success/failure';