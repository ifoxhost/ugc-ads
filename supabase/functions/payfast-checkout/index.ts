import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import md5 from "https://esm.sh/md5@2.3.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Plan {
  name: string;
  price: number;
  credits: number;
}

const plans: Record<string, Plan> = {
  starter: { name: "Starter", price: 199.00, credits: 20 },
  pro: { name: "Pro", price: 499.00, credits: 100 },
  studio: { name: "Studio", price: 1299.00, credits: 400 }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { plan_id } = await req.json();
    const plan = plans[plan_id];
    
    if (!plan) {
      return new Response(
        JSON.stringify({ error: "Invalid plan" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile for email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.id)
      .single();

    const merchant_id = Deno.env.get('PAYFAST_MERCHANT_ID');
    const merchant_key = Deno.env.get('PAYFAST_MERCHANT_KEY');
    const passphrase = Deno.env.get('PAYFAST_PASSPHRASE');
    
    const return_url = `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/payments/success`;
    const cancel_url = `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/payments/cancel`;
    const notify_url = `${supabaseUrl}/functions/v1/payfast-webhook`;

    const payment_id = `${user.id}-${plan_id}-${Date.now()}`;
    
    // Create params object
    const params: Record<string, string> = {
      merchant_id: merchant_id!,
      merchant_key: merchant_key!,
      return_url,
      cancel_url,
      notify_url,
      name_first: profile?.full_name?.split(' ')[0] || 'User',
      name_last: profile?.full_name?.split(' ').slice(1).join(' ') || 'Studio',
      email_address: profile?.email || user.email || 'user@ugcads.co.za',
      m_payment_id: payment_id,
      amount: plan.price.toFixed(2),
      item_name: `${plan.name} Plan`,
      subscription_type: '1',
      frequency: '3',
      cycles: '0'
    };

    // Generate signature - PayFast requires specific encoding
    // Build signature string with raw values, no encoding
    const sortedKeys = Object.keys(params).sort();
    const signatureParams = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
    const signatureString = `${signatureParams}&passphrase=${encodeURIComponent(passphrase!).trim()}`;
    
    console.log('Signature string:', signatureString);
    const signature = md5(signatureString);
    console.log('Generated signature:', signature);

    params.signature = signature;

    // Create URL - URLSearchParams will handle encoding
    const urlParams = new URLSearchParams(params);
    const redirect_url = `https://www.payfast.co.za/eng/process?${urlParams.toString()}`;

    // Store pending transaction
    await supabase.from('transactions').insert({
      user_id: user.id,
      payment_id,
      amount: plan.price,
      status: 'pending',
      metadata: { plan_id, plan_name: plan.name }
    });

    return new Response(
      JSON.stringify({ redirect_url, payment_id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    // SECURITY: Log detailed errors server-side only
    console.error('PayFast checkout error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    
    // SECURITY: Map errors to safe codes without exposing internal details
    let errorCode = 'CHECKOUT_FAILED';
    let userMessage = 'Failed to initialize payment. Please try again.';
    
    if (error instanceof Error) {
      if (error.message.includes('Unauthorized')) {
        errorCode = 'UNAUTHORIZED';
        userMessage = 'Authentication required. Please log in.';
      } else if (error.message.includes('Invalid plan')) {
        errorCode = 'INVALID_PLAN';
        userMessage = 'Invalid subscription plan selected.';
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: userMessage,
        code: errorCode
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
