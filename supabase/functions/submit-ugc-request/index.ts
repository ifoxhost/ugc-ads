import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WEBHOOK_URL = "https://realaiforge.app.n8n.cloud/webhook/ugc-influencer-webhook";
const MAX_RETRIES = 3;
const RATE_LIMIT_PER_MINUTE = 10;

// In-memory rate limiting (resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + 60000 });
    return true;
  }
  
  if (userLimit.count >= RATE_LIMIT_PER_MINUTE) {
    return false;
  }
  
  userLimit.count++;
  return true;
}

// Input validation schema
interface UGCRequestInput {
  brandProduct: string;
  influencerType: string;
  tone: string;
  contentStyle: string;
  talkingPoints: string;
  setting: string;
  productImageUrl?: string;
  voiceId: string;
  email: string;
}

function validateInput(data: any): { valid: boolean; errors?: string[]; data?: UGCRequestInput } {
  const errors: string[] = [];
  
  // Validate brandProduct
  if (!data.brandProduct || typeof data.brandProduct !== 'string') {
    errors.push('Brand/Product is required');
  } else if (data.brandProduct.trim().length === 0) {
    errors.push('Brand/Product cannot be empty');
  } else if (data.brandProduct.length > 200) {
    errors.push('Brand/Product must be less than 200 characters');
  }
  
  // Validate influencerType
  const validInfluencerTypes = ['Fitness', 'Beauty', 'Tech', 'Lifestyle', 'Fashion', 'Food', 'Travel', 'Gaming'];
  if (!data.influencerType || !validInfluencerTypes.includes(data.influencerType)) {
    errors.push('Invalid influencer type');
  }
  
  // Validate tone
  const validTones = ['Excited', 'Professional', 'Casual', 'Authentic'];
  if (!data.tone || !validTones.includes(data.tone)) {
    errors.push('Invalid tone');
  }
  
  // Validate contentStyle
  const validContentStyles = ['Review', 'Tutorial', 'Unboxing', 'Testimonial'];
  if (!data.contentStyle || !validContentStyles.includes(data.contentStyle)) {
    errors.push('Invalid content style');
  }
  
  // Validate setting
  const validSettings = ['Home', 'Studio', 'Outdoor', 'Office'];
  if (!data.setting || !validSettings.includes(data.setting)) {
    errors.push('Invalid setting');
  }
  
  // Validate talkingPoints
  if (!data.talkingPoints || typeof data.talkingPoints !== 'string') {
    errors.push('Talking points are required');
  } else if (data.talkingPoints.trim().length < 10) {
    errors.push('Talking points must be at least 10 characters');
  } else if (data.talkingPoints.length > 2000) {
    errors.push('Talking points must be less than 2000 characters');
  }
  
  // Validate voiceId
  if (!data.voiceId || typeof data.voiceId !== 'string') {
    errors.push('Voice ID is required');
  }
  
  // Validate email
  if (!data.email || typeof data.email !== 'string') {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('Invalid email format');
  }
  
  // Validate productImageUrl if provided
  if (data.productImageUrl && typeof data.productImageUrl !== 'string') {
    errors.push('Invalid product image URL');
  } else if (data.productImageUrl && data.productImageUrl.length > 500) {
    errors.push('Product image URL too long');
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  return {
    valid: true,
    data: {
      brandProduct: data.brandProduct.trim(),
      influencerType: data.influencerType,
      tone: data.tone,
      contentStyle: data.contentStyle,
      talkingPoints: data.talkingPoints.trim(),
      setting: data.setting,
      productImageUrl: data.productImageUrl,
      voiceId: data.voiceId,
      email: data.email.trim()
    }
  };
}

async function triggerWebhook(requestData: any, retryCount: number = 0): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`Triggering webhook (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`, {
      brandProduct: requestData.brandProduct,
      email: requestData.email
    });

    // Format payload for n8n webhook
    const webhookPayload = {
      body: {
        "Brand/Product": requestData.brandProduct,
        "Influencer Type": requestData.influencerType,
        "Tone": requestData.tone,
        "Content Style": requestData.contentStyle,
        "Talking Points": requestData.talkingPoints,
        "Setting": requestData.setting,
        "Product Image URL": requestData.productImageUrl,
        "voiceId": requestData.voiceId,
        "email": requestData.email,
        "Callback URL": "https://eqiwbtxomiskpekgrsph.supabase.co/functions/v1/ugc-webhook-callback",
        "requestId": requestData.requestId,
      }
    };

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed with status: ${response.status}`);
    }

    console.log('Webhook triggered successfully');
    return { success: true };
  } catch (error: any) {
    console.error(`Webhook error (attempt ${retryCount + 1}):`, error.message);
    
    if (retryCount < MAX_RETRIES) {
      // Exponential backoff: 2^retryCount seconds
      const delayMs = Math.pow(2, retryCount) * 1000;
      console.log(`Retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return triggerWebhook(requestData, retryCount + 1);
    }
    
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      console.error('Authentication error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit
    if (!checkRateLimit(user.id)) {
      console.warn(`Rate limit exceeded for user ${user.id}`);
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SERVER-SIDE SECURITY: Validate subscription and credits
    console.log('Checking subscription and credits for user:', user.id);
    
    const { data: subscription, error: subError } = await supabaseClient
      .from('subscriptions')
      .select('credits, credits_used, status, renew_date')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();
    
    if (subError || !subscription) {
      console.warn('No active subscription found for user:', user.id);
      return new Response(
        JSON.stringify({ 
          error: 'No active subscription found. Please subscribe to continue.',
          code: 'NO_SUBSCRIPTION'
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Check if subscription has expired
    if (new Date(subscription.renew_date) < new Date()) {
      console.warn('Subscription expired for user:', user.id);
      return new Response(
        JSON.stringify({ 
          error: 'Your subscription has expired. Please renew to continue.',
          code: 'SUBSCRIPTION_EXPIRED'
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Check if user has available credits
    const availableCredits = subscription.credits - subscription.credits_used;
    if (availableCredits <= 0) {
      console.warn('No credits available for user:', user.id);
      return new Response(
        JSON.stringify({ 
          error: 'No credits available. Please upgrade your plan or wait for renewal.',
          code: 'NO_CREDITS'
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Subscription validated. Available credits:', availableCredits);

    const requestData = await req.json();
    
    // SERVER-SIDE SECURITY: Validate input data
    const validation = validateInput(requestData);
    if (!validation.valid) {
      console.warn('Input validation failed:', validation.errors);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input data',
          details: validation.errors
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const validatedData = validation.data!;
    console.log('Processing validated UGC request for user:', user.id);

    // SERVER-SIDE SECURITY: Consume credit atomically BEFORE processing
    // Use service role to bypass RLS
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const { data: creditConsumed, error: creditError } = await serviceClient
      .rpc('consume_credit', {
        _user_id: user.id,
        _amount: 1
      });
    
    if (creditError || !creditConsumed) {
      console.error('Failed to consume credit:', creditError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to consume credit. Please try again.',
          code: 'CREDIT_CONSUMPTION_FAILED'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Credit consumed successfully for user:', user.id);

    // Insert request into queue
    const { data: queuedRequest, error: insertError } = await supabaseClient
      .from('ugc_requests')
      .insert({
        user_id: user.id,
        email: validatedData.email,
        status: 'pending',
        request_data: validatedData,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting request:', insertError);
      
      // Rollback credit consumption on failure (best effort)
      await serviceClient
        .from('subscriptions')
        .update({ 
          credits_used: subscription.credits_used,
          updated_at: new Date().toISOString() 
        })
        .eq('user_id', user.id)
        .eq('status', 'active');
      
      return new Response(
        JSON.stringify({ error: 'Failed to queue request' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Request queued:', queuedRequest.id);

    // Update status to processing
    await supabaseClient
      .from('ugc_requests')
      .update({ status: 'processing' })
      .eq('id', queuedRequest.id);

    // Trigger webhook in background (fire and forget with retry logic)
    triggerWebhook({
      ...validatedData,
      requestId: queuedRequest.id,
    }).then(async (result) => {
      // Use service role key for background update
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      if (!result.success) {
        await serviceClient
          .from('ugc_requests')
          .update({
            status: 'failed',
            error_message: result.error,
            retry_count: MAX_RETRIES,
          })
          .eq('id', queuedRequest.id);
      }
    }).catch((error) => {
      console.error('Background webhook trigger failed:', error);
    });

    // Return immediately
    return new Response(
      JSON.stringify({
        success: true,
        requestId: queuedRequest.id,
        message: 'Your request has been queued and is being processed.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    // SECURITY: Log detailed errors server-side only
    console.error('Error in submit-ugc-request:', {
      error: error?.message || 'Unknown error',
      stack: error?.stack,
      timestamp: new Date().toISOString()
    });
    
    // SECURITY: Return generic error without exposing internal details
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process your request. Please try again.',
        code: 'REQUEST_FAILED'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});