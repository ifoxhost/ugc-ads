-- Create bucket for voice previews
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-previews', 'voice-previews', true)
ON CONFLICT (id) DO NOTHING;