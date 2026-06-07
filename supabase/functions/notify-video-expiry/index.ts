import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Notify users 2 days before their video ads expire (14-day retention)
const DAYS_BEFORE_EXPIRY = 2;
const VIDEO_RETENTION_DAYS = 14;

interface VideoAdToNotify {
  id: string;
  email: string;
  user_id: string;
  style_template: string;
  completed_at: string;
  product_image_url: string;
  generated_video_url: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('=== VIDEO EXPIRY NOTIFICATION JOB STARTED ===');
  console.log('Timestamp:', new Date().toISOString());

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Calculate the window for videos expiring in 2 days
    // These are videos completed (VIDEO_RETENTION_DAYS - DAYS_BEFORE_EXPIRY) days ago = 12 days ago
    const targetDaysAgo = VIDEO_RETENTION_DAYS - DAYS_BEFORE_EXPIRY;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - targetDaysAgo);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - targetDaysAgo);
    endDate.setHours(23, 59, 59, 999);

    console.log(`Looking for videos completed between ${startDate.toISOString()} and ${endDate.toISOString()}`);

    // Get video ads that will expire in 2 days
    const { data: videosToNotify, error: fetchError } = await supabase
      .from('generated_ads')
      .select('id, email, user_id, style_template, completed_at, product_image_url, generated_video_url')
      .eq('status', 'video_completed')
      .not('generated_video_url', 'is', null)
      .gte('completed_at', startDate.toISOString())
      .lte('completed_at', endDate.toISOString());

    if (fetchError) {
      console.error('Error fetching videos:', fetchError);
      throw fetchError;
    }

    const videos = (videosToNotify || []) as VideoAdToNotify[];
    console.log(`Found ${videos.length} videos expiring in ${DAYS_BEFORE_EXPIRY} days`);

    if (videos.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No expiring videos to notify about',
          notificationsSent: 0 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Get user IDs to check preferences
    const userIds = [...new Set(videos.map(v => v.user_id))];
    
    // Fetch notification preferences for these users
    const { data: preferences, error: prefError } = await supabase
      .from('notification_preferences')
      .select('user_id, trash_expiry_notifications')
      .in('user_id', userIds);

    if (prefError) {
      console.error('Error fetching preferences:', prefError);
      // Continue anyway - default is to send notifications
    }

    // Create a map of user preferences (default to true if not set)
    const prefMap = new Map<string, boolean>();
    preferences?.forEach(pref => {
      prefMap.set(pref.user_id, pref.trash_expiry_notifications);
    });

    // Filter videos to only include users who want notifications
    const videosFiltered = videos.filter(video => {
      const wantsNotifications = prefMap.get(video.user_id);
      // Default to true if no preference set
      return wantsNotifications !== false;
    });

    console.log(`${videosFiltered.length} videos after filtering by preferences (${videos.length - videosFiltered.length} users opted out)`);

    if (videosFiltered.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No users want notifications for expiring videos',
          notificationsSent: 0,
          optedOut: videos.length
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Group videos by email to send one email per user
    const videosByEmail = videosFiltered.reduce((acc, video) => {
      if (!acc[video.email]) {
        acc[video.email] = [];
      }
      acc[video.email].push(video);
      return acc;
    }, {} as Record<string, VideoAdToNotify[]>);

    let successCount = 0;
    let errorCount = 0;

    for (const [email, userVideos] of Object.entries(videosByEmail)) {
      try {
        const videoCount = userVideos.length;
        
        // Create video thumbnails grid (using product images as thumbnails)
        const thumbnailsHtml = userVideos.slice(0, 4).map(video => `
          <div style="width: 80px; height: 80px; border-radius: 8px; overflow: hidden; position: relative;">
            <img src="${video.product_image_url}" alt="Video thumbnail" style="width: 100%; height: 100%; object-fit: cover;" />
            <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
              <div style="width: 24px; height: 24px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                ▶
              </div>
            </div>
          </div>
        `).join('');
        
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
            <div style="background-color: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <h1 style="color: #111827; font-size: 24px; margin-bottom: 16px;">🎬 Your Video Ads Are Expiring Soon!</h1>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                You have <strong>${videoCount} video ad${videoCount > 1 ? 's' : ''}</strong> that will be automatically deleted in <strong>${DAYS_BEFORE_EXPIRY} days</strong>.
              </p>
              
              <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 20px; margin: 24px 0;">
                <p style="color: #92400e; margin: 0 0 12px 0; font-weight: 600; font-size: 14px;">
                  📥 Download them now to keep them forever!
                </p>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                  ${thumbnailsHtml}
                  ${videoCount > 4 ? `<div style="width: 80px; height: 80px; border-radius: 8px; background: #f3f4f6; display: flex; align-items: center; justify-content: center; color: #6b7280; font-weight: 600;">+${videoCount - 4}</div>` : ''}
                </div>
              </div>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                Video ads are stored for ${VIDEO_RETENTION_DAYS} days to save storage space. Once downloaded, they're yours forever!
              </p>
              
              <div style="margin-top: 24px;">
                <a href="https://ugcads.co.za/library" 
                   style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
                  Download Your Videos
                </a>
              </div>
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
              
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                This is an automated reminder from UGC Ads. You can manage your notification preferences in your account settings.
              </p>
            </div>
          </body>
          </html>
        `;

        const { error: sendError } = await resend.emails.send({
          from: 'UGC Ads <noreply@ugcads.co.za>',
          to: [email],
          subject: `🎬 ${videoCount} video ad${videoCount > 1 ? 's' : ''} expiring in ${DAYS_BEFORE_EXPIRY} days - download now!`,
          html: emailHtml,
        });

        if (sendError) {
          console.error(`Error sending email to ${email}:`, sendError);
          errorCount++;
        } else {
          console.log(`Video expiry notification sent to ${email} for ${videoCount} videos`);
          successCount++;
        }
      } catch (emailError) {
        console.error(`Error processing email for ${email}:`, emailError);
        errorCount++;
      }
    }

    console.log(`Video expiry notification job complete: ${successCount} emails sent, ${errorCount} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent ${successCount} video expiry notification emails`,
        notificationsSent: successCount,
        errors: errorCount,
        totalVideosExpiring: videos.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Video expiry notification error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
