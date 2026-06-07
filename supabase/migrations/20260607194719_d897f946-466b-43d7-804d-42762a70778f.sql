ALTER TABLE public.generated_ads DROP CONSTRAINT IF EXISTS generated_ads_video_status_check;
ALTER TABLE public.generated_ads ADD CONSTRAINT generated_ads_video_status_check
  CHECK (video_status = ANY (ARRAY['idle','queued','processing','retrying','rendering','fetching','saving','complete','completed','failed']));

UPDATE public.generated_ads
SET status='completed',
    video_status='completed',
    video_progress=100,
    generated_video_url='https://tempfile.aiquickdraw.com/k/3fb72318002c2e59c4303bb48811d30f_1_1780861193_4270.mp4',
    completed_at=now()
WHERE id='32178778-20a8-45c9-8464-4c1de753aa6e';