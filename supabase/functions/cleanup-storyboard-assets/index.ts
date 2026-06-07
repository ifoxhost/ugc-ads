// Daily cleanup for storyboard asset buckets.
// Deletes:
//   - `video-references/*` files older than STORYBOARD_REF_TTL_DAYS (default 7)
//   - `generated-images/*` files older than STORYBOARD_IMAGE_TTL_DAYS (default 14)
//     that are NOT currently referenced by any `video_scenes.image_url`
//     (so previous-generation scene images are pruned after re-rolls).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REF_BUCKET = "video-references";
const IMG_BUCKET = "generated-images";

function envInt(name: string, fallback: number): number {
  const v = Deno.env.get(name);
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function getTtl(sb: ReturnType<typeof createClient>, key: string, envName: string, fallback: number): Promise<number> {
  try {
    const { data } = await sb.from("app_settings").select("value").eq("key", key).maybeSingle();
    const v = data?.value;
    const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
    if (Number.isFinite(n) && n > 0) return n;
  } catch (e) { console.warn("[cleanup] settings read failed", (e as Error).message); }
  return envInt(envName, fallback);
}

async function listAll(sb: ReturnType<typeof createClient>, bucket: string, prefix = ""): Promise<{ name: string; updated_at?: string; created_at?: string }[]> {
  const all: any[] = [];
  let page = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await sb.storage.from(bucket).list(prefix, {
      limit, offset: page * limit, sortBy: { column: "name", order: "asc" },
    });
    if (error) { console.error(`[cleanup] list ${bucket}/${prefix}`, error.message); break; }
    if (!data || data.length === 0) break;
    for (const item of data) {
      // If it's a "folder" (no id), recurse one level deeper.
      if (item.id == null && item.name) {
        const sub = await listAll(sb, bucket, prefix ? `${prefix}/${item.name}` : item.name);
        for (const s of sub) all.push({ ...s, name: `${prefix ? prefix + "/" : ""}${item.name}/${s.name.replace(/^.*\//, "")}` });
      } else {
        all.push({ ...item, name: prefix ? `${prefix}/${item.name}` : item.name });
      }
    }
    if (data.length < limit) break;
    page++;
  }
  return all;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const refTtlDays = envInt("STORYBOARD_REF_TTL_DAYS", 7);
    const imgTtlDays = envInt("STORYBOARD_IMAGE_TTL_DAYS", 14);
    const now = Date.now();
    const refCutoff = now - refTtlDays * 86_400_000;
    const imgCutoff = now - imgTtlDays * 86_400_000;

    // ── 1) Reference images: simple age-based expiry ──────────────────────────
    const refs = await listAll(sb, REF_BUCKET);
    const refsToDelete = refs.filter((f) => {
      const t = Date.parse(f.updated_at ?? f.created_at ?? "");
      return Number.isFinite(t) && t < refCutoff;
    }).map((f) => f.name);

    let refsDeleted = 0;
    for (let i = 0; i < refsToDelete.length; i += 100) {
      const chunk = refsToDelete.slice(i, i + 100);
      const { error } = await sb.storage.from(REF_BUCKET).remove(chunk);
      if (error) console.error("[cleanup] ref delete error", error.message);
      else refsDeleted += chunk.length;
    }

    // ── 2) Scene images: prune previous-generation/orphaned files ─────────────
    // Build a Set of currently-active scene image paths (relative to bucket).
    const { data: liveScenes } = await sb.from("video_scenes")
      .select("image_url").not("image_url", "is", null);
    const live = new Set<string>();
    for (const s of (liveScenes ?? []) as any[]) {
      const u: string = s.image_url ?? "";
      const idx = u.indexOf(`/${IMG_BUCKET}/`);
      if (idx >= 0) live.add(u.slice(idx + IMG_BUCKET.length + 2));
    }

    const imgs = await listAll(sb, IMG_BUCKET);
    const imgsToDelete = imgs.filter((f) => {
      if (live.has(f.name)) return false; // currently referenced — keep
      const t = Date.parse(f.updated_at ?? f.created_at ?? "");
      return Number.isFinite(t) && t < imgCutoff;
    }).map((f) => f.name);

    let imgsDeleted = 0;
    for (let i = 0; i < imgsToDelete.length; i += 100) {
      const chunk = imgsToDelete.slice(i, i + 100);
      const { error } = await sb.storage.from(IMG_BUCKET).remove(chunk);
      if (error) console.error("[cleanup] img delete error", error.message);
      else imgsDeleted += chunk.length;
    }

    const result = {
      success: true,
      ttl: { refDays: refTtlDays, imgDays: imgTtlDays },
      scanned: { refs: refs.length, imgs: imgs.length, liveImgs: live.size },
      deleted: { refs: refsDeleted, imgs: imgsDeleted },
    };
    console.log("[cleanup-storyboard-assets]", JSON.stringify(result));
    return new Response(JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[cleanup-storyboard-assets] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
