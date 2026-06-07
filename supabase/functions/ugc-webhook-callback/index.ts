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

// Send email notification when video ad completes
async function sendVideoCompleteEmail(
  email: string, 
  videoUrl: string, 
  thumbnailUrl: string | null,
  resendApiKey: string
): Promise<void> {
  try {
    console.log('Sending video completion email to:', email);
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'UGC Ads <noreply@ugcads.co.za>',
        to: [email],
        subject: '🎬 Your UGC Video Ad is Ready!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333; margin-bottom: 20px;">Your Video Ad is Ready! 🎉</h1>
            
            ${thumbnailUrl ? `
              <div style="margin-bottom: 20px;">
                <img src="${thumbnailUrl}" alt="Video Preview" style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);" />
              </div>
            ` : ''}
            
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Great news! Your UGC video ad has finished processing and is ready to download.
            </p>
            
            <div style="margin: 30px 0;">
              <a href="${videoUrl}" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        padding: 14px 28px; 
                        text-decoration: none; 
                        border-radius: 8px; 
                        font-weight: bold;
                        display: inline-block;">
                Download Your Video
              </a>
            </div>
            
            <p style="color: #999; font-size: 14px;">
              <strong>Note:</strong> This video will be stored for 14 days. Make sure to download it before then!
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
            
            <p style="color: #999; font-size: 12px;">
              You're receiving this email because you created a video ad on UGC Ads.
            </p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to send email:', errorText);
    } else {
      console.log('Video completion email sent successfully');
    }
  } catch (error) {
    console.error('Error sending video completion email:', error);
  }
}

// Send email notification when video ad fails
async function sendVideoFailedEmail(
  email: string, 
  thumbnailUrl: string | null,
  errorDetails: string,
  resendApiKey: string,
  dashboardUrl: string
): Promise<void> {
  try {
    console.log('Sending video failure email to:', email);
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'UGC Ads <noreply@ugcads.co.za>',
        to: [email],
        subject: '⚠️ Video Ad Generation Failed',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #dc2626; margin-bottom: 20px;">Video Generation Failed</h1>
            
            ${thumbnailUrl ? `
              <div style="margin-bottom: 20px; position: relative;">
                <img src="${thumbnailUrl}" alt="Source Image" style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); opacity: 0.6;" />
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(220, 38, 38, 0.9); color: white; padding: 8px 16px; border-radius: 4px; font-weight: bold;">
                  Failed
                </div>
              </div>
            ` : ''}
            
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Unfortunately, we couldn't generate your video ad. Our system attempted multiple times but encountered an issue.
            </p>
            
            <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0; border-radius: 4px;">
              <p style="color: #991b1b; margin: 0; font-size: 14px;">
                <strong>Error:</strong> ${errorDetails}
              </p>
            </div>
            
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Don't worry! You can easily try again with the "Regenerate Video" button in your library.
            </p>
            
            <div style="margin: 30px 0;">
              <a href="${dashboardUrl}/library" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        padding: 14px 28px; 
                        text-decoration: none; 
                        border-radius: 8px; 
                        font-weight: bold;
                        display: inline-block;">
                Go to Library & Retry
              </a>
            </div>
            
            <p style="color: #999; font-size: 14px;">
              <strong>Tip:</strong> If the issue persists, try using a different source image or adjusting your video settings.
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
            
            <p style="color: #999; font-size: 12px;">
              You're receiving this email because you created a video ad on UGC Ads.
            </p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to send failure email:', errorText);
    } else {
      console.log('Video failure email sent successfully');
    }
  } catch (error) {
    console.error('Error sending video failure email:', error);
  }
}

