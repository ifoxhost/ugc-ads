import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_PROCESSING_MINUTES = 15;

async function sendCompletionEmail(opts: {
  resendApiKey: string;
  toEmail: string;
  songTitle: string;
  artist: string;
  videoUrl: string;
  adId: string;
}) {
  const { resendApiKey, toEmail, songTitle, artist, videoUrl, adId } = opts;

  const displayTitle = songTitle || "Your lyric video";
  const displayArtist = artist ? ` by ${artist}` : "";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border-radius:16px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;text-align:center;background:linear-gradient(135deg,#1a1a2e,#0a0a0a);">
              <p style="margin:0;font-size:13px;letter-spacing:4px;text-transform:uppercase;color:#a78bfa;font-weight:600;">BeatFrame</p>
              <h1 style="margin:12px 0 0;font-size:28px;font-weight:800;color:#ffffff;line-height:1.2;">🎬 Your Video is Ready!</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#ffffff;">${displayTitle}${displayArtist}</p>
              <p style="margin:0 0 28px;font-size:14px;color:#9ca3af;line-height:1.6;">Your lyric video has finished rendering and is ready to download.</p>
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${videoUrl}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#7c3aed,#a78bfa);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;border-radius:10px;letter-spacing:0.3px;">
                      Watch &amp; Download
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:28px 0 0;font-size:12px;color:#6b7280;text-align:center;">
                Or open your <a href="https://ugc-ads.lovable.app/library" style="color:#a78bfa;text-decoration:none;">BeatFrame Library</a> to view all your videos.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #1f1f2e;text-align:center;">
              <p style="margin:0;font-size:11px;color:#4b5563;">You're receiving this because you generated a lyric video on BeatFrame.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from:    "BeatFrame <notifications@ugc-ads.lovable.app>",
      to:      [toEmail],
      subject: `🎬 "${displayTitle}" — your lyric video is ready!`,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Resend email failed for ad ${adId}: ${res.status} ${err}`);
  } else {
    console.log(`Completion email sent for ad ${adId} → ${toEmail}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl        = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const shotstackApiKey    = Deno.env.get("SHOTSTACK_API_KEY");
    const resendApiKey       = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("=== LYRIC VIDEO POLL JOB STARTED ===");
    console.log("Timestamp:", new Date().toISOString());
    console.log("Shotstack API key present:", !!shotstackApiKey);

    // Fetch pending lyric video records
    const { data: pendingAds, error: fetchError } = await supabase
      .from("generated_ads")
      .select("id, user_id, email, video_task_id, video_status, video_retry_count, created_at, video_last_checked_at, ad_copy")
      .in("video_status", ["queued", "processing"])
      .not("video_task_id", "is", null)
      .like("prompt_used", "BeatFrame lyric video%")
      .order("video_last_checked_at", { ascending: true, nullsFirst: true })
      .limit(30);

    if (fetchError) {
      console.error("Error fetching pending lyric ads:", fetchError);
      throw fetchError;
    }

    if (!pendingAds || pendingAds.length === 0) {
      console.log("No pending lyric video ads to poll");
      return new Response(
        JSON.stringify({ success: true, message: "No pending lyric videos", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${pendingAds.length} pending lyric video ads to poll`);

    let completed     = 0;
    let failed        = 0;
    let stillProcessing = 0;
    let timedOut      = 0;
    const now         = new Date();

    for (const ad of pendingAds) {
      try {
        // Timeout check
        const createdAt   = new Date(ad.created_at);
        const ageMinutes  = (now.getTime() - createdAt.getTime()) / 1000 / 60;

        if (ageMinutes > MAX_PROCESSING_MINUTES) {
          console.log(`Ad ${ad.id} timed out after ${Math.round(ageMinutes)} minutes`);
          await supabase
            .from("generated_ads")
            .update({ status: "video_failed", video_status: "failed", video_last_checked_at: now.toISOString() })
            .eq("id", ad.id);
          timedOut++;
          failed++;
          continue;
        }

        if (!shotstackApiKey) {
          console.log(`No SHOTSTACK_API_KEY — skipping poll for ad ${ad.id}`);
          await supabase
            .from("generated_ads")
            .update({ video_last_checked_at: now.toISOString() })
            .eq("id", ad.id);
          stillProcessing++;
          continue;
        }

        // Poll Shotstack render status
        const renderApiUrl  = `https://api.shotstack.io/edit/v1/render/${ad.video_task_id}`;
        const shotstackRes  = await fetch(renderApiUrl, {
          headers: { "x-api-key": shotstackApiKey, "Content-Type": "application/json" },
        });

        if (!shotstackRes.ok) {
          const errText = await shotstackRes.text();
          console.error(`Shotstack poll failed for ad ${ad.id}: ${shotstackRes.status} ${errText}`);
          const retryCount = (ad.video_retry_count || 0) + (shotstackRes.status >= 500 ? 1 : 0);
          await supabase
            .from("generated_ads")
            .update({ video_retry_count: retryCount, video_last_checked_at: now.toISOString() })
            .eq("id", ad.id);
          stillProcessing++;
          continue;
        }

        const renderData   = await shotstackRes.json();
        const response     = renderData.response;
        const renderStatus: string    = response?.status ?? "unknown";
        const renderUrl:    string | undefined = response?.url;

        console.log(`Ad ${ad.id} — Shotstack status: ${renderStatus}`);

        if (renderStatus === "done" && renderUrl) {
          // Mark completed in DB
          await supabase
            .from("generated_ads")
            .update({
              status:             "completed",
              video_status:       "complete",
              generated_video_url: renderUrl,
              completed_at:       now.toISOString(),
              video_last_checked_at: now.toISOString(),
              video_progress:     100,
            })
            .eq("id", ad.id);
          completed++;
          console.log(`Ad ${ad.id} completed — video URL: ${renderUrl}`);

          const adCopy = ad.ad_copy as { title?: string; artist?: string } | null;
          const songTitle = adCopy?.title  || "";
          const artist    = adCopy?.artist || "";

          // Send completion email via Resend
          if (resendApiKey && ad.email) {
            await sendCompletionEmail({
              resendApiKey,
              toEmail: ad.email,
              songTitle,
              artist,
              videoUrl: renderUrl,
              adId:     ad.id,
            });
          }

          // Send push notification
          const supabaseUrl2 = Deno.env.get("SUPABASE_URL")!;
          const displayTitle = songTitle || "Your lyric video";
          const displayBody  = artist
            ? `"${displayTitle}" by ${artist} has finished rendering.`
            : `"${displayTitle}" has finished rendering.`;

          try {
            await fetch(`${supabaseUrl2}/functions/v1/send-push-notification`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({
                userId: ad.user_id,
                title:  "🎬 Video Ready!",
                body:   displayBody,
                icon:   "/favicon.ico",
                data:   { adId: ad.id, url: "/library" },
              }),
            });
            console.log(`Push notification sent for ad ${ad.id}`);
          } catch (pushErr) {
            console.error(`Push notification failed for ad ${ad.id}:`, pushErr);
          }
        } else if (renderStatus === "failed") {
          await supabase
            .from("generated_ads")
            .update({ status: "video_failed", video_status: "failed", video_last_checked_at: now.toISOString() })
            .eq("id", ad.id);
          failed++;
          console.log(`Ad ${ad.id} failed on Shotstack`);
        } else {
          // Still rendering — map to progress %
          const progressMap: Record<string, number> = {
            queued:    10,
            fetching:  25,
            rendering: 60,
            saving:    85,
          };
          const progress = progressMap[renderStatus] ?? 50;

          await supabase
            .from("generated_ads")
            .update({ video_status: "processing", video_progress: progress, video_last_checked_at: now.toISOString() })
            .eq("id", ad.id);
          stillProcessing++;
        }
      } catch (adError) {
        console.error(`Error processing ad ${ad.id}:`, adError);
      }
    }

    const summary = { success: true, message: `Polled ${pendingAds.length} lyric video ads`, completed, failed, stillProcessing, timedOut };
    console.log("Poll job complete:", summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in poll-lyric-video-status:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
