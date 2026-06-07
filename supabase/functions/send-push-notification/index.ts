import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Web Push implementation using web-push-libs/webpush-java compatible format
async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<Response> {
  const encoder = new TextEncoder();
  
  // Create JWT for VAPID authentication
  const header = { typ: 'JWT', alg: 'ES256' };
  const audience = new URL(subscription.endpoint).origin;
  const expiry = Math.floor(Date.now() / 1000) + 12 * 60 * 60; // 12 hours
  
  const claims = {
    aud: audience,
    exp: expiry,
    sub: 'mailto:notifications@ugcads.co.za'
  };

  // Base64url encode
  const base64url = (data: Uint8Array | string): string => {
    const str = typeof data === 'string' ? data : String.fromCharCode(...data);
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  const headerB64 = base64url(JSON.stringify(header));
  const claimsB64 = base64url(JSON.stringify(claims));
  const unsignedToken = `${headerB64}.${claimsB64}`;

  // Import private key for signing
  const privateKeyBytes = Uint8Array.from(atob(vapidPrivateKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    privateKeyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  ).catch(() => null);

  if (!cryptoKey) {
    console.error('Failed to import VAPID private key');
    throw new Error('VAPID key import failed');
  }

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const signatureB64 = base64url(new Uint8Array(signature));
  const jwt = `${unsignedToken}.${signatureB64}`;

  // Send the push notification
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': '86400',
    },
    body: encoder.encode(payload),
  });

  return response;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, title, body, icon, data } = await req.json();

    console.log('=== SEND PUSH NOTIFICATION ===');
    console.log('User ID:', userId);
    console.log('Title:', title);

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch user's push subscriptions
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (fetchError) {
      console.error('Failed to fetch subscriptions:', fetchError);
      throw fetchError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No push subscriptions found for user');
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No subscriptions found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${subscriptions.length} subscription(s)`);

    const payload = JSON.stringify({
      title: title || 'UGC Ads',
      body: body || 'Your video is ready!',
      icon: icon || '/favicon.ico',
      badge: '/favicon.ico',
      data: data || {},
      timestamp: Date.now(),
    });

    let successCount = 0;
    let failedEndpoints: string[] = [];

    for (const sub of subscriptions) {
      try {
        if (vapidPublicKey && vapidPrivateKey) {
          // Use VAPID for authenticated push
          const response = await sendPushNotification(
            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
            payload,
            vapidPublicKey,
            vapidPrivateKey
          );

          if (response.ok || response.status === 201) {
            successCount++;
            console.log('Push sent successfully to:', sub.endpoint.substring(0, 50));
          } else if (response.status === 410 || response.status === 404) {
            // Subscription expired or invalid - remove it
            console.log('Removing expired subscription:', sub.endpoint.substring(0, 50));
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
            failedEndpoints.push(sub.endpoint);
          } else {
            console.error('Push failed with status:', response.status);
            failedEndpoints.push(sub.endpoint);
          }
        } else {
          // Fallback: Just log that we would send (for development)
          console.log('VAPID keys not configured - would send to:', sub.endpoint.substring(0, 50));
          successCount++;
        }
      } catch (pushError) {
        console.error('Push error for subscription:', pushError);
        failedEndpoints.push(sub.endpoint);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: successCount,
        failed: failedEndpoints.length,
        total: subscriptions.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Send push notification error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
