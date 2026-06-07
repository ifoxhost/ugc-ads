import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// UGC style prompts
const STYLE_PROMPTS: Record<string, string> = {
  lifestyle: "lifestyle product photography showing product being used naturally in everyday life, casual authentic moment, real home or outdoor environment, natural ambient lighting, Instagram-native aesthetic, slight imperfections for authenticity",
  handheld: "first-person POV hand holding product, creator perspective shot, casual grip, natural daylight from window, authentic UGC style, slightly imperfect framing for realism, social media native look",
  flatlay: "aesthetic flat lay product photography, top-down bird's eye view, styled on textured surface like marble or linen, carefully arranged props, soft natural lighting, Instagram-worthy composition",
  "before-after": "split view before and after comparison image, clean dividing line, same lighting on both sides, professional yet authentic look, showing product transformation or results",
  testimonial: "product photograph with clean background, ample space for text overlay, soft diffused lighting, minimal aesthetic, perfect for adding review quotes, testimonial-ready composition",
  "minimal-studio": "minimal studio product shot, clean neutral background, soft natural lighting with gentle shadows, UGC-realistic not overly polished, authentic creator studio aesthetic"
};

async function analyzeProduct(imageUrl: string): Promise<string> {
  console.log("Analyzing product from image:", imageUrl);
  
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this product image and provide a concise description including:
1. Product type/category
2. Key visual features (color, texture, size)
3. Likely use case or target audience
4. Best angles or presentation style for UGC ads

Keep the response under 100 words, focused on visual attributes for image generation.`
            },
            {
              type: "image_url",
              image_url: { url: imageUrl }
            }
          ]
        }
      ]
    }),
  });

  if (!response.ok) {
    console.error("Product analysis failed:", response.status);
    throw new Error("Failed to analyze product");
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "A product suitable for UGC advertising";
}

async function generateAdCopy(productAnalysis: string, styleId: string): Promise<{
  headline: string;
  cta: string;
  caption: string;
  hashtags: string[];
}> {
  console.log("Generating ad copy for style:", styleId);
  
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: "You are an expert UGC ad copywriter. Write authentic, creator-style copy that converts."
        },
        {
          role: "user",
          content: `Based on this product analysis: "${productAnalysis}"

Generate ad copy for a ${styleId} style UGC ad. Respond in valid JSON only:
{
  "headline": "Short punchy headline (max 8 words)",
  "cta": "One of: Shop Now, Buy Now, Learn More, Try It, Get Yours",
  "caption": "Instagram-style caption (2-3 sentences, authentic voice)",
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5"]
}`
        }
      ]
    }),
  });

  if (!response.ok) {
    console.error("Ad copy generation failed:", response.status);
    throw new Error("Failed to generate ad copy");
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  
  try {
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error("Failed to parse ad copy JSON:", e);
  }
  
  // Fallback
  return {
    headline: "Must-Have Product",
    cta: "Shop Now",
    caption: "You need to try this! Absolutely obsessed with this product. Link in bio!",
    hashtags: ["#ad", "#ugc", "#sponsored", "#musthave", "#trending"]
  };
}

interface Demographics {
  gender: string;
  bodyBuild: string;
  ageRange: string;
  ethnicity: string | string[];
}

function buildDemographicsPrompt(demographics?: Demographics): string {
  if (!demographics) return "";
  
  const parts: string[] = [];
  
  if (demographics.gender && demographics.gender !== "any") {
    parts.push(`${demographics.gender} model`);
  }
  
  // Handle ethnicity as array or string
  const ethnicityValue = demographics.ethnicity;
  if (ethnicityValue) {
    if (Array.isArray(ethnicityValue)) {
      const validEthnicities = ethnicityValue.filter(e => e !== "any");
      if (validEthnicities.length > 0) {
        if (validEthnicities.includes("random")) {
          // Random - let AI pick
          parts.push("diverse ethnicity (AI's choice)");
        } else if (validEthnicities.length === 1) {
          parts.push(`${validEthnicities[0]} ethnicity`);
        } else {
          // Multiple selected - pick one randomly
          const picked = validEthnicities[Math.floor(Math.random() * validEthnicities.length)];
          parts.push(`${picked} ethnicity`);
        }
      }
    } else if (ethnicityValue !== "any") {
      parts.push(`${ethnicityValue} ethnicity`);
    }
  }
  
  if (demographics.ageRange && demographics.ageRange !== "any") {
    parts.push(`${demographics.ageRange} years old`);
  }
  if (demographics.bodyBuild && demographics.bodyBuild !== "any") {
    parts.push(`${demographics.bodyBuild} body type`);
  }
  
  return parts.length > 0 ? `Model appearance: ${parts.join(", ")}. ` : "";
}

async function generateImage(productAnalysis: string, styleId: string, aspectRatio: string, customPrompt?: string, demographics?: Demographics): Promise<string> {
  console.log("Generating UGC image for style:", styleId, "aspect:", aspectRatio, "custom:", customPrompt, "demographics:", demographics);
  
  const stylePrompt = STYLE_PROMPTS[styleId] || STYLE_PROMPTS["lifestyle"];
  const demographicsPrompt = buildDemographicsPrompt(demographics);
  
  let prompt = `Realistic UGC-style product photo, ${stylePrompt}. 
${demographicsPrompt}Product details: ${productAnalysis}
Style: authentic user-generated content, not stock photography, natural imperfections, social-media native aesthetic, 
high quality but casual feel, real creator environment.`;

  // Append custom instructions if provided
  if (customPrompt) {
    prompt += `\nAdditional styling: ${customPrompt}`;
  }

  prompt += `\nUltra high resolution, professional lighting.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image-preview",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      modalities: ["image", "text"]
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Image generation failed:", response.status, errorText);
    throw new Error("Failed to generate image");
  }

  const data = await response.json();
  const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  
  if (!imageData) {
    throw new Error("No image generated");
  }
  
  return imageData;
}

