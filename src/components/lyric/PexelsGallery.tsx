import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Search, Film, Image as ImageIcon, Check, Loader2, X,
  ExternalLink, ChevronLeft, ChevronRight, Download, Copy, Play, Sparkles, Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRecentPexelsBackgrounds } from "@/hooks/useRecentPexelsBackgrounds";

interface PexelsResult {
  id: number;
  type: "photo" | "video";
  url: string;
  thumbnail: string;
  photographer: string;
  pexels_url: string;
  width: number;
  height: number;
  duration?: number;
}

type Orientation = "portrait" | "landscape" | "square";
type MediaType = "videos" | "photos";

const CATEGORIES = [
  { label: "Music Festival", query: "music festival crowd lights", emoji: "🎪" },
  { label: "Studio Neon", query: "studio neon lights bokeh", emoji: "💡" },
  { label: "Abstract Waves", query: "abstract colorful waves", emoji: "🌊" },
  { label: "Dark Cinematic", query: "cinematic dark moody", emoji: "🎬" },
  { label: "Neon City", query: "neon city street night", emoji: "🌃" },
  { label: "Milky Way", query: "milky way stars night sky", emoji: "✨" },
  { label: "Laser Show", query: "laser light show concert", emoji: "🔦" },
  { label: "Smoke & Fog", query: "smoke fog atmospheric", emoji: "🌫️" },
  { label: "Glitch Art", query: "glitch digital abstract", emoji: "📺" },
  { label: "Rain Window", query: "rain drops window blurred", emoji: "🌧️" },
  { label: "Bokeh Lights", query: "bokeh background lights", emoji: "🫧" },
  { label: "Ocean Waves", query: "ocean waves sunset", emoji: "🌊" },
];

const ORIENTATIONS: { value: Orientation; label: string }[] = [
  { value: "portrait", label: "Portrait (9:16)" },
  { value: "landscape", label: "Landscape (16:9)" },
  { value: "square", label: "Square (1:1)" },
];

// ── Video preview card ───────────────────────────────────────────────────────
function GalleryCard({
  item,
  isSelected,
  orientation,
  onSelect,
}: {
  item: PexelsResult;
  isSelected: boolean;
  orientation: Orientation;
  onSelect: (item: PexelsResult) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const aspectStyle =
    orientation === "landscape" ? "16/9" :
    orientation === "square" ? "1/1" : "9/16";

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (item.type === "video" && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };
  const handleMouseLeave = () => {
    setIsHovered(false);
    if (item.type === "video" && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setVideoReady(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "relative overflow-hidden rounded-xl border-2 transition-all duration-200 group w-full",
        isSelected
          ? "border-primary shadow-lg shadow-primary/30 ring-2 ring-primary/20"
          : "border-transparent hover:border-primary/50"
      )}
      style={{ aspectRatio: aspectStyle }}
    >
      {/* Thumbnail */}
      <img
        src={item.thumbnail}
        alt={`Pexels ${item.type} by ${item.photographer}`}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-300",
          videoReady ? "opacity-0" : "opacity-100"
        )}
        loading="lazy"
      />

      {/* Video preview on hover */}
      {item.type === "video" && item.url && (
        <video
          ref={videoRef}
          src={item.url}
          muted
          loop
          playsInline
          preload="none"
          onCanPlay={() => setVideoReady(true)}
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
            videoReady ? "opacity-100" : "opacity-0"
          )}
        />
      )}

      {/* Gradient overlay */}
      <div className={cn(
        "absolute inset-0 transition-all duration-200",
        isSelected ? "bg-primary/20" : isHovered ? "bg-black/20" : "bg-black/0"
      )} />

      {/* Bottom info bar */}
      <div className={cn(
        "absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-opacity duration-200",
        isHovered || isSelected ? "opacity-100" : "opacity-0"
      )}>
        <p className="text-[9px] text-white/90 truncate">{item.photographer}</p>
      </div>

      {/* Top badges */}
      <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
        {item.type === "video" && (
          <div className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-black/70 backdrop-blur-sm">
            <Film className="h-2.5 w-2.5 text-white" />
            {item.duration && (
              <span className="text-[9px] text-white font-medium">{item.duration}s</span>
            )}
          </div>
        )}
      </div>

      {/* Play icon on hover for videos */}
      {item.type === "video" && isHovered && !videoReady && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <Play className="h-4 w-4 text-white ml-0.5" />
          </div>
        </div>
      )}

      {/* Selected checkmark */}
      {isSelected && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-md">
          <Check className="h-3 w-3 text-primary-foreground" />
        </div>
      )}
    </button>
  );
}

