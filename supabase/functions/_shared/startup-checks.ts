// Shared startup-check helpers for Edge Functions.
// - Fails fast with clear errors when required secrets are missing.
// - NEVER logs secret values. Only names + booleans.

export type SecretCheck = { name: string; set: boolean };

export function checkSecrets(names: string[]): SecretCheck[] {
  return names.map((name) => {
    const v = Deno.env.get(name);
    return { name, set: typeof v === "string" && v.length > 0 };
  });
}

/**
 * Throw a structured error listing any missing secrets.
 * Use at the very top of an Edge Function handler so misconfiguration is
 * surfaced as a 500 with a machine-readable payload instead of a silent crash.
 */
export function requireSecrets(names: string[]): Record<string, string> {
  const missing: string[] = [];
  const out: Record<string, string> = {};
  for (const n of names) {
    const v = Deno.env.get(n);
    if (!v) missing.push(n);
    else out[n] = v;
  }
  if (missing.length) {
    // Log names only, never values.
    console.error(`[startup-checks] Missing required secrets: ${missing.join(", ")}`);
    const err = new Error(
      `Missing required secrets: ${missing.join(", ")}. ` +
        `Add them in Lovable Cloud → Secrets and redeploy.`,
    );
    (err as any).code = "MISSING_SECRETS";
    (err as any).missing = missing;
    throw err;
  }
  return out;
}

export function jsonError(
  err: unknown,
  corsHeaders: Record<string, string> = {},
): Response {
  const e = err as any;
  const code = e?.code === "MISSING_SECRETS" ? 503 : 500;
  return new Response(
    JSON.stringify({
      error: e?.message || "Internal error",
      code: e?.code,
      missing: e?.missing,
    }),
    {
      status: code,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
