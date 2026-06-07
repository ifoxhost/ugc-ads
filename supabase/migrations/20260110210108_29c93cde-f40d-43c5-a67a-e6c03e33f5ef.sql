-- Add new notification preference columns
ALTER TABLE public.notification_preferences
ADD COLUMN weekly_digest BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN feature_announcements BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN marketing_emails BOOLEAN NOT NULL DEFAULT false;