import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CancellationEmailRequest {
  userId: string;
  planName: string;
  endDate: string;
  creditsRemaining: number;
}

const generateEmailHtml = (
  userName: string,
  planName: string,
  endDate: string,
  creditsRemaining: number
) => {
  const formattedDate = new Date(endDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Cancelled — SongDoe</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #0f0f0f; border-radius: 16px; box-shadow: 0 4px 40px rgba(0, 0, 0, 0.5); border: 1px solid #1f1f1f;">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px 24px; text-align: center; background: linear-gradient(135deg, #0f0f0f 0%, #1a0a2e 50%, #0f0f0f 100%); border-radius: 16px 16px 0 0; border-bottom: 1px solid #2a1a4e;">
              <h1 style="margin: 0 0 4px; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">🎬 SongDoe</h1>
              <p style="margin: 0; font-size: 11px; font-weight: 600; color: hsl(6, 85%, 69%); letter-spacing: 2px; text-transform: uppercase;">AI Music Video Creator</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 40px 6px; text-align: center; background-color: #0f0f0f;">
              <h2 style="margin: 20px 0 0; font-size: 20px; font-weight: 700; color: #ffffff;">Subscription Cancelled</h2>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 30px 40px; background-color: #0f0f0f;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.7; color: #a0a0a0;">
                Hi ${userName},
              </p>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.7; color: #a0a0a0;">
                We're sorry to see you go! Your <strong style="color: #ffffff;">${planName}</strong> subscription has been cancelled.
              </p>
              
              <!-- Access Until Box -->
              <div style="background-color: #1a1000; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 24px 0;">
                <p style="margin: 0; font-size: 14px; color: #f59e0b; font-weight: 600;">
                  📅 You'll still have access until:
                </p>
                <p style="margin: 8px 0 0; font-size: 18px; color: #fbbf24; font-weight: 700;">
                  ${formattedDate}
                </p>
              </div>
              
              <!-- Credits Reminder -->
              ${creditsRemaining > 0 ? `
              <div style="background-color: #0a0a1a; border-left: 4px solid hsl(6, 85%, 69%); padding: 20px; border-radius: 8px; margin: 24px 0;">
                <p style="margin: 0; font-size: 14px; color: hsl(6, 85%, 69%); font-weight: 600;">
                  🎬 Don't forget your remaining credits!
                </p>
                <p style="margin: 8px 0 0; font-size: 16px; color: #a0a0a0;">
                  You still have <strong style="color: #ffffff;">${creditsRemaining} credits</strong> to use for AI music videos before your access ends.
                </p>
              </div>
              ` : ''}
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="https://songdoe.com/create" 
                       style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, hsl(6, 85%, 69%) 0%, hsl(270, 70%, 65%) 100%); color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px;">
                      🎬 Use Remaining Credits
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 20px 0 0; font-size: 14px; line-height: 1.7; color: #555;">
                Changed your mind? You can resubscribe anytime from your <a href="https://songdoe.com/account" style="color: hsl(6, 85%, 69%);">account settings</a>. We'd love to have you back creating AI music videos!
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 30px; background-color: #0a0a0a; border-radius: 0 0 16px 16px; border-top: 1px solid #1f1f1f;">
              <p style="margin: 0; font-size: 12px; color: #444; text-align: center;">
                Thank you for being a valued SongDoe creator. We hope to see you again soon!
              </p>
              <p style="margin: 10px 0 0; font-size: 12px; color: #444; text-align: center;">
                Questions? Email us at <a href="mailto:hello@songdoe.com" style="color: hsl(6, 85%, 69%);">hello@songdoe.com</a>
              </p>
              <p style="margin: 10px 0 0; font-size: 11px; color: #333; text-align: center; letter-spacing: 1px;">
                🎬 SongDoe · AI Music Video Creator
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("send-cancellation-email function invoked");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, planName, endDate, creditsRemaining }: CancellationEmailRequest = await req.json();

    console.log("Processing cancellation email for user:", userId);

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", userId)
      .single();

    if (profileError || !profile?.email) {
      console.error("Profile not found:", profileError);
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check notification preferences
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("subscription_expiry_notifications")
      .eq("user_id", userId)
      .single();

    // Default to true if no preferences exist
    if (prefs && prefs.subscription_expiry_notifications === false) {
      console.log("User has opted out of subscription notifications");
      return new Response(
        JSON.stringify({ message: "User opted out of notifications" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userName = profile.full_name || profile.email.split("@")[0];
    const emailHtml = generateEmailHtml(userName, planName, endDate, creditsRemaining);

    const emailResponse = await resend.emails.send({
      from: "SongDoe <notifications@songdoe.com>",
      to: [profile.email],
      subject: `Your ${planName} subscription has been cancelled`,
      html: emailHtml,
    });

    console.log("Cancellation email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailId: emailResponse.data?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending cancellation email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