// ── Detail panel for selected item ───────────────────────────────────────────
function DetailPanel({
  item,
  onClearSelection,
  onUseAsBackground,
}: {
  item: PexelsResult;
  onClearSelection: () => void;
  onUseAsBackground?: (item: PexelsResult) => void;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const copyUrl = () => {
    navigator.clipboard.writeText(item.url).then(() => {
      setCopied(true);
      toast({ title: "URL copied", description: "Direct URL copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold">Selected {item.type === "video" ? "Video" : "Photo"}</p>
          <p className="text-xs text-muted-foreground">by {item.photographer}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClearSelection}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Preview */}
      <div className="rounded-xl overflow-hidden border border-border relative aspect-video bg-muted">
        {item.type === "video" ? (
          <video
            key={item.url}
            src={item.url}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <img src={item.url} alt="" className="w-full h-full object-cover" />
        )}
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {item.width && item.height && (
          <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-muted/40">
            <span className="text-muted-foreground">Dimensions</span>
            <span className="font-medium">{item.width} × {item.height}</span>
          </div>
        )}
        {item.duration && (
          <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-muted/40">
            <span className="text-muted-foreground">Duration</span>
            <span className="font-medium">{item.duration}s</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        {onUseAsBackground && (
          <Button
            size="sm"
            className="w-full gap-2 text-xs"
            onClick={() => onUseAsBackground(item)}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Use as Background
          </Button>
        )}
        <Button size="sm" variant="outline" className="w-full gap-2 text-xs" onClick={copyUrl}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied!" : "Copy URL"}
        </Button>
        <Button size="sm" variant="outline" className="w-full gap-2 text-xs" asChild>
          <a href={item.pexels_url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            View on Pexels
          </a>
        </Button>
        <Button size="sm" variant="outline" className="w-full gap-2 text-xs" asChild>
          <a href={item.url} download target="_blank" rel="noopener noreferrer">
            <Download className="h-3.5 w-3.5" />
            Download
          </a>
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Free to use under the{" "}
        <a href="https://www.pexels.com/license/" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
          Pexels License
        </a>
        . Credit "{item.photographer}" is appreciated.
      </p>
    </div>
  );
}

// ── Main gallery component ────────────────────────────────────────────────────
export default function PexelsGallery({ onUseAsBackground }: {
  onUseAsBackground?: (url: string, thumbnail: string) => void;
}) {
  const [mediaType, setMediaType] = useState<MediaType>("videos");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PexelsResult[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<PexelsResult | null>(null);
  const { recents, addRecent, clearRecents } = useRecentPexelsBackgrounds();

  const PER_PAGE = 18;
  const totalPages = Math.ceil(totalResults / PER_PAGE);

  const search = useCallback(
    async (q: string, pg = 1, type = mediaType, orient = orientation) => {
      const trimmed = q.trim();
      if (!trimmed) return;
      setLoading(true);
      setError(null);
      try {
        const { data, error: fnErr } = await supabase.functions.invoke("pexels-search", {
          body: { query: trimmed, mediaType: type, orientation: orient, perPage: PER_PAGE, page: pg },
        });
        if (fnErr) throw fnErr;
        setResults(data.results ?? []);
        setTotalResults(data.totalResults ?? 0);
        setPage(pg);
        setLastQuery(trimmed);
      } catch (e) {
        console.error("Pexels search error:", e);
        setError("Search failed. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [mediaType, orientation]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    search(query, 1);
  };

  const handleCategory = (q: string) => {
    setQuery(q);
    search(q, 1);
  };

  const handleTypeChange = (type: MediaType) => {
    setMediaType(type);
    if (lastQuery) search(lastQuery, 1, type, orientation);
  };

  const handleOrientationChange = (orient: Orientation) => {
    setOrientation(orient);
    if (lastQuery) search(lastQuery, 1, mediaType, orient);
  };

  return (
    <div className="grid lg:grid-cols-[1fr_280px] gap-6">
      {/* ── Left: search + results ── */}
      <div className="space-y-4">
        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Pexels for backgrounds…"
              className="pl-10 h-10"
            />
          </div>
          <Button type="submit" className="h-10 px-5 gap-2" disabled={loading || !query.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <span className="hidden sm:inline">Search</span>
          </Button>
        </form>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Media type */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["videos", "photos"] as MediaType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleTypeChange(t)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                  mediaType === t
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted"
                )}
              >
                {t === "videos" ? <Film className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                {t === "videos" ? "Videos" : "Photos"}
              </button>
            ))}
          </div>

          {/* Orientation */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {ORIENTATIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => handleOrientationChange(o.value)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  orientation === o.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted"
                )}
              >
                {o.value.charAt(0).toUpperCase() + o.value.slice(1)}
              </button>
            ))}
          </div>

          {results.length > 0 && (
            <span className="text-xs text-muted-foreground ml-auto">
              {totalResults.toLocaleString()} results
            </span>
          )}
        </div>

        {/* Categories (shown when no results) */}
        {results.length === 0 && !loading && (
          <div className="space-y-4">
            {/* Recently Used */}
            {recents.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    Recently Used
                  </p>
                  <button
                    type="button"
                    onClick={clearRecents}
                    className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {recents.map((r, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        if (onUseAsBackground) {
                          onUseAsBackground(r.url, r.thumbnail);
                        }
                      }}
                      className="group relative overflow-hidden rounded-xl border-2 border-transparent hover:border-primary/60 transition-all"
                      style={{ aspectRatio: "9/16" }}
                      title={`${r.type} by ${r.photographer}`}
                    >
                      <img
                        src={r.thumbnail}
                        alt={`Recent by ${r.photographer}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-primary/20 transition-all" />
                      {r.type === "video" && (
                        <div className="absolute bottom-0.5 left-0.5 p-0.5 rounded bg-black/60">
                          <Film className="h-2 w-2 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                {onUseAsBackground && (
                  <p className="text-[10px] text-muted-foreground">Click to use as background in Create</p>
                )}
              </div>
            )}

            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Popular Categories
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.query}
                    type="button"
                    onClick={() => handleCategory(cat.query)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-muted/30 text-xs text-muted-foreground hover:bg-muted hover:text-foreground hover:border-primary/40 transition-all duration-150 text-left"
                  >
                    <span className="text-base leading-none">{cat.emoji}</span>
                    <span className="font-medium">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl bg-muted animate-pulse"
                style={{ aspectRatio: orientation === "landscape" ? "16/9" : orientation === "square" ? "1/1" : "9/16" }}
              />
            ))}
          </div>
        )}

        {/* Results grid */}
        {!loading && results.length > 0 && (
          <>
            <div className={cn(
              "grid gap-2",
              orientation === "portrait"
                ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-4"
                : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-3"
            )}>
              {results.map((item) => (
                <GalleryCard
                  key={item.id}
                  item={item}
                  isSelected={selectedItem?.id === item.id}
                  orientation={orientation}
                  onSelect={(i) => {
                    const next = selectedItem?.id === i.id ? null : i;
                    setSelectedItem(next);
                    if (next) {
                      addRecent({ url: next.url, thumbnail: next.thumbnail, type: next.type, photographer: next.photographer });
                    }
                  }}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  disabled={page <= 1 || loading}
                  onClick={() => search(lastQuery, page - 1)}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </Button>
                <span className="text-sm text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  disabled={page >= totalPages || loading}
                  onClick={() => search(lastQuery, page + 1)}
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* Attribution */}
            <div className="flex items-center justify-center pt-1">
              <a
                href="https://www.pexels.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                Photos &amp; videos provided by Pexels
              </a>
            </div>
          </>
        )}
      </div>

      {/* ── Right: detail panel ── */}
      <div className="space-y-4">
        {selectedItem ? (
          <DetailPanel
            item={selectedItem}
            onClearSelection={() => setSelectedItem(null)}
            onUseAsBackground={onUseAsBackground
              ? (item) => {
                  onUseAsBackground(item.url, item.thumbnail);
                  setSelectedItem(null);
                }
              : undefined
            }
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 flex flex-col items-center justify-center min-h-[320px] p-8 text-center">
            <Film className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Select a video or photo</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Click any result to preview, copy URL, or download
            </p>
          </div>
        )}

        {/* Tips */}
        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tips</p>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li className="flex items-start gap-1.5">
              <span className="text-primary mt-0.5">•</span>
              Hover over a video to preview it in-grid
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-primary mt-0.5">•</span>
              Click to select and see full details
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-primary mt-0.5">•</span>
              Select a background in the lyric video form to use it directly
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-primary mt-0.5">•</span>
              Portrait (9:16) works best for TikTok & Reels
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
