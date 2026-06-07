import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature',
};

// SECURITY: Generate HMAC signature for webhook verification
async function generateSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );
  
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const webhookSecret = Deno.env.get('N8N_WEBHOOK_SECRET');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Read the raw body for signature verification
    const payloadText = await req.text();
    
    // SECURITY: Verify webhook signature if secret is configured
    if (webhookSecret) {
      const providedSignature = req.headers.get('x-webhook-signature');
      
      if (!providedSignature) {
        console.error('Missing webhook signature');
        return new Response(
          JSON.stringify({ error: 'Missing webhook signature' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const expectedSignature = await generateSignature(payloadText, webhookSecret);
      
      if (providedSignature !== expectedSignature) {
        console.error('Invalid webhook signature');
        return new Response(
          JSON.stringify({ error: 'Invalid webhook signature' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('Webhook signature verified successfully');
    } else {
      console.warn('WARNING: N8N_WEBHOOK_SECRET not configured - webhook is unprotected!');
    }

    const payload = JSON.parse(payloadText);
    
    console.log('=== VIDEO PROGRESS UPDATE RECEIVED ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Payload:', JSON.stringify(payload));

    // Extract progress data from n8n webhook
    const {
      adId,
      ad_id,
      taskId,
      task_id,
      progress,
      percentage,
      status,
      message,
      step,
    } = payload;

    const videoAdId = adId || ad_id || payload.generatedAdId || payload.generated_ad_id;
    const videoTaskId = taskId || task_id || payload.video_task_id;
    const progressValue = progress ?? percentage ?? 0;
    const statusValue = status || (progressValue >= 100 ? 'complete' : 'processing');

    // Find the video ad to update
    let targetAdId = videoAdId;
    
    if (!targetAdId && videoTaskId) {
      const { data: taskAd } = await supabase
        .from('generated_ads')
        .select('id')
        .eq('video_task_id', videoTaskId)
        .maybeSingle();
      if (taskAd) targetAdId = taskAd.id;
    }

    if (!targetAdId) {
      console.error('No ad ID or task ID provided for progress update');
      return new Response(
        JSON.stringify({ error: 'Missing adId or taskId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Updating video ad ${targetAdId} with progress: ${progressValue}%`);

    // Update the video progress
    const updateData: Record<string, unknown> = {
      video_progress: Math.min(Math.max(Math.round(progressValue), 0), 100),
      video_last_checked_at: new Date().toISOString(),
    };

    // Update video_status if transitioning
    if (statusValue === 'processing' || statusValue === 'rendering') {
      updateData.video_status = 'processing';
    }

    const { data: updatedAd, error: updateError } = await supabase
      .from('generated_ads')
      .update(updateData)
      .eq('id', targetAdId)
      .select('id, video_progress, video_status')
      .single();

    if (updateError) {
      console.error('Failed to update video progress:', updateError);
      throw updateError;
    }

    console.log('Video progress updated successfully:', updatedAd);

    return new Response(
      JSON.stringify({ 
        success: true, 
        adId: targetAdId,
        progress: updatedAd.video_progress,
        message: message || `Video rendering: ${progressValue}%`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Video progress update error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
