import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Plan {
  name: string;
  price: number;
  credits: number;
  stripe_product_id: string;
}

const plans: Record<string, Plan> = {
  starter: { 
    name: "Starter", 
    price: 199.00, 
    credits: 20,
    stripe_product_id: "prod_TDxz0hLhTpZkct"
  },
  pro: { 
    name: "Pro", 
    price: 499.00, 
    credits: 100,
    stripe_product_id: "prod_TDy0dHGWf8uJsw"
  },
  studio: { 
    name: "Studio", 
    price: 1299.00, 
    credits: 400,
    stripe_product_id: "prod_TDy1hm7l8BGJa5"
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
    });

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

    const customerEmail = profile?.email || user.email || 'user@ugcads.co.za';

    // Check if customer exists in Stripe
    let customerId: string;
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingSub?.stripe_customer_id) {
      customerId = existingSub.stripe_customer_id;
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: customerEmail,
        name: profile?.full_name || 'UGC Ads User',
        metadata: {
          user_id: user.id,
        }
      });
      customerId = customer.id;
    }

    // Get the price ID for this product
    const prices = await stripe.prices.list({
      product: plan.stripe_product_id,
      active: true,
      type: 'recurring',
    });

    if (prices.data.length === 0) {
      throw new Error('No active price found for this product');
    }

    const priceId = prices.data[0].id;

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${req.headers.get('origin') || 'https://eqiwbtxomiskpekgrsph.lovable.app'}/payments?success=true`,
      cancel_url: `${req.headers.get('origin') || 'https://eqiwbtxomiskpekgrsph.lovable.app'}/pricing?canceled=true`,
      metadata: {
        user_id: user.id,
        plan_id: plan_id,
      },
    });

    console.log('Stripe checkout session created:', {
      session_id: session.id,
      user_id: user.id,
      plan_id: plan_id,
    });

    // Store pending transaction
    await supabase.from('transactions').insert({
      user_id: user.id,
      payment_id: session.id,
      amount: plan.price,
      status: 'pending',
      payment_method: 'stripe',
      metadata: { plan_id, plan_name: plan.name, stripe_session_id: session.id }
    });

    return new Response(
      JSON.stringify({ 
        checkout_url: session.url,
        session_id: session.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Stripe checkout error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    
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
