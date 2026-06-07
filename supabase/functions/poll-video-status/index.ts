import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Max retries before marking as failed
const MAX_RETRIES = 3;
// Retry delay in seconds
const RETRY_DELAY_SECONDS = 60;
// Max processing time before timeout (10 minutes)
const MAX_PROCESSING_TIME_MS = 10 * 60 * 1000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("=== VIDEO POLL/RETRY JOB STARTED ===");
    console.log("Timestamp:", new Date().toISOString());

    // Get all ads that need polling (queued, processing, or retrying)
    const { data: pendingAds, error: fetchError } = await supabase
      .from("generated_ads")
      .select("id, user_id, email, video_status, video_task_id, video_retry_count, video_last_checked_at, created_at, product_image_url, aspect_ratio")
      .in("video_status", ["queued", "processing", "retrying"])
      .order("video_last_checked_at", { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error("Error fetching pending ads:", fetchError);
      throw fetchError;
    }

    if (!pendingAds || pendingAds.length === 0) {
      console.log("No pending video ads to process");
      return new Response(
        JSON.stringify({ success: true, message: "No pending video ads", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${pendingAds.length} pending video ads`);

    let processedCount = 0;
    let retriedCount = 0;
    let failedCount = 0;
    let timedOutCount = 0;

    for (const ad of pendingAds) {
      try {
        const now = new Date();
        const lastChecked = ad.video_last_checked_at ? new Date(ad.video_last_checked_at) : new Date(ad.created_at);
        const timeSinceLastCheck = now.getTime() - lastChecked.getTime();

        // Use the task timestamp as the start time when available so retries on older ads don't instantly time out.
        const taskStartMatch = ad.video_task_id?.match(/^vt_(\d+)_/);
        const taskStartTime = taskStartMatch ? new Date(Number(taskStartMatch[1])) : null;
        const processingStart = taskStartTime || lastChecked;
        const totalProcessingTime = now.getTime() - processingStart.getTime();

        // Check for timeout
        if (totalProcessingTime > MAX_PROCESSING_TIME_MS) {
          console.log(`Ad ${ad.id} timed out after ${Math.round(totalProcessingTime / 1000 / 60)} minutes`);
          
          const retryCount = (ad.video_retry_count || 0) + 1;
          
           if (retryCount < MAX_RETRIES) {
             // Schedule retry
             await supabase
               .from("generated_ads")
               .update({
                 video_status: "retrying",
                 video_retry_count: retryCount,
                 video_last_checked_at: now.toISOString(),
                 completed_at: null,
               })
               .eq("id", ad.id);
            
            retriedCount++;
            console.log(`Ad ${ad.id} scheduled for retry (attempt ${retryCount}/${MAX_RETRIES})`);
          } else {
            // Max retries exceeded - mark as failed
            await supabase
              .from("generated_ads")
              .update({
                status: "video_failed",
                video_status: "failed",
                video_last_checked_at: now.toISOString(),
              })
              .eq("id", ad.id);
            
            failedCount++;
            console.log(`Ad ${ad.id} marked as failed after ${MAX_RETRIES} retries`);
          }
          
          timedOutCount++;
          continue;
        }

        // For retrying ads, check if retry delay has passed
        if (ad.video_status === "retrying") {
          const retryDelayMs = RETRY_DELAY_SECONDS * 1000;
          
          if (timeSinceLastCheck < retryDelayMs) {
            console.log(`Ad ${ad.id} waiting for retry delay (${Math.round((retryDelayMs - timeSinceLastCheck) / 1000)}s remaining)`);
            continue;
          }

          // Re-trigger the video generation
          console.log(`Retrying video generation for ad ${ad.id}`);
          
          // Call submit-video-ad with retry flag (internal call via service role)
          const { error: invokeError } = await supabase.functions.invoke("submit-video-ad", {
            body: {
              adId: ad.id,
              productImageUrl: ad.product_image_url,
              aspectRatio: ad.aspect_ratio,
              isRetry: true,
              isConversion: true,
              userId: ad.user_id,
              email: ad.email,
            },
          });

          if (!invokeError) {
            retriedCount++;
            console.log(`Retry triggered for ad ${ad.id}`);
          } else {
            console.error(`Retry failed for ad ${ad.id}:`, invokeError);
          }
        }

        // Update last checked timestamp for queued/processing ads
        if (ad.video_status === "queued" || ad.video_status === "processing") {
          await supabase
            .from("generated_ads")
            .update({
              video_last_checked_at: now.toISOString(),
            })
            .eq("id", ad.id);
        }

        processedCount++;
      } catch (adError) {
        console.error(`Error processing ad ${ad.id}:`, adError);
      }
    }

    console.log(`Poll job complete: processed=${processedCount}, retried=${retriedCount}, failed=${failedCount}, timedOut=${timedOutCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${processedCount} video ads`,
        processed: processedCount,
        retried: retriedCount,
        failed: failedCount,
        timedOut: timedOutCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in poll-video-status:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
