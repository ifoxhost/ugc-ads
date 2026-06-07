
ALTER TABLE public.video_scenes ADD COLUMN IF NOT EXISTS failed_step text;

CREATE TABLE IF NOT EXISTS public.cleanup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  success boolean NOT NULL DEFAULT false,
  ref_ttl_days integer,
  img_ttl_days integer,
  refs_scanned integer NOT NULL DEFAULT 0,
  imgs_scanned integer NOT NULL DEFAULT 0,
  refs_deleted integer NOT NULL DEFAULT 0,
  imgs_deleted integer NOT NULL DEFAULT 0,
  live_imgs integer NOT NULL DEFAULT 0,
  error_message text,
  triggered_by text NOT NULL DEFAULT 'cron'
);

GRANT SELECT ON public.cleanup_runs TO authenticated;
GRANT ALL ON public.cleanup_runs TO service_role;

ALTER TABLE public.cleanup_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view cleanup runs"
  ON public.cleanup_runs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_cleanup_runs_started_at ON public.cleanup_runs (started_at DESC);
