-- Add subscription_expiry_notifications column to notification_preferences
ALTER TABLE public.notification_preferences 
ADD COLUMN IF NOT EXISTS subscription_expiry_notifications BOOLEAN NOT NULL DEFAULT true;