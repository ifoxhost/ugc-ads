import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limit configuration
const MAX_ATTEMPTS = 5; // Max attempts before lockout
const LOCKOUT_DURATION_MINUTES = 15; // Lockout duration
const WINDOW_MINUTES = 15; // Time window for counting attempts

interface RateLimitRequest {
  email: string;
  action: "check" | "record_attempt" | "record_success";
}

interface RateLimitResponse {
  allowed: boolean;
  remaining_attempts?: number;
  locked_until?: string;
  message?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, action } = (await req.json()) as RateLimitRequest;

    if (!email || !action) {
      return new Response(
        JSON.stringify({ error: "Missing email or action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get client IP for additional tracking
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("cf-connecting-ip") || 
                     "unknown";

    const normalizedEmail = email.toLowerCase().trim();
    const now = new Date();
    const windowStart = new Date(now.getTime() - WINDOW_MINUTES * 60 * 1000);

    console.log(`[Rate Limit] Action: ${action}, Email: ${normalizedEmail}, IP: ${clientIP}`);

    if (action === "check") {
      // Check if email is currently locked
      const { data: emailRecord } = await supabase
        .from("auth_rate_limits")
        .select("*")
        .eq("identifier", normalizedEmail)
        .eq("identifier_type", "email")
        .single();

      // Check if locked
      if (emailRecord?.locked_until && new Date(emailRecord.locked_until) > now) {
        const lockedUntil = new Date(emailRecord.locked_until);
        const remainingMinutes = Math.ceil((lockedUntil.getTime() - now.getTime()) / 60000);
        
        console.log(`[Rate Limit] Email ${normalizedEmail} is locked until ${lockedUntil.toISOString()}`);
        
        return new Response(
          JSON.stringify({
            allowed: false,
            locked_until: emailRecord.locked_until,
            message: `Too many failed attempts. Please try again in ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}.`,
          } as RateLimitResponse),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check attempt count within window
      if (emailRecord && new Date(emailRecord.first_attempt_at) > windowStart) {
        const remainingAttempts = Math.max(0, MAX_ATTEMPTS - emailRecord.attempt_count);
        
        return new Response(
          JSON.stringify({
            allowed: true,
            remaining_attempts: remainingAttempts,
          } as RateLimitResponse),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // No record or old record - allowed
      return new Response(
        JSON.stringify({
          allowed: true,
          remaining_attempts: MAX_ATTEMPTS,
        } as RateLimitResponse),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "record_attempt") {
      // Record a failed login attempt
      const { data: existingRecord } = await supabase
        .from("auth_rate_limits")
        .select("*")
        .eq("identifier", normalizedEmail)
        .eq("identifier_type", "email")
        .single();

      if (existingRecord) {
        // Check if we should reset the window
        const recordWindowStart = new Date(existingRecord.first_attempt_at);
        
        if (recordWindowStart < windowStart) {
          // Reset the window
          await supabase
            .from("auth_rate_limits")
            .update({
              attempt_count: 1,
              first_attempt_at: now.toISOString(),
              last_attempt_at: now.toISOString(),
              locked_until: null,
            })
            .eq("id", existingRecord.id);

          console.log(`[Rate Limit] Reset window for ${normalizedEmail}`);
          
          return new Response(
            JSON.stringify({
              allowed: true,
              remaining_attempts: MAX_ATTEMPTS - 1,
            } as RateLimitResponse),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Increment attempt count
        const newAttemptCount = existingRecord.attempt_count + 1;
        const shouldLock = newAttemptCount >= MAX_ATTEMPTS;
        const lockedUntil = shouldLock 
          ? new Date(now.getTime() + LOCKOUT_DURATION_MINUTES * 60 * 1000).toISOString()
          : null;

        await supabase
          .from("auth_rate_limits")
          .update({
            attempt_count: newAttemptCount,
            last_attempt_at: now.toISOString(),
            locked_until: lockedUntil,
          })
          .eq("id", existingRecord.id);

        console.log(`[Rate Limit] Updated attempts for ${normalizedEmail}: ${newAttemptCount}/${MAX_ATTEMPTS}${shouldLock ? ' - LOCKED' : ''}`);

        if (shouldLock) {
          return new Response(
            JSON.stringify({
              allowed: false,
              locked_until: lockedUntil,
              message: `Too many failed attempts. Please try again in ${LOCKOUT_DURATION_MINUTES} minutes.`,
            } as RateLimitResponse),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            allowed: true,
            remaining_attempts: MAX_ATTEMPTS - newAttemptCount,
          } as RateLimitResponse),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // Create new record
        await supabase
          .from("auth_rate_limits")
          .insert({
            identifier: normalizedEmail,
            identifier_type: "email",
            attempt_count: 1,
            first_attempt_at: now.toISOString(),
            last_attempt_at: now.toISOString(),
          });

        console.log(`[Rate Limit] Created record for ${normalizedEmail}`);

        return new Response(
          JSON.stringify({
            allowed: true,
            remaining_attempts: MAX_ATTEMPTS - 1,
          } as RateLimitResponse),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (action === "record_success") {
      // Clear rate limit record on successful login
      await supabase
        .from("auth_rate_limits")
        .delete()
        .eq("identifier", normalizedEmail)
        .eq("identifier_type", "email");

      console.log(`[Rate Limit] Cleared record for ${normalizedEmail} on successful login`);

      return new Response(
        JSON.stringify({ allowed: true } as RateLimitResponse),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Rate Limit] Error:", error);
    
    // On error, allow the request to proceed (fail open for availability)
    return new Response(
      JSON.stringify({ allowed: true, remaining_attempts: MAX_ATTEMPTS }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});