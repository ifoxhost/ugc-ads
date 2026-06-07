import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// n8n production webhook URL for UGC Image Ads
const N8N_IMAGE_WEBHOOK_URL = "https://ugcadsza.app.n8n.cloud/webhook/9cb8c9e4-9f62-4241-9f40-267326a18287";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth token from request
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the multipart form data
    const formData = await req.formData();
    
    const productImage = formData.get("productImage") as File | null;
    const productImageUrl = formData.get("productImageUrl") as string | null;
    const productDescription = formData.get("productDescription") as string || "";
    const adCopy = formData.get("adCopy") as string || "";
    const characters = formData.get("characters") as string || "";
    const watermark = formData.get("watermark") as string || "";
    const imageCount = parseInt(formData.get("imageCount") as string || "1");

    // ── Enforce Nano Banana as the only allowed image engine ───────────────────
    const ALLOWED_IMAGE_MODEL = "nano-banana";
    const requestedModel = (formData.get("imageModel") as string | null)
      ?? (formData.get("aiImageModel") as string | null)
      ?? (formData.get("engine") as string | null)
      ?? (formData.get("model") as string | null)
      ?? ALLOWED_IMAGE_MODEL;

    const normalizedModel = String(requestedModel).toLowerCase().trim();
    if (
      normalizedModel !== ALLOWED_IMAGE_MODEL &&
      normalizedModel !== "nano-banana-pro" &&
      normalizedModel !== "google/gemini-2.5-flash-image"
    ) {
      console.warn(`Rejected image generation request — disallowed engine: ${requestedModel}`);
      return new Response(
        JSON.stringify({
          error: `Image engine "${requestedModel}" is not allowed. This service only supports Nano Banana (Google Gemini image).`,
          allowed: [ALLOWED_IMAGE_MODEL],
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Received UGC Image Ad request:", {
      userId: user.id,
      email: user.email,
      hasProductImage: !!productImage,
      productImageUrl,
      productDescription: productDescription?.substring(0, 50),
      adCopy: adCopy?.substring(0, 50),
      characters,
      watermark,
      imageCount,
    });

    // Validate input
    if (!productImage && !productImageUrl) {
      return new Response(
        JSON.stringify({ error: "Product image is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate callback URL for n8n to call back
    const callbackUrl = `${supabaseUrl}/functions/v1/ugc-webhook-callback`;

    // Create database record for each image to be generated
    const adRecords = [];
    for (let i = 0; i < imageCount; i++) {
      const { data: adRecord, error: insertError } = await supabase
        .from("generated_ads")
        .insert({
          user_id: user.id,
          email: user.email,
          product_image_url: productImageUrl || "pending-upload",
          style_template: "n8n-ugc-image",
          aspect_ratio: "auto",
          status: "processing",
          prompt_used: JSON.stringify({
            productDescription,
            adCopy,
            characters,
            watermark,
            imageIndex: i + 1,
            totalImages: imageCount,
          }),
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error creating ad record:", insertError);
        throw new Error(`Failed to create ad record: ${insertError.message}`);
      }
      
      adRecords.push(adRecord);
    }

    console.log(`Created ${adRecords.length} ad records, IDs:`, adRecords.map(r => r.id));

    // Prepare FormData for n8n webhook
    const n8nFormData = new FormData();
    
    // Add the product image (binary)
    if (productImage) {
      n8nFormData.append("productImage", productImage, productImage.name);
    } else if (productImageUrl) {
      // If we have a URL, fetch the image and send as binary
      const imageResponse = await fetch(productImageUrl);
      if (imageResponse.ok) {
        const imageBlob = await imageResponse.blob();
        n8nFormData.append("productImage", imageBlob, "product-image.jpg");
      }
    }
    
    // Add form fields that n8n expects
    n8nFormData.append("productDescription", productDescription);
    n8nFormData.append("adCopy", adCopy);
    n8nFormData.append("characters", characters);
    n8nFormData.append("watermark", watermark);
    n8nFormData.append("imageCount", String(imageCount));
    
    // Add callback data
    n8nFormData.append("callbackUrl", callbackUrl);
    n8nFormData.append("adIds", JSON.stringify(adRecords.map(r => r.id)));
    n8nFormData.append("userId", user.id);
    n8nFormData.append("email", user.email || "");

    console.log("Sending request to n8n webhook:", N8N_IMAGE_WEBHOOK_URL);

    // Call n8n webhook
    const n8nResponse = await fetch(N8N_IMAGE_WEBHOOK_URL, {
      method: "POST",
      body: n8nFormData,
    });

    const responseText = await n8nResponse.text();
    console.log("n8n response status:", n8nResponse.status);
    console.log("n8n response:", responseText.substring(0, 500));

    if (!n8nResponse.ok) {
      // Update records to failed status
      for (const record of adRecords) {
        await supabase
          .from("generated_ads")
          .update({ 
            status: "failed",
            prompt_used: JSON.stringify({
              ...JSON.parse(record.prompt_used || "{}"),
              error: `n8n webhook failed: ${n8nResponse.status}`,
            }),
          })
          .eq("id", record.id);
      }
      
      throw new Error(`n8n webhook failed: ${n8nResponse.status} - ${responseText}`);
    }

    // Parse response - n8n returns array of results with Link field
    let n8nResult;
    try {
      n8nResult = JSON.parse(responseText);
    } catch {
      n8nResult = responseText;
    }

    console.log("Parsed n8n result:", JSON.stringify(n8nResult).substring(0, 500));

    // Handle the response - n8n returns array of { Link: "url" } objects
    if (Array.isArray(n8nResult)) {
      // Update each ad record with the corresponding generated image
      for (let i = 0; i < adRecords.length && i < n8nResult.length; i++) {
        const imageUrl = n8nResult[i]?.Link || n8nResult[i]?.link || n8nResult[i]?.url;
        
        if (imageUrl) {
          await supabase
            .from("generated_ads")
            .update({
              generated_image_url: imageUrl,
              status: "completed",
              completed_at: new Date().toISOString(),
            })
            .eq("id", adRecords[i].id);
          
          console.log(`Updated ad ${adRecords[i].id} with image:`, imageUrl);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Started generating ${imageCount} UGC image ad(s)`,
        adIds: adRecords.map(r => r.id),
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("Error in submit-ugc-image-ad:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
