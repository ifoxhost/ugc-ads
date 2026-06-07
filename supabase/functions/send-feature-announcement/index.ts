import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FeatureAnnouncement {
  title: string;
  description: string;
  features: string[];
  ctaText?: string;
  ctaUrl?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting feature announcement email job...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse the announcement data from the request
    const announcement: FeatureAnnouncement = await req.json();

    if (!announcement.title || !announcement.description || !announcement.features) {
      throw new Error("Missing required announcement fields: title, description, features");
    }

    console.log(`Sending feature announcement: ${announcement.title}`);

    // Get users who have feature_announcements enabled
    const { data: preferences, error: prefError } = await supabase
      .from("notification_preferences")
      .select("user_id")
      .eq("feature_announcements", true);

    if (prefError) {
      console.error("Error fetching notification preferences:", prefError);
      throw prefError;
    }

    if (!preferences || preferences.length === 0) {
      console.log("No users have feature announcements enabled");
      return new Response(
        JSON.stringify({ message: "No users with feature announcements enabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userIds = preferences.map(p => p.user_id);
    console.log(`Found ${userIds.length} users with feature announcements enabled`);

    // Get email addresses for these users
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", userIds);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    const emails = profiles?.filter(p => p.email).map(p => p.email!) || [];

    if (emails.length === 0) {
      console.log("No valid email addresses found");
      return new Response(
        JSON.stringify({ message: "No valid email addresses found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending feature announcement to ${emails.length} users`);

    // Build feature list HTML
    const featuresHtml = announcement.features
      .map(feature => `<li style="margin-bottom: 8px; color: #374151;">✨ ${feature}</li>`)
      .join('\n');

    // Build CTA button if provided
    const ctaHtml = announcement.ctaText && announcement.ctaUrl ? `
      <div style="text-align: center; margin-top: 30px;">
        <a href="${announcement.ctaUrl}" 
           style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          ${announcement.ctaText} →
        </a>
      </div>
    ` : '';

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0a0a0a;">
        <div style="background: linear-gradient(135deg, #0f0f0f 0%, #1a0a2e 50%, #0f0f0f 100%); padding: 32px 30px 24px; border-radius: 16px 16px 0 0; text-align: center; border-bottom: 1px solid #2a1a4e;">
          <h1 style="color: #ffffff; margin: 0 0 4px; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">🎬 SongDoe</h1>
          <p style="margin: 0 0 12px; font-size: 11px; font-weight: 600; color: hsl(6, 85%, 69%); letter-spacing: 2px; text-transform: uppercase;">AI Music Video Creator</p>
          <p style="color: #ffffff; margin: 0; font-size: 18px; font-weight: 700;">🎉 New Feature Alert!</p>
        </div>
        
        <div style="background-color: #0f0f0f; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 40px rgba(0,0,0,0.5); border: 1px solid #1f1f1f; border-top: none;">
          <h2 style="color: #ffffff; font-size: 24px; margin-top: 0; margin-bottom: 16px;">
            ${announcement.title}
          </h2>
          
          <p style="color: #a0a0a0; font-size: 16px; line-height: 1.7; margin-bottom: 24px;">
            ${announcement.description}
          </p>
          
          <div style="background-color: #1a1a1a; padding: 20px 24px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #2a2a2a;">
            <h3 style="color: #ffffff; font-size: 16px; margin-top: 0; margin-bottom: 12px;">What's New:</h3>
            <ul style="list-style: none; padding: 0; margin: 0; font-size: 15px;">
              ${featuresHtml}
            </ul>
          </div>
          
          ${ctaHtml}
          
          <hr style="border: none; border-top: 1px solid #1f1f1f; margin: 30px 0 20px 0;">
          
          <p style="color: #444; font-size: 12px; text-align: center; margin: 0;">
            You're receiving this because you've enabled feature announcements on SongDoe.<br>
            <a href="https://songdoe.com/account/notifications" style="color: hsl(6, 85%, 69%);">Manage notification preferences</a>
          </p>
          <p style="margin: 10px 0 0; font-size: 11px; color: #333; text-align: center; letter-spacing: 1px;">
            🎬 SongDoe · AI Music Video Creator
          </p>
        </div>
      </body>
      </html>
    `;

    // Send emails in batches
    let emailsSent = 0;
    let emailsFailed = 0;
    const batchSize = 50;

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);

      for (const email of batch) {
        try {
          const { error: emailError } = await resend.emails.send({
            from: "SongDoe <updates@songdoe.com>",
            to: [email],
            subject: `🎉 New Feature: ${announcement.title}`,
            html: emailHtml,
          });

          if (emailError) {
            console.error(`Failed to send to ${email}:`, emailError);
            emailsFailed++;
          } else {
            console.log(`Feature announcement sent to ${email}`);
            emailsSent++;
          }
        } catch (error) {
          console.error(`Error sending to ${email}:`, error);
          emailsFailed++;
        }
      }
    }

    console.log(`Feature announcement completed: ${emailsSent} sent, ${emailsFailed} failed`);

    return new Response(
      JSON.stringify({
        message: "Feature announcement sent",
        emailsSent,
        emailsFailed,
        totalUsers: emails.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-feature-announcement function:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
