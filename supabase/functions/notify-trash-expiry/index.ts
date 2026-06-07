import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Notify users 2 days before their ads are permanently deleted
const DAYS_BEFORE_EXPIRY = 2;
const RETENTION_DAYS = 14;

interface AdToNotify {
  id: string;
  email: string;
  style_template: string;
  deleted_at: string;
  product_image_url: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('Starting trash expiry notification job...');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Calculate the window for ads expiring in 2 days
    // These are ads deleted (RETENTION_DAYS - DAYS_BEFORE_EXPIRY) days ago
    const targetDaysAgo = RETENTION_DAYS - DAYS_BEFORE_EXPIRY; // 12 days ago
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - targetDaysAgo);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - targetDaysAgo);
    endDate.setHours(23, 59, 59, 999);

    console.log(`Looking for ads deleted between ${startDate.toISOString()} and ${endDate.toISOString()}`);

    // Get ads that will expire in 2 days
    const { data: adsToNotify, error: fetchError } = await supabase
      .from('generated_ads')
      .select('id, email, user_id, style_template, deleted_at, product_image_url')
      .not('deleted_at', 'is', null)
      .gte('deleted_at', startDate.toISOString())
      .lte('deleted_at', endDate.toISOString());

    if (fetchError) {
      console.error('Error fetching ads:', fetchError);
      throw fetchError;
    }

    const ads = adsToNotify as (AdToNotify & { user_id: string })[] || [];
    console.log(`Found ${ads.length} ads expiring in ${DAYS_BEFORE_EXPIRY} days`);

    if (ads.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No expiring ads to notify about',
          notificationsSent: 0 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Get user IDs to check preferences
    const userIds = [...new Set(ads.map(ad => ad.user_id))];
    
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

    // Filter ads to only include users who want notifications
    const adsToNotifyFiltered = ads.filter(ad => {
      const wantsNotifications = prefMap.get(ad.user_id);
      // Default to true if no preference set
      return wantsNotifications !== false;
    });

    console.log(`${adsToNotifyFiltered.length} ads after filtering by preferences (${ads.length - adsToNotifyFiltered.length} users opted out)`);

    if (adsToNotifyFiltered.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No users want notifications for expiring ads',
          notificationsSent: 0,
          optedOut: ads.length
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Group ads by email to send one email per user
    const adsByEmail = adsToNotifyFiltered.reduce((acc, ad) => {
      if (!acc[ad.email]) {
        acc[ad.email] = [];
      }
      acc[ad.email].push(ad);
      return acc;
    }, {} as Record<string, AdToNotify[]>);

    let successCount = 0;
    let errorCount = 0;

    for (const [email, userAds] of Object.entries(adsByEmail)) {
      try {
        const adCount = userAds.length;
        const styleList = [...new Set(userAds.map(ad => getStyleLabel(ad.style_template)))].join(', ');
        
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
            <div style="background-color: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <h1 style="color: #111827; font-size: 24px; margin-bottom: 16px;">⚠️ Your Ads Will Be Deleted Soon</h1>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                You have <strong>${adCount} ad${adCount > 1 ? 's' : ''}</strong> in your trash that will be permanently deleted in <strong>${DAYS_BEFORE_EXPIRY} days</strong>.
              </p>
              
              <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin: 24px 0;">
                <p style="color: #92400e; margin: 0; font-size: 14px;">
                  <strong>Styles:</strong> ${styleList}
                </p>
              </div>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                If you want to keep these ads, please visit your Trash page and restore them before they are permanently deleted.
              </p>
              
              <div style="margin-top: 24px;">
                <a href="https://eqiwbtxomiskpekgrsph.lovable.app/trash" 
                   style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">
                  View Trash
                </a>
              </div>
              
              <p style="color: #9ca3af; font-size: 14px; margin-top: 32px;">
                This is an automated notification. Ads are kept in trash for ${RETENTION_DAYS} days before permanent deletion.
              </p>
            </div>
          </body>
          </html>
        `;

        const { error: sendError } = await resend.emails.send({
          from: 'UGC Ads <onboarding@resend.dev>',
          to: [email],
          subject: `⚠️ ${adCount} ad${adCount > 1 ? 's' : ''} will be permanently deleted in ${DAYS_BEFORE_EXPIRY} days`,
          html: emailHtml,
        });

        if (sendError) {
          console.error(`Error sending email to ${email}:`, sendError);
          errorCount++;
        } else {
          console.log(`Notification sent to ${email} for ${adCount} ads`);
          successCount++;
        }
      } catch (emailError) {
        console.error(`Error processing email for ${email}:`, emailError);
        errorCount++;
      }
    }

    console.log(`Notification job complete: ${successCount} emails sent, ${errorCount} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent ${successCount} notification emails`,
        notificationsSent: successCount,
        errors: errorCount,
        totalAdsExpiring: ads.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Trash notification error:', error);
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

function getStyleLabel(styleId: string): string {
  const labels: Record<string, string> = {
    lifestyle: "Lifestyle",
    handheld: "Handheld Review",
    unboxing: "Unboxing",
    beforeafter: "Before & After",
    testimonial: "Testimonial",
    flatlay: "Flat Lay",
  };
  return labels[styleId] || styleId;
}
