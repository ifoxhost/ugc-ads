import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ParseResult {
  title: string;
  artist: string;
  lyricsSnippet: string;
  audioUrl?: string;
  success: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sunoUrl } = await req.json();

    if (!sunoUrl || typeof sunoUrl !== "string") {
      return new Response(JSON.stringify({ error: "sunoUrl is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate it's a suno URL
    if (!sunoUrl.includes("suno.com") && !sunoUrl.includes("suno.ai")) {
      return new Response(JSON.stringify({ error: "Not a valid Suno URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve short links (e.g. https://suno.com/s/3glnc9eMgesVElpX)
    let resolvedUrl = sunoUrl;
    const isShortLink = /suno\.com\/s\/[a-zA-Z0-9]+/.test(sunoUrl);
    if (isShortLink) {
      try {
        const headRes = await fetch(sunoUrl, {
          method: "GET",
          redirect: "follow",
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; LyricAVid/1.0; +https://lyricavid.com)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
        });
        // After redirect, the final URL is the canonical song URL
        resolvedUrl = headRes.url || sunoUrl;
        console.log(`Resolved short link ${sunoUrl} → ${resolvedUrl}`);
      } catch {
        // Fall back to original URL if redirect resolution fails
      }
    }

    // Fetch the Suno page HTML
    const fetchResponse = await fetch(resolvedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LyricAVid/1.0; +https://lyricavid.com)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!fetchResponse.ok) {
      console.warn(`Fetch failed for ${resolvedUrl}: ${fetchResponse.status}`);
      return new Response(
        JSON.stringify({ title: "", artist: "", lyricsSnippet: "", success: false } as ParseResult),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = await fetchResponse.text();
    console.log(`Fetched HTML length: ${html.length} chars`);

    let title = "";
    let artist = "";
    let lyricsSnippet = "";
    let audioUrl = "";

    // ── 1. Try __NEXT_DATA__ (Next.js hydration JSON — most reliable for Suno) ──
    const nextDataMatch = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        // Walk the props tree to find song data
        const props = nextData?.props?.pageProps;
        // Suno song page shape: props.initialData.clips[0] or props.clip
        const clip =
          props?.initialData?.clips?.[0] ||
          props?.clip ||
          props?.song ||
          props?.data?.clips?.[0];
        if (clip) {
          title   = clip.title || clip.display_name || title;
          artist  = clip.artist_name || clip.display_name || artist;
          const rawLyrics = clip.metadata?.prompt || clip.lyrics || clip.prompt || "";
          if (rawLyrics) {
            lyricsSnippet = rawLyrics.slice(0, 1500);
          }
          audioUrl = clip.audio_url || clip.stream_url || audioUrl;
        }
        console.log(`__NEXT_DATA__ extracted — title: "${title}", artist: "${artist}", lyrics length: ${lyricsSnippet.length}, audio: "${audioUrl}"`);
      } catch (e) {
        console.warn("Failed to parse __NEXT_DATA__:", e);
      }
    }

    // ── 2. Extract og:title as fallback for title/artist ──
    if (!title) {
      const ogTitleMatch =
        html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i) ||
        html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i);

      if (ogTitleMatch) {
        const rawTitle = ogTitleMatch[1].trim();
        const withoutSuno = rawTitle.replace(/\s*[\|–-]\s*Suno.*$/i, "").trim();
        const byMatch = withoutSuno.match(/^(.+?)\s+by\s+(.+)$/i);
        if (byMatch) {
          title  = byMatch[1].trim();
          artist = byMatch[2].trim();
        } else {
          title = withoutSuno;
        }
      }
    }

    // ── 3. Extract artist from og:description if still missing ──
    if (!artist) {
      const descMatch =
        html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i) ||
        html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:description"/i);
      if (descMatch) {
        const byMatch = descMatch[1].match(/by\s+([^,\.]+)/i);
        if (byMatch) artist = byMatch[1].trim();
      }
    }

    // ── 4. Try JSON-LD for lyrics if still missing ──
    if (!lyricsSnippet) {
      const jsonLdMatches = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
      for (const match of jsonLdMatches) {
        try {
          const jsonData = JSON.parse(match[1]);
          if (jsonData.lyrics || jsonData.description) {
            lyricsSnippet = (jsonData.lyrics || jsonData.description || "").slice(0, 1500);
            break;
          }
        } catch {
          // ignore parse errors
        }
      }
    }

    // ── 5. Final regex fallback for lyrics ──
    if (!lyricsSnippet) {
      const lyricsMatch =
        html.match(/data-lyrics="([^"]+)"/i) ||
        html.match(/"lyrics"\s*:\s*"((?:[^"\\]|\\.)*)"/i) ||
        html.match(/"prompt"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
      if (lyricsMatch) {
        lyricsSnippet = lyricsMatch[1]
          .replace(/\\n/g, "\n")
          .replace(/\\"/g, '"')
          .replace(/\\t/g, " ")
          .slice(0, 1500);
      }
    }

    // ── 6. Try to extract song ID from URL and call Suno's internal API ──
    if (!lyricsSnippet || !title) {
      const songIdMatch = resolvedUrl.match(/\/song\/([a-f0-9-]{36})/i);
      if (songIdMatch) {
        const songId = songIdMatch[1];
        try {
          const apiRes = await fetch(`https://studio-api.prod.suno.com/api/feed/v2?ids=${songId}`, {
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; LyricAVid/1.0)",
              "Accept": "application/json",
            },
          });
          if (apiRes.ok) {
            const apiData = await apiRes.json();
            const clip = apiData?.clips?.[0] || apiData?.[0];
              title  = title  || clip.title || clip.display_name || "";
              artist = artist || clip.artist_name || "";
              const rawLyrics = clip.metadata?.prompt || clip.lyrics || "";
              if (rawLyrics && !lyricsSnippet) {
                lyricsSnippet = rawLyrics.slice(0, 1500);
              }
              audioUrl = audioUrl || clip.audio_url || clip.stream_url || "";
              console.log(`Suno API extracted — title: "${title}", lyrics length: ${lyricsSnippet.length}, audio: "${audioUrl}"`);
          }
        } catch (e) {
          console.warn("Suno internal API fetch failed:", e);
        }
      }
    }

    // ── 7. Try fallback regex for audio URL ──
    if (!audioUrl) {
      const audioUrlMatch =
        html.match(/"audio_url"\s*:\s*"([^"]+)"/i) ||
        html.match(/"stream_url"\s*:\s*"([^"]+)"/i);
      if (audioUrlMatch) {
        audioUrl = audioUrlMatch[1];
      }
    }

    const success = !!(title || lyricsSnippet || audioUrl);
    console.log(`Final result — success: ${success}, title: "${title}", lyrics length: ${lyricsSnippet.length}, audio: "${audioUrl}"`);

    return new Response(
      JSON.stringify({ title, artist, lyricsSnippet, audioUrl, success } as ParseResult),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("suno-parse error:", error);
    return new Response(
      JSON.stringify({ title: "", artist: "", lyricsSnippet: "", audioUrl: "", success: false } as ParseResult),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
