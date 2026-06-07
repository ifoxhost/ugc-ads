-- Create ugc_requests table for queuing and tracking
CREATE TABLE public.ugc_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  request_data JSONB NOT NULL,
  result_url TEXT,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.ugc_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own requests"
ON public.ugc_requests
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own requests"
ON public.ugc_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all requests"
ON public.ugc_requests
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can update requests"
ON public.ugc_requests
FOR UPDATE
USING (true);

-- Create index for efficient queries
CREATE INDEX idx_ugc_requests_user_id ON public.ugc_requests(user_id);
CREATE INDEX idx_ugc_requests_status ON public.ugc_requests(status);
CREATE INDEX idx_ugc_requests_created_at ON public.ugc_requests(created_at DESC);

-- Create trigger for updated_at
CREATE TRIGGER update_ugc_requests_updated_at
BEFORE UPDATE ON public.ugc_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();