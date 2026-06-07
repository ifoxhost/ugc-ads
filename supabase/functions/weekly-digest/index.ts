import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ActivitySummary {
  email: string;
  adsCreated: number;
  imagesCreated: number;
  videosCreated: number;
  audioCreated: number;
  totalCreditsUsed: number;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting weekly digest email job...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate date range for the past week
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekStart = oneWeekAgo.toISOString();
    const weekEnd = now.toISOString();

    console.log(`Fetching activity from ${weekStart} to ${weekEnd}`);

    // Get users who have weekly_digest enabled
    const { data: preferences, error: prefError } = await supabase
      .from("notification_preferences")
      .select("user_id")
      .eq("weekly_digest", true);

    if (prefError) {
      console.error("Error fetching notification preferences:", prefError);
      throw prefError;
    }

    if (!preferences || preferences.length === 0) {
      console.log("No users have weekly digest enabled");
      return new Response(
        JSON.stringify({ message: "No users with weekly digest enabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userIds = preferences.map(p => p.user_id);
    console.log(`Found ${userIds.length} users with weekly digest enabled`);

    // Fetch activity data for each user
    const activitySummaries: ActivitySummary[] = [];

    for (const userId of userIds) {
      // Get ads created this week
      const { data: ads, error: adsError } = await supabase
        .from("generated_ads")
        .select("id, email")
        .eq("user_id", userId)
        .gte("created_at", weekStart)
        .lte("created_at", weekEnd)
        .is("deleted_at", null);

      if (adsError) {
        console.error(`Error fetching ads for user ${userId}:`, adsError);
        continue;
      }

      // Get images created this week
      const { data: images, error: imagesError } = await supabase
        .from("image_generations")
        .select("id, email")
        .eq("user_id", userId)
        .gte("created_at", weekStart)
        .lte("created_at", weekEnd);

      if (imagesError) {
        console.error(`Error fetching images for user ${userId}:`, imagesError);
        continue;
      }

      // Get videos created this week
      const { data: videos, error: videosError } = await supabase
        .from("video_generations")
        .select("id, email")
        .eq("user_id", userId)
        .gte("created_at", weekStart)
        .lte("created_at", weekEnd);

      if (videosError) {
        console.error(`Error fetching videos for user ${userId}:`, videosError);
        continue;
      }

      // Get audio created this week
      const { data: audio, error: audioError } = await supabase
        .from("audio_generations")
        .select("id, email")
        .eq("user_id", userId)
        .gte("created_at", weekStart)
        .lte("created_at", weekEnd);

      if (audioError) {
        console.error(`Error fetching audio for user ${userId}:`, audioError);
        continue;
      }

      const adsCreated = ads?.length || 0;
      const imagesCreated = images?.length || 0;
      const videosCreated = videos?.length || 0;
      const audioCreated = audio?.length || 0;
      const totalItems = adsCreated + imagesCreated + videosCreated + audioCreated;

      // Only send digest if there's any activity
      if (totalItems > 0) {
        // Get email from any of the records, or fetch from profiles
        let email = ads?.[0]?.email || images?.[0]?.email || videos?.[0]?.email || audio?.[0]?.email;

        if (!email) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", userId)
            .single();
          email = profile?.email;
        }

        if (email) {
          activitySummaries.push({
            email,
            adsCreated,
            imagesCreated,
            videosCreated,
            audioCreated,
            totalCreditsUsed: totalItems,
          });
        }
      }
    }

    console.log(`Sending weekly digest to ${activitySummaries.length} users with activity`);

    // Send emails
    let emailsSent = 0;
    let emailsFailed = 0;

    for (const summary of activitySummaries) {
      const weekStartFormatted = oneWeekAgo.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const weekEndFormatted = now.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      const activityItems: string[] = [];
      if (summary.adsCreated > 0) {
        activityItems.push(`<li>🎨 <strong>${summary.adsCreated}</strong> UGC ad${summary.adsCreated > 1 ? 's' : ''} created</li>`);
      }
      if (summary.imagesCreated > 0) {
        activityItems.push(`<li>🖼️ <strong>${summary.imagesCreated}</strong> image${summary.imagesCreated > 1 ? 's' : ''} generated</li>`);
      }
      if (summary.videosCreated > 0) {
        activityItems.push(`<li>🎬 <strong>${summary.videosCreated}</strong> video${summary.videosCreated > 1 ? 's' : ''} created</li>`);
      }
      if (summary.audioCreated > 0) {
        activityItems.push(`<li>🎙️ <strong>${summary.audioCreated}</strong> audio file${summary.audioCreated > 1 ? 's' : ''} generated</li>`);
      }

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
            <p style="margin: 0 0 10px; font-size: 11px; font-weight: 600; color: hsl(6, 85%, 69%); letter-spacing: 2px; text-transform: uppercase;">AI Music Video Creator</p>
            <h2 style="color: #ffffff; margin: 0; font-size: 18px; font-weight: 700;">📊 Your Weekly Activity Summary</h2>
            <p style="color: rgba(255,255,255,0.6); margin: 8px 0 0; font-size: 14px;">${weekStartFormatted} - ${weekEndFormatted}</p>
          </div>
          
          <div style="background-color: #0f0f0f; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 40px rgba(0,0,0,0.5); border: 1px solid #1f1f1f; border-top: none;">
            <p style="color: #a0a0a0; font-size: 16px; margin-bottom: 20px;">
              Great work this week! Here's a summary of what you created on SongDoe:
            </p>
            
            <div style="background-color: #1a1a1a; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #2a2a2a;">
              <ul style="list-style: none; padding: 0; margin: 0; font-size: 16px; color: #a0a0a0;">
                ${activityItems.join('\n                ')}
              </ul>
            </div>
            
            <div style="background-color: #0a0a1a; padding: 15px; border-radius: 8px; text-align: center; margin-bottom: 20px; border: 1px solid #1a1a3a;">
              <p style="margin: 0; color: hsl(6, 85%, 69%); font-weight: 600;">
                Total SongDoe credits used: ${summary.totalCreditsUsed}
              </p>
            </div>
            
            <div style="text-align: center;">
              <a href="https://songdoe.com/create" 
                 style="display: inline-block; background: linear-gradient(135deg, hsl(6, 85%, 69%) 0%, hsl(270, 70%, 65%) 100%); color: white; text-decoration: none; padding: 14px 30px; border-radius: 10px; font-weight: 600; font-size: 15px;">
                🎬 Create More AI Music Videos →
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #1f1f1f; margin: 25px 0;">
            
            <p style="color: #444; font-size: 12px; text-align: center; margin: 0;">
              You're receiving this because you've enabled weekly digest emails on SongDoe.<br>
              <a href="https://songdoe.com/account/notifications" style="color: hsl(6, 85%, 69%);">Manage notification preferences</a>
            </p>
            <p style="margin: 10px 0 0; font-size: 11px; color: #333; text-align: center; letter-spacing: 1px;">
              🎬 SongDoe · AI Music Video Creator
            </p>
          </div>
        </body>
        </html>
      `;

      try {
        const { error: emailError } = await resend.emails.send({
          from: "SongDoe <digest@songdoe.com>",
          to: [summary.email],
          subject: `📊 Your Weekly Summary: ${summary.totalCreditsUsed} items created!`,
          html: emailHtml,
        });

        if (emailError) {
          console.error(`Failed to send email to ${summary.email}:`, emailError);
          emailsFailed++;
        } else {
          console.log(`Weekly digest sent to ${summary.email}`);
          emailsSent++;
        }
      } catch (error) {
        console.error(`Error sending email to ${summary.email}:`, error);
        emailsFailed++;
      }
    }

    console.log(`Weekly digest job completed: ${emailsSent} sent, ${emailsFailed} failed`);

    return new Response(
      JSON.stringify({
        message: "Weekly digest job completed",
        emailsSent,
        emailsFailed,
        usersWithActivity: activitySummaries.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in weekly-digest function:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