async function uploadImageToStorage(supabase: any, base64Data: string, adId: string): Promise<string> {
  // Remove data URL prefix if present
  const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const binaryData = Uint8Array.from(atob(base64Content), c => c.charCodeAt(0));
  
  const fileName = `generated-ads/${adId}.png`;
  
  const { data, error } = await supabase.storage
    .from("ugc-generated")
    .upload(fileName, binaryData, {
      contentType: "image/png",
      upsert: true
    });

  if (error) {
    console.error("Storage upload error:", error);
    throw error;
  }

  const { data: urlData } = supabase.storage
    .from("ugc-generated")
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { adId, productImageUrl, styleId, aspectRatio, customPrompt, demographics, userId, email } = await req.json();
    
    console.log("Starting UGC ad generation:", { adId, styleId, aspectRatio, customPrompt, demographics });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Step 1: Analyze product
    const productAnalysis = await analyzeProduct(productImageUrl);
    console.log("Product analysis complete:", productAnalysis);

    // Step 2: Generate ad copy
    const adCopy = await generateAdCopy(productAnalysis, styleId);
    console.log("Ad copy generated:", adCopy);

    // Step 3: Generate image
    const generatedImageBase64 = await generateImage(productAnalysis, styleId, aspectRatio, customPrompt, demographics);
    
    // Step 4: Upload to storage
    const generatedImageUrl = await uploadImageToStorage(supabase, generatedImageBase64, adId);
    console.log("Image uploaded:", generatedImageUrl);

    // Step 5: Update database
    const { error: updateError } = await supabase
      .from("generated_ads")
      .update({
        generated_image_url: generatedImageUrl,
        ad_copy: adCopy,
        prompt_used: `${STYLE_PROMPTS[styleId]} - ${productAnalysis}${customPrompt ? ` | Custom: ${customPrompt}` : ""}`,
        status: "completed",
        completed_at: new Date().toISOString()
      })
      .eq("id", adId);

    if (updateError) {
      console.error("Database update error:", updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        generatedImageUrl,
        adCopy 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("UGC ad generation error:", error);

    // Try to update status to failed
    try {
      const { adId } = await req.clone().json();
      if (adId) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabase
          .from("generated_ads")
          .update({ status: "failed" })
          .eq("id", adId);
      }
    } catch (e) {
      console.error("Failed to update status:", e);
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
