import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const pexelsApiKey = Deno.env.get("PEXELS_API_KEY");
    if (!pexelsApiKey) {
      return new Response(JSON.stringify({ error: "Pexels API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { query, mediaType = "videos", orientation = "portrait", perPage = 15, page = 1 } =
      await req.json();

    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "query is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sanitizedQuery = query.trim().slice(0, 100);

    let url: string;
    if (mediaType === "photos") {
      const params = new URLSearchParams({
        query: sanitizedQuery,
        orientation,
        per_page: String(perPage),
        page: String(page),
      });
      url = `https://api.pexels.com/v1/search?${params}`;
    } else {
      // videos
      const params = new URLSearchParams({
        query: sanitizedQuery,
        orientation,
        per_page: String(perPage),
        page: String(page),
        size: "medium",
      });
      url = `https://api.pexels.com/videos/search?${params}`;
    }

    const pexelsRes = await fetch(url, {
      headers: { Authorization: pexelsApiKey },
    });

    if (!pexelsRes.ok) {
      const err = await pexelsRes.text();
      console.error(`Pexels API error (${pexelsRes.status}):`, err);
      return new Response(JSON.stringify({ error: "Pexels API request failed" }), {
        status: pexelsRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await pexelsRes.json();

    // Normalize response shape
    let results: unknown[];
    let totalResults: number;

    if (mediaType === "photos") {
      totalResults = data.total_results ?? 0;
      results = (data.photos ?? []).map((photo: Record<string, unknown>) => ({
        id: photo.id,
        type: "photo",
        url: (photo.src as Record<string, string>)?.large2x ?? (photo.src as Record<string, string>)?.original,
        thumbnail: (photo.src as Record<string, string>)?.medium,
        photographer: photo.photographer,
        pexels_url: photo.url,
        width: photo.width,
        height: photo.height,
      }));
    } else {
      totalResults = data.total_results ?? 0;
      results = (data.videos ?? []).map((video: Record<string, unknown>) => {
        const files = (video.video_files as Record<string, unknown>[]) ?? [];
        // Prefer HD (1920x1080) file, fall back to largest available
        const hdFile = files.find(
          (f) => (f.quality === "hd" || f.quality === "sd") && String(f.file_type).includes("mp4")
        );
        const bestFile = hdFile ?? files.find((f) => String(f.file_type).includes("mp4")) ?? files[0];
        const pictures = (video.video_pictures as Record<string, unknown>[]) ?? [];
        const thumbnail = pictures[0]?.picture ?? null;

        return {
          id: video.id,
          type: "video",
          url: (bestFile as Record<string, unknown>)?.link,
          thumbnail,
          duration: video.duration,
          width: video.width,
          height: video.height,
          pexels_url: video.url,
          photographer: (video.user as Record<string, unknown>)?.name,
        };
      });
    }

    return new Response(
      JSON.stringify({ results, totalResults, page, perPage }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("pexels-search error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
