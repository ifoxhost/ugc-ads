import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Single-stage video-only webhook - expects { urls: [...], callbackUrl, adId, email }
const VIDEO_WEBHOOK_URL = "https://ugcadsza.app.n8n.cloud/webhook-test/bc1c18ae-2223-48ed-b4b1-3e8c9b70a18d";

// Generate a unique task ID for tracking
function generateTaskId(): string {
  return `vt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Extract video URL from response
function extractVideoUrl(response: any): string | null {
  // Handle array response (workflow returns allIncomingItems)
  if (Array.isArray(response) && response.length > 0) {
    const item = response[0];
    // Check for Kie API response structure
    if (item?.data?.videoUrl) return item.data.videoUrl;
    if (item?.data?.url) return item.data.url;
    if (item?.videoUrl) return item.videoUrl;
    if (item?.url) return item.url;
  }

  // Handle single object response
  const candidates = [
    response?.data?.videoUrl,
    response?.data?.url,
    response?.videoUrl,
    response?.video_url,
    response?.generatedVideoUrl,
    response?.generated_video_url,
    response?.outputUrl,
    response?.output_url,
    response?.url,
    response?.webViewLink,
    response?.downloadUrl,
  ].filter(Boolean);

  if (candidates.length > 0) return String(candidates[0]);
  return null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body = await req.json();
    const {
      adId,
      sourceImageUrl,      // Single image URL (from existing ad or product)
      sourceImageUrls,     // Array of image URLs (for multi-image video)
      productImageUrl,     // Fallback product image
      aspectRatio,
      isConversion,        // true if converting from existing image ad
      isRetry,             // true if retrying a failed generation
      // Form fields for n8n workflow
      productDescription,
      adCopy,
      characters,
      watermark,
      videoDuration,
      // Internal-only fields
      userId: internalUserId,
      email: internalEmail,
    } = body;

    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bearer = authHeader.replace("Bearer ", "");
    const isInternalCall = bearer === supabaseServiceKey;

    let user: { id: string; email: string | null } | null = null;

    if (isInternalCall) {
      if (!internalUserId || !internalEmail) {
        return new Response(
          JSON.stringify({ error: "userId and email are required for internal calls" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      user = { id: internalUserId, email: internalEmail };
    } else {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(bearer);
      if (authError || !authUser) {
        return new Response(
          JSON.stringify({ error: "Invalid authentication" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      user = { id: authUser.id, email: authUser.email ?? null };
    }

    if (!user.email) {
      return new Response(
        JSON.stringify({ error: "User email not available" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the urls array for the n8n workflow
    let imageUrls: string[] = [];
    
    if (sourceImageUrls && Array.isArray(sourceImageUrls) && sourceImageUrls.length > 0) {
      imageUrls = sourceImageUrls;
    } else if (sourceImageUrl) {
      imageUrls = [sourceImageUrl];
    } else if (productImageUrl) {
      imageUrls = [productImageUrl];
    }

    if (imageUrls.length === 0) {
      return new Response(
        JSON.stringify({ error: "At least one image URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing video ad request:", { 
      adId, 
      isConversion,
      isRetry,
      aspectRatio,
      imageCount: imageUrls.length,
      imageUrls
    });

    // Check for duplicate/in-progress renders
    if (adId && !isRetry) {
      const { data: existingAd } = await supabase
        .from("generated_ads")
        .select("video_status, video_task_id")
        .eq("id", adId)
        .single();

      if (existingAd && ['queued', 'processing'].includes(existingAd.video_status)) {
        console.log("Video already in progress, skipping duplicate request");
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Video generation already in progress",
            adId: adId,
            taskId: existingAd.video_task_id,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Generate unique task ID for tracking
    const taskId = generateTaskId();
    console.log("Generated task ID:", taskId);

    let targetAdId = adId;

    // If converting or retrying an existing ad, update its status
    if ((isConversion || isRetry) && adId) {
      const nowIso = new Date().toISOString();
      const updateData: Record<string, unknown> = {
        status: "video_processing",
        video_status: "queued",
        video_task_id: taskId,
        video_retry_count: 0,
        video_progress: 0,
        video_last_checked_at: nowIso,
        generated_video_url: null,
        completed_at: null,
        video_duration: null,
      };

      await supabase
        .from("generated_ads")
        .update(updateData)
        .eq("id", adId);
    } else {
      // Create new record for video ad
      const { data: newAd, error: insertError } = await supabase
        .from("generated_ads")
        .insert({
          user_id: user.id,
          email: user.email,
          product_image_url: imageUrls[0],
          generated_image_url: imageUrls[0], // Store the source image
          style_template: "video-ugc",
          aspect_ratio: aspectRatio || "9:16",
          status: "video_processing",
          video_status: "queued",
          video_task_id: taskId,
          video_retry_count: 0,
          video_last_checked_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error("Failed to create ad record:", insertError);
        throw new Error("Failed to create ad record");
      }
      
      targetAdId = newAd.id;
    }

    // Update status to processing before calling webhook
    await supabase
      .from("generated_ads")
      .update({
        video_status: "processing",
        video_progress: 10,
        video_last_checked_at: new Date().toISOString(),
      })
      .eq("id", targetAdId);

    // Build callback URL for n8n to notify when video is complete
    const callbackUrl = `${supabaseUrl}/functions/v1/ugc-webhook-callback`;
    
    // Call the video-only webhook with urls array and callback info
    console.log("=== Calling Video Generation Webhook ===");
    console.log("URL:", VIDEO_WEBHOOK_URL);
    console.log("Callback URL:", callbackUrl);
    console.log("Payload:", { urls: imageUrls, adId: targetAdId, email: user.email });
    
    const webhookResponse = await fetch(VIDEO_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        urls: imageUrls,
        adId: targetAdId,
        taskId,
        userId: user.id,
        email: user.email,
        callbackUrl, // n8n should POST to this URL when video is ready
        isVideoAd: true, // Flag for callback identification
        // Form data for n8n prompts
        productDescription: productDescription || "",
        adCopy: adCopy || "",
        characters: characters || "",
        watermark: watermark || "",
        videoDuration: videoDuration || "short",
        aspectRatio: aspectRatio || "9:16",
      }),
    });

    console.log("Webhook response status:", webhookResponse.status);

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      console.error("Webhook error:", errorText);
      
      // Update status to failed
      await supabase
        .from("generated_ads")
        .update({ 
          status: "video_failed",
          video_status: "failed",
        })
        .eq("id", targetAdId);
      
      throw new Error(`Webhook failed: ${webhookResponse.status}`);
    }

    const responseText = await webhookResponse.text().catch(() => "");
    let webhookResult: any = {};

    try {
      webhookResult = responseText ? JSON.parse(responseText) : {};
    } catch {
      console.log("Webhook response is not JSON:", responseText);
      webhookResult = {};
    }

    console.log("Webhook response:", JSON.stringify(webhookResult, null, 2));

    // Check if webhook returned a video URL
    const videoUrl = extractVideoUrl(webhookResult);

    if (videoUrl) {
      console.log("Webhook returned video URL:", videoUrl);
      
      const nowIso = new Date().toISOString();
      await supabase
        .from("generated_ads")
        .update({
          status: "completed",
          video_status: "complete",
          generated_video_url: videoUrl,
          video_progress: 100,
          completed_at: nowIso,
          video_last_checked_at: nowIso,
        })
        .eq("id", targetAdId);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Video generation completed",
          adId: targetAdId,
          taskId,
          videoStatus: "complete",
          videoUrl,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No immediate video URL - workflow is processing asynchronously
    console.log("No immediate video URL, workflow is processing asynchronously");
    
    await supabase
      .from("generated_ads")
      .update({
        video_status: "processing",
        video_progress: 30,
        video_last_checked_at: new Date().toISOString(),
      })
      .eq("id", targetAdId);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Video generation started",
        adId: targetAdId,
        taskId,
        videoStatus: "processing",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in submit-video-ad:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error occurred",
        success: false,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
