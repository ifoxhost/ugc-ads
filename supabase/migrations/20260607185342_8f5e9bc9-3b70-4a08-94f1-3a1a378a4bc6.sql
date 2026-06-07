
CREATE TABLE public.video_scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid NOT NULL,
  user_id uuid NOT NULL,
  index integer NOT NULL,
  lyric_lines text[] NOT NULL DEFAULT '{}',
  start_sec numeric NOT NULL DEFAULT 0,
  end_sec numeric NOT NULL DEFAULT 0,
  prompt jsonb NOT NULL DEFAULT '{}'::jsonb,
  image_url text,
  image_status text NOT NULL DEFAULT 'pending',
  regen_count integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT video_scenes_status_chk CHECK (image_status IN ('pending','generating','ready','failed')),
  CONSTRAINT video_scenes_unique_idx UNIQUE (ad_id, index)
);

CREATE INDEX idx_video_scenes_ad_id ON public.video_scenes(ad_id);
CREATE INDEX idx_video_scenes_user_id ON public.video_scenes(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_scenes TO authenticated;
GRANT ALL ON public.video_scenes TO service_role;

ALTER TABLE public.video_scenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own scenes"   ON public.video_scenes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own scenes" ON public.video_scenes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own scenes" ON public.video_scenes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own scenes" ON public.video_scenes FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all scenes"  ON public.video_scenes FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_video_scenes_updated_at
BEFORE UPDATE ON public.video_scenes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.video_scenes;
ALTER TABLE public.video_scenes REPLICA IDENTITY FULL;