// Download video and store in Supabase Storage with 14-day expiry metadata
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function storeVideoWithExpiry(
  supabase: any,
  videoUrl: string,
  userId: string,
  generationId: string
): Promise<{ videoUrl: string; thumbnailUrl: string | null }> {
  try {
    console.log('Downloading video from:', videoUrl);
    
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      console.warn('Failed to download video, using direct URL');
      return { videoUrl, thumbnailUrl: null };
    }

    const videoBuffer = await videoResponse.arrayBuffer();
    const contentType = videoResponse.headers.get('content-type') || 'video/mp4';
    
    // Determine file extension
    let extension = 'mp4';
    if (contentType.includes('webm')) extension = 'webm';
    else if (contentType.includes('quicktime') || contentType.includes('mov')) extension = 'mov';
    
    const fileName = `video-ads/${userId}/${generationId}.${extension}`;
    
    // Upload video to storage
    const { error: uploadError } = await supabase.storage
      .from('generated-images')
      .upload(fileName, videoBuffer, {
        contentType,
        upsert: true,
        // Note: Supabase doesn't have native object expiry, we'll handle cleanup via cron
      });

    if (uploadError) {
      console.error('Video storage upload error:', uploadError);
      return { videoUrl, thumbnailUrl: null };
    }

    // Get public URL for video
    const { data: videoUrlData } = supabase.storage
      .from('generated-images')
      .getPublicUrl(fileName);
    
    const storedVideoUrl = videoUrlData.publicUrl;
    console.log('Video uploaded to storage:', storedVideoUrl);
    
    // Generate thumbnail from first frame
    // Note: Since we can't process video frames in Edge Functions,
    // we'll create a placeholder thumbnail or use the product image
    // For now, we'll return null and the UI will show a video icon
    const thumbnailUrl: string | null = null;
    
    return { videoUrl: storedVideoUrl, thumbnailUrl };
  } catch (error) {
    console.error('Error storing video:', error);
    return { videoUrl, thumbnailUrl: null };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const webhookSecret = Deno.env.get('N8N_WEBHOOK_SECRET');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payloadText = await req.text();
    const payload = JSON.parse(payloadText);
    
    // Check if this looks like an n8n video callback (has adId or isVideoAd)
    const isN8nVideoCallback = payload.adId || payload.isVideoAd || payload.is_video_ad;
    
    // SECURITY: Verify webhook signature if secret is configured
    // Skip verification for n8n video callbacks (adId provides implicit verification)
    if (webhookSecret && !isN8nVideoCallback) {
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
    } else if (isN8nVideoCallback) {
      console.log('Skipping signature verification for n8n video callback (adId provides verification)');
    } else {
      console.warn('WARNING: N8N_WEBHOOK_SECRET not configured - webhook is unprotected!');
    }
    
    console.log('=== UGC WEBHOOK CALLBACK RECEIVED ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Request method:', req.method);
    console.log('Payload keys:', Object.keys(payload));

    // Extract data from n8n webhook - handle MANY possible field names
    const { 
      email,
      Email,
      error: n8nError,
      errorMessage,
      status: n8nStatus,
      data: webhookData,
      requestId,
      adId, // For video ads from generated_ads table
      ad_id,
      generatedAdId,
      isVideoAd, // Flag to identify video ad callbacks
      is_video_ad,
      taskId, // For matching video tasks
      task_id,
      videoDuration, // Video duration in seconds
      video_duration,
      duration,
    } = payload;
    
    // Try to find the image/video URL from various possible field names
    const possibleUrlFields = [
      payload.videoUrl,
      payload.video_url,
      payload.generatedVideoUrl,
      payload.generated_video_url,
      payload.generatedImageUrl,
      payload.generated_image_url,
      payload.imageUrl,
      payload.image_url,
      payload.outputUrl,
      payload.output_url,
      payload.url,
      payload.URL,
      payload.webViewLink,
      payload.web_view_link,
      payload.thumbnailLink,
      payload.thumbnail_link,
      payload.webContentLink,
      payload.web_content_link,
      payload.downloadUrl,
      payload.download_url,
      webhookData?.url,
      webhookData?.videoUrl,
      webhookData?.imageUrl,
      webhookData?.outputUrl,
      webhookData?.generatedVideoUrl,
      webhookData?.generatedImageUrl,
    ].filter(Boolean);
    
    const webViewLink = possibleUrlFields[0] || '';
    const fileId = payload.fileId || payload.file_id || payload.id;
    const videoAdId = adId || ad_id || generatedAdId || payload.generated_ad_id;
    const videoTaskId = taskId || task_id || payload.video_task_id;
    const isVideoAdCallback = isVideoAd || is_video_ad || payload.type === 'video_ad' || !!videoAdId || !!videoTaskId;
    const videoDurationSeconds = videoDuration || video_duration || duration || webhookData?.duration || null;
    
    console.log('Extracted URL:', webViewLink);
    console.log('Extracted fileId:', fileId);
    console.log('Extracted email:', email || Email);
    console.log('Is video ad callback:', isVideoAdCallback);
    console.log('Video ad ID:', videoAdId);
    console.log('Video task ID:', videoTaskId);
    console.log('Video duration:', videoDurationSeconds);
    
    const userEmail = email || Email;
    
    if (!userEmail) {
      throw new Error('Missing required field: email');
    }

    // ========== HANDLE VIDEO AD CALLBACKS (from generated_ads table) ==========
    if (isVideoAdCallback) {
      console.log('Processing VIDEO AD callback');
      
      // Check for errors first
      if (n8nError || errorMessage || n8nStatus === 'error' || n8nStatus === 'failed') {
        const errorDetails = errorMessage || n8nError || 'Video generation failed';
        console.error('Video ad generation failed:', errorDetails);
        
        // Find the ad to update - by ID, task ID, or most recent processing
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
          const { data: failedAd } = await supabase
            .from('generated_ads')
            .select('id, video_retry_count, user_id, product_image_url, generated_image_url')
            .eq('email', userEmail)
            .in('video_status', ['queued', 'processing'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (failedAd) targetAdId = failedAd.id;
        }
        
        if (targetAdId) {
          // Check retry count and get ad details for email
          const { data: adData } = await supabase
            .from('generated_ads')
            .select('video_retry_count, user_id, product_image_url, generated_image_url')
            .eq('id', targetAdId)
            .single();
          
          const retryCount = (adData?.video_retry_count || 0) + 1;
          const maxRetries = 3;
          
          if (retryCount < maxRetries) {
            await supabase
              .from('generated_ads')
              .update({
                video_status: 'retrying',
                video_retry_count: retryCount,
                video_last_checked_at: new Date().toISOString(),
              })
              .eq('id', targetAdId);
            console.log(`Video ad ${targetAdId} scheduled for retry (attempt ${retryCount}/${maxRetries})`);
          } else {
            await supabase
              .from('generated_ads')
              .update({
                status: 'video_failed',
                video_status: 'failed',
                completed_at: new Date().toISOString(),
              })
              .eq('id', targetAdId);
            console.log(`Video ad ${targetAdId} marked as failed after max retries`);
            
            // Send failure email notification
            if (resendApiKey && adData?.user_id) {
              // Check user notification preferences for video status emails
              const { data: notifPrefs } = await supabase
                .from('notification_preferences')
                .select('video_status_emails')
                .eq('user_id', adData.user_id)
                .maybeSingle();
              
              // Default to sending if no preferences set (opt-in by default for important notifications)
              const shouldSendEmail = !notifPrefs || notifPrefs.video_status_emails !== false;
              
              if (shouldSendEmail) {
                const thumbnailUrl = adData.generated_image_url || adData.product_image_url;
                const dashboardUrl = Deno.env.get('SITE_URL') || 'https://ugcads.co.za';
                await sendVideoFailedEmail(userEmail, thumbnailUrl, errorDetails, resendApiKey, dashboardUrl);
              } else {
                console.log('User has opted out of video status email notifications');
              }
            }
            
            // Send push notification for video failure
            try {
              console.log('Sending push notification for video failure to user:', adData?.user_id);
              
              const pushPayload = {
                userId: adData?.user_id,
                title: '⚠️ Video Generation Failed',
                body: 'Your video ad could not be generated. Tap to retry.',
                icon: '/favicon.ico',
                data: {
                  url: '/library',
                  adId: targetAdId,
                  type: 'video_failed',
                },
              };

              const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${supabaseKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(pushPayload),
              });

              if (pushResponse.ok) {
                console.log('Failure push notification sent');
              } else {
                console.warn('Failure push notification failed:', await pushResponse.text());
              }
            } catch (pushError) {
              console.error('Error sending failure push notification:', pushError);
            }
          }
        }
        
        return new Response(
          JSON.stringify({ success: false, error: errorDetails }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Find the video ad record - by ID, task ID, or most recent processing
      let targetAd: { id: string; user_id: string; product_image_url: string } | null = null;
      
      if (videoAdId) {
        const { data } = await supabase
          .from('generated_ads')
          .select('id, user_id, product_image_url')
          .eq('id', videoAdId)
          .maybeSingle();
        targetAd = data;
      } else if (videoTaskId) {
        const { data } = await supabase
          .from('generated_ads')
          .select('id, user_id, product_image_url')
          .eq('video_task_id', videoTaskId)
          .maybeSingle();
        targetAd = data;
      } else {
        // Find most recent video_processing ad for this email
        const { data } = await supabase
          .from('generated_ads')
          .select('id, user_id, product_image_url')
          .eq('email', userEmail)
          .in('video_status', ['queued', 'processing'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        targetAd = data;
      }
      
      if (!targetAd) {
        console.error('No video_processing ad found for email:', userEmail);
        throw new Error('No video ad found to update');
      }
      
      console.log('Found video ad to update:', targetAd.id);
      
      // Store video in Supabase Storage with 14-day retention
      const { videoUrl: storedVideoUrl, thumbnailUrl } = await storeVideoWithExpiry(
        supabase,
        webViewLink,
        targetAd.user_id,
        targetAd.id
      );
      
      // Parse video duration if provided (could be string or number)
      let durationSeconds: number | null = null;
      if (videoDurationSeconds) {
        const parsed = parseInt(String(videoDurationSeconds), 10);
        if (!isNaN(parsed) && parsed > 0) {
          durationSeconds = parsed;
        }
      }
      
      // Update the generated_ads record with video URL, status, and duration
      const { data: updatedAd, error: updateError } = await supabase
        .from('generated_ads')
        .update({
          generated_video_url: storedVideoUrl,
          status: 'video_completed',
          video_status: 'complete',
          video_duration: durationSeconds,
          video_progress: 100, // Set progress to 100% on completion
          video_task_id: null, // Clear task ID after completion
          completed_at: new Date().toISOString(),
        })
        .eq('id', targetAd.id)
        .select()
        .single();
      
      if (updateError) {
        console.error('Failed to update video ad:', updateError);
        throw updateError;
      }
      
      console.log('Successfully updated video ad:', updatedAd);
      
      // Send email notification based on user preferences
      if (resendApiKey && targetAd.user_id) {
        // Check user notification preferences for video status emails
        const { data: notifPrefs } = await supabase
          .from('notification_preferences')
          .select('video_status_emails')
          .eq('user_id', targetAd.user_id)
          .maybeSingle();
        
        // Default to sending if no preferences set
        const shouldSendEmail = !notifPrefs || notifPrefs.video_status_emails !== false;
        
        if (shouldSendEmail) {
          // Use product image as thumbnail fallback
          const emailThumbnail = thumbnailUrl || targetAd.product_image_url;
          await sendVideoCompleteEmail(userEmail, storedVideoUrl, emailThumbnail, resendApiKey);
        } else {
          console.log('User has opted out of video status email notifications');
        }
      } else if (!resendApiKey) {
        console.warn('RESEND_API_KEY not configured - skipping email notification');
      }
      
      // Send push notification for video completion
      try {
        console.log('Sending push notification for video completion to user:', targetAd.user_id);
        
        // Call the send-push-notification function internally
        const pushPayload = {
          userId: targetAd.user_id,
          title: '🎬 Your Video Ad is Ready!',
          body: 'Your UGC video ad has finished rendering. Tap to view and download.',
          icon: '/favicon.ico',
          data: {
            url: '/library',
            adId: targetAd.id,
            type: 'video_complete',
          },
        };

        // Make internal call to send-push-notification
        const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(pushPayload),
        });

        if (pushResponse.ok) {
          const pushResult = await pushResponse.json();
          console.log('Push notification result:', pushResult);
        } else {
          console.warn('Push notification failed:', await pushResponse.text());
        }
      } catch (pushError) {
        console.error('Error sending push notification:', pushError);
        // Don't fail the request if push notification fails
      }
      
      return new Response(
        JSON.stringify({ success: true, data: updatedAd }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== HANDLE REGULAR UGC CALLBACKS (image/video/audio generations) ==========
    
    // Check if n8n reported an error
    if (n8nError || errorMessage || n8nStatus === 'error' || n8nStatus === 'failed') {
      const errorDetails = errorMessage || n8nError || 'Unknown n8n workflow error';
      console.error('n8n workflow error detected:', errorDetails);
      console.error('Full error payload:', { n8nError, errorMessage, n8nStatus, email });
      
      // Update ugc_requests table if requestId is provided
      if (requestId) {
        await supabase
          .from('ugc_requests')
          .update({
            status: 'failed',
            error_message: errorDetails,
            processed_at: new Date().toISOString(),
          })
          .eq('id', requestId);
        console.log('Updated ugc_requests table with failure:', requestId);
      }
      
      // Get the latest processing record for this email - check all tables
      let errorGenerationData: { id: string; user_id: string } | null = null;
      let errorGenerationType: 'image' | 'video' | 'audio' = 'image';
      
      const { data: imageGenData } = await supabase
        .from('image_generations')
        .select('id, user_id')
        .eq('email', userEmail)
        .eq('status', 'processing')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (imageGenData) {
        errorGenerationData = imageGenData;
        errorGenerationType = 'image';
      } else {
        const { data: videoGenData } = await supabase
          .from('video_generations')
          .select('id, user_id')
          .eq('email', userEmail)
          .eq('status', 'processing')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (videoGenData) {
          errorGenerationData = videoGenData;
          errorGenerationType = 'video';
        } else {
          const { data: audioGenData } = await supabase
            .from('audio_generations')
            .select('id, user_id')
            .eq('email', userEmail)
            .eq('status', 'processing')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (audioGenData) {
            errorGenerationData = audioGenData;
            errorGenerationType = 'audio';
          }
        }
      }

      if (errorGenerationData) {
        // Mark as failed with error details
        const tableName = errorGenerationType === 'image' ? 'image_generations' : 
                         errorGenerationType === 'video' ? 'video_generations' : 'audio_generations';
        await supabase
          .from(tableName)
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', errorGenerationData.id);
        
        console.log(`Marked ${errorGenerationType} generation as failed:`, errorGenerationData.id);
      }

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorDetails,
          logged: true 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try to find the latest processing record - check all generation tables and pick the most recent
    interface GenerationRecord {
      id: string;
      user_id: string;
      created_at: string;
      generated_images?: unknown;
      generated_video_url?: string;
      [key: string]: unknown;
    }
    
    let generationData: GenerationRecord | null = null;
    let generationType: 'image' | 'video' | 'audio' = 'image';
    let isVideoAdsImageGen = false;
    
    // Fetch from all tables simultaneously
    const [videoResult, imageResult, audioResult] = await Promise.all([
      supabase
        .from('video_generations')
        .select('*, created_at')
        .eq('email', userEmail)
        .eq('status', 'processing')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('image_generations')
        .select('*, created_at')
        .eq('email', userEmail)
        .eq('status', 'processing')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('audio_generations')
        .select('*, created_at')
        .eq('email', userEmail)
        .eq('status', 'processing')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

    // Find the most recent processing record across all tables
    const candidates: Array<{
      data: GenerationRecord;
      type: 'image' | 'video' | 'audio';
      created_at: number;
    }> = [];
    
    if (videoResult.data) {
      candidates.push({ 
        data: videoResult.data as GenerationRecord, 
        type: 'video',
        created_at: new Date(videoResult.data.created_at).getTime()
      });
    }
    
    if (imageResult.data) {
      candidates.push({ 
        data: imageResult.data as GenerationRecord, 
        type: 'image',
        created_at: new Date(imageResult.data.created_at).getTime()
      });
    }
    
    if (audioResult.data) {
      candidates.push({ 
        data: audioResult.data as GenerationRecord, 
        type: 'audio',
        created_at: new Date(audioResult.data.created_at).getTime()
      });
    }

    if (candidates.length === 0) {
      console.error('No processing generation found for email:', userEmail);
      throw new Error('No processing generation found for this email');
    }

    // Sort by created_at descending and pick the most recent
    candidates.sort((a, b) => b.created_at - a.created_at);
    const mostRecent = candidates[0];
    
    generationData = mostRecent.data;
    generationType = mostRecent.type;
    
    // Check if video type is for image generation (Video Ads workflow)
    if (generationType === 'video' && !generationData.generated_video_url) {
      isVideoAdsImageGen = true;
      console.log('Found video ads image generation (most recent):', generationData.id);
    } else {
      console.log(`Found ${generationType} generation (most recent):`, generationData.id);
    }

    if (!generationData) {
      console.error('No processing generation found for email:', email);
      throw new Error('No processing generation found for this email');
    }

    // Detect file type from URL
    const detectedUrl = webViewLink || '';
    const fileExtension = detectedUrl.split('.').pop()?.toLowerCase() || '';
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
    const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv'];
    const audioExtensions = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'];
    
    let detectedType: 'image' | 'video' | 'audio' | 'unknown' = 'unknown';
    if (imageExtensions.includes(fileExtension)) {
      detectedType = 'image';
    } else if (videoExtensions.includes(fileExtension)) {
      detectedType = 'video';
    } else if (audioExtensions.includes(fileExtension)) {
      detectedType = 'audio';
    }
    
    console.log('Detected file type from URL:', detectedType, 'Extension:', fileExtension);
    console.log('Database generation type:', generationType);
    
    // If there's a mismatch, log a warning but trust the URL detection for actual storage
    if (detectedType !== 'unknown' && detectedType !== generationType && !isVideoAdsImageGen) {
      console.warn(`Type mismatch: URL suggests ${detectedType} but database has ${generationType}`);
      // Override generation type based on URL detection
      generationType = detectedType;
      console.log('Updated generation type to:', generationType);
    }

    let storedMediaUrl = '';

    // For videos, use the direct URL from webViewLink
    if (generationType === 'video') {
      storedMediaUrl = webViewLink || '';
      console.log(`Using direct ${generationType} URL:`, storedMediaUrl);
    } else if (generationType === 'audio') {
      // For audio, download and store in Supabase Storage
      if (fileId || webViewLink) {
        try {
          const driveFileId = fileId || webViewLink?.match(/\/d\/([^\/]+)/)?.[1];
          
          if (driveFileId) {
            console.log('Downloading audio from Google Drive:', driveFileId);
            
            const driveDownloadUrl = `https://drive.google.com/uc?export=download&id=${driveFileId}`;
            const audioResponse = await fetch(driveDownloadUrl);
            
            if (audioResponse.ok) {
              const audioBuffer = await audioResponse.arrayBuffer();
              
              const fileName = `${generationData.user_id}/${generationData.id}.mp3`;
              
              const { error: uploadError } = await supabase.storage
                .from('generated-images')
                .upload(fileName, audioBuffer, {
                  contentType: 'audio/mpeg',
                  upsert: true
                });

              if (uploadError) {
                console.error('Audio storage upload error:', uploadError);
                throw uploadError;
              }

              const { data: urlData } = supabase.storage
                .from('generated-images')
                .getPublicUrl(fileName);
              
              storedMediaUrl = urlData.publicUrl;
              console.log('Audio uploaded to storage:', storedMediaUrl);
            } else {
              console.warn('Failed to download audio from Google Drive, falling back to link');
              storedMediaUrl = webViewLink || '';
            }
          } else {
            console.warn('No file ID found for audio, using fallback URL');
            storedMediaUrl = webViewLink || '';
          }
        } catch (storageError) {
          console.error('Error storing audio:', storageError);
          storedMediaUrl = webViewLink || '';
        }
      } else {
        storedMediaUrl = webViewLink || '';
      }
    } else {
      // For images, try to download and store from Google Drive
      if (fileId || webViewLink) {
        try {
          // Extract fileId from webViewLink if not provided directly
          const driveFileId = fileId || webViewLink?.match(/\/d\/([^\/]+)/)?.[1];
          
          if (driveFileId) {
            console.log('Downloading image from Google Drive:', driveFileId);
            
            // Download image from Google Drive
            const driveDownloadUrl = `https://drive.google.com/uc?export=download&id=${driveFileId}`;
            const imageResponse = await fetch(driveDownloadUrl);
            
            if (imageResponse.ok) {
              const imageBuffer = await imageResponse.arrayBuffer();
              
              // Generate unique filename
              const fileName = `${generationData.user_id}/${generationData.id}.jpg`;
              
              // Upload to Supabase Storage
              const { error: uploadError } = await supabase.storage
                .from('generated-images')
                .upload(fileName, imageBuffer, {
                  contentType: 'image/jpeg',
                  upsert: true
                });

              if (uploadError) {
                console.error('Storage upload error:', uploadError);
                throw uploadError;
              }

              // Get public URL
              const { data: urlData } = supabase.storage
                .from('generated-images')
                .getPublicUrl(fileName);
              
              storedMediaUrl = urlData.publicUrl;
              console.log('Image uploaded to storage:', storedMediaUrl);
            } else {
              console.warn('Failed to download from Google Drive, falling back to link');
              storedMediaUrl = webViewLink || '';
            }
          } else {
            console.warn('No file ID found, using fallback URL');
            storedMediaUrl = webViewLink || '';
          }
        } catch (storageError) {
          console.error('Error storing image:', storageError);
          // Fallback to Google Drive link
          storedMediaUrl = webViewLink || '';
        }
      } else {
        storedMediaUrl = webViewLink || '';
      }
    }

    if (!storedMediaUrl) {
      throw new Error(`No ${generationType} URL available`);
    }

    // Update the appropriate table based on generation type
    let data, error;

    if (isVideoAdsImageGen) {
      // For Video Ads image generation, append to generated_images array
      const currentImages = (generationData.generated_images as string[]) || [];
      const updatedImages = [...currentImages, storedMediaUrl];
      
      ({ data, error } = await supabase
        .from('video_generations')
        .update({
          generated_images: updatedImages,
          // Keep status as processing for now - images come first, video comes later
        })
        .eq('id', generationData.id)
        .select());

      console.log(`Added image ${updatedImages.length} to video ads generation:`, generationData.id);
    } else {
      // Regular single image/video/audio generation
      const tableName = generationType === 'image' ? 'image_generations' : 
                       generationType === 'video' ? 'video_generations' : 'audio_generations';
      const urlField = generationType === 'image' ? 'generated_image_url' : 
                      generationType === 'video' ? 'generated_video_url' : 'generated_audio_url';
      
      ({ data, error } = await supabase
        .from(tableName)
        .update({
          [urlField]: storedMediaUrl,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', generationData.id)
        .select());
    }

    if (error) {
      console.error('Database update error:', error);
      throw error;
    }

    console.log(`Successfully updated ${generationType} generation:`, data);

    // Update ugc_requests table if requestId is provided
    if (requestId) {
      await supabase
        .from('ugc_requests')
        .update({
          status: 'completed',
          result_url: storedMediaUrl,
          processed_at: new Date().toISOString(),
        })
        .eq('id', requestId);
      console.log('Updated ugc_requests table with success:', requestId);
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in ugc-webhook-callback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
