import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const plans = {
  starter: { credits: 20 },
  pro: { credits: 100 },
  studio: { credits: 400 }
};

serve(async (req) => {
  try {
    // SECURITY: IP Whitelist for PayFast servers
    const PAYFAST_IPS = ['197.97.145.144', '197.97.145.145', '41.74.179.194', '41.74.179.195'];
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip')?.trim() || 
                     'unknown';
    
    console.log('PayFast webhook attempt from IP:', clientIP);
    
    if (clientIP !== 'unknown' && !PAYFAST_IPS.includes(clientIP)) {
      console.warn(`SECURITY: Unauthorized PayFast webhook attempt from IP: ${clientIP}`);
      return new Response('Unauthorized', { status: 403 });
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const formData = await req.formData();
    const body: Record<string, string> = {};
    formData.forEach((value, key) => {
      body[key] = value.toString();
    });

    console.log('PayFast webhook received:', body);

    const { m_payment_id, payment_status, amount_gross, signature } = body;

    // Verify signature
    const passphrase = Deno.env.get('PAYFAST_PASSPHRASE');
    const params = { ...body };
    delete params.signature;
    
    const sortedParams = Object.keys(params).sort().map(key => 
      `${key}=${encodeURIComponent(params[key]).replace(/%20/g, '+')}`
    ).join('&');
    
    const signatureString = `${sortedParams}&passphrase=${passphrase}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(signatureString);
    const hashBuffer = await crypto.subtle.digest('MD5', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const expectedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    if (signature !== expectedSignature) {
      console.error('SECURITY: Invalid PayFast signature detected', {
        clientIP,
        payment_id: m_payment_id,
        timestamp: new Date().toISOString()
      });
      return new Response('Invalid signature', { status: 400 });
    }
    
    console.log('PayFast signature verified successfully', {
      payment_id: m_payment_id,
      status: payment_status
    });

    // Extract user_id and plan_id from m_payment_id
    const [user_id, plan_id] = m_payment_id.split('-');

    if (payment_status === 'COMPLETE') {
      const plan = plans[plan_id as keyof typeof plans];
      
      if (!plan) {
        console.error('Invalid plan:', plan_id);
        return new Response('Invalid plan', { status: 400 });
      }

      const renew_date = new Date();
      renew_date.setMonth(renew_date.getMonth() + 1);

      // Upsert subscription
      const { error: subError } = await supabase
        .from('subscriptions')
        .upsert({
          user_id,
          plan_id,
          amount: parseFloat(amount_gross),
          credits: plan.credits,
          credits_used: 0,
          renew_date: renew_date.toISOString(),
          status: 'active'
        }, { onConflict: 'user_id' });

      if (subError) {
        console.error('Subscription update error:', subError);
        throw subError;
      }

      // Update transaction
      await supabase
        .from('transactions')
        .update({ status: 'success' })
        .eq('payment_id', m_payment_id);

      console.log('Subscription activated for user:', user_id);
    } else {
      // Update transaction as failed
      await supabase
        .from('transactions')
        .update({ status: 'failed' })
        .eq('payment_id', m_payment_id);

      console.log('Payment failed for:', m_payment_id);
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    // SECURITY: Log detailed errors server-side only
    console.error('PayFast webhook error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    
    // SECURITY: Return generic error to client
    return new Response('Processing error', { status: 500 });
  }
});
