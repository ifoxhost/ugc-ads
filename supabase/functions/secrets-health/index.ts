// Admin-only endpoint to verify which required secrets are configured.
// NEVER returns secret values — only { name, set } booleans.
// Requires the caller to be authenticated AND have the `admin` role
// in public.user_roles (checked via has_role RPC).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkSecrets } from "../_shared/startup-checks.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Catalog of secrets the app expects. Grouped for clarity in the admin UI.
const SECRET_CATALOG = {
  core: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY"],
  ai: ["LOVABLE_API_KEY", "OPENAI_API_KEY", "KIE_AI_API_KEY"],
  music: ["SUNO_API_KEY", "ELEVENLABS_API_KEY"],
  media: ["PEXELS_API_KEY"],
  orchestration: ["N8N_WEBHOOK_URL", "N8N_WEBHOOK_SECRET"],
  email: ["RESEND_API_KEY"],
  billing: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
} as const;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user
    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin gate via has_role RPC (security definer, RLS-safe).
    const admin = createClient(supabaseUrl, supabaseService);
    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (roleErr || !isAdmin) {
      // Do not leak which secrets exist to non-admins.
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const groups: Record<string, { name: string; set: boolean }[]> = {};
    let allOk = true;
    for (const [group, names] of Object.entries(SECRET_CATALOG)) {
      const results = checkSecrets([...names]);
      groups[group] = results;
      if (results.some((r) => !r.set)) allOk = false;
    }

    return new Response(
      JSON.stringify({ ok: allOk, groups }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[secrets-health] error:", (e as Error).message);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
