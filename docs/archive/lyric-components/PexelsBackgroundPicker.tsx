import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Search,
  Check,
  Loader2,
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";
import { useRecentPexelsBackgrounds } from "@/hooks/useRecentPexelsBackgrounds";

export type PexelsOrientation = "portrait" | "landscape" | "square";

interface PexelsResult {
  id: number;
  type: "photo";
  url: string;
  thumbnail: string;
  photographer: string;
  pexels_url: string;
  width: number;
  height: number;
}

interface PexelsBackgroundPickerProps {
  /** Current aspect ratio so we can default orientation */
  aspectRatio: string;
  selectedUrl: string | null;
  onSelect: (url: string | null, photographer: string | null) => void;
}

const ORIENTATION_MAP: Record<string, PexelsOrientation> = {
  "9:16": "portrait",
  "1:1": "square",
  "16:9": "landscape",
};

// ── MediaCard: shows static photo thumbnail ─────────────────────────
function MediaCard({
  item,
  isSelected,
  aspectRatio,
  onSelect,
}: {
  item: PexelsResult;
  isSelected: boolean;
  aspectRatio: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative overflow-hidden rounded-lg border-2 transition-all duration-200 group w-full",
        isSelected
          ? "border-primary shadow-md shadow-primary/30"
          : "border-transparent hover:border-primary/50"
      )}
      style={{ aspectRatio: aspectRatio === "16:9" ? "16/9" : aspectRatio === "1:1" ? "1/1" : "9/16" }}
    >
      {/* Thumbnail */}
      <img
        src={item.thumbnail}
        alt={`Pexels photo by ${item.photographer}`}
        className="w-full h-full object-cover"
        loading="lazy"
      />

      {/* Overlay */}
      <div className={cn(
        "absolute inset-0 transition-opacity",
        isSelected ? "bg-primary/20" : "bg-black/0 group-hover:bg-black/10"
      )} />

      {/* Selected checkmark */}
      {isSelected && (
        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow">
          <Check className="h-3 w-3 text-primary-foreground" />
        </div>
      )}
    </button>
  );
}

const SUGGESTED_QUERIES = [
  "cyberpunk character",
  "fantasy portrait",
  "anime avatar",
  "synthwave girl",
  "steampunk boy",
  "futuristic astronaut",
  "vintage portrait",
  "neon photography",
];

interface PopularCategory {
  label: string;
  query: string;
  emoji: string;
}

const POPULAR_CATEGORIES: PopularCategory[] = [
  { label: "Cyberpunk", query: "cyberpunk character neon street portrait", emoji: "🌃" },
  { label: "Fantasy Mage", query: "fantasy mage wizard sorcerer portrait", emoji: "🧙" },
  { label: "Anime / Style", query: "colorful anime stylized character avatar", emoji: "🎨" },
  { label: "Retro Astronaut", query: "retro astronaut space helmet suit vintage", emoji: "🧑‍🚀" },
  { label: "Pop Singer", query: "pop music singer stage lights microphone portrait", emoji: "🎤" },
  { label: "Neon Portrait", query: "neon portrait glowing faces model dark background", emoji: "💡" },
  { label: "Sci-Fi Cyborg", query: "sci-fi cyborg robot android profile portrait", emoji: "🤖" },
  { label: "Steampunk", query: "steampunk adventurer goggles top hat leather", emoji: "⚙️" },
  { label: "Gothic Moody", query: "gothic moody dark cinematic model portrait", emoji: "🧛" },
  { label: "3D Cartoon", query: "3d cute cartoon character rendered avatar", emoji: "👾" },
];

export default function PexelsBackgroundPicker({
  aspectRatio,
  selectedUrl,
  onSelect,
}: PexelsBackgroundPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PexelsResult[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState("");
  const { recents, addRecent } = useRecentPexelsBackgrounds();

  const orientation = ORIENTATION_MAP[aspectRatio] ?? "portrait";

  const search = useCallback(
    async (q: string, pg = 1) => {
      const trimmed = q.trim();
      if (!trimmed) return;
      setLoading(true);
      setError(null);
      try {
        const { data, error: fnErr } = await supabase.functions.invoke("pexels-search", {
          body: { query: trimmed, mediaType: "photos", orientation, perPage: 12, page: pg },
        });
        if (fnErr) throw fnErr;
        
        // Ensure only photo objects match our type definition
        const normalizedResults = (data.results ?? []).map((item: any) => ({
          ...item,
          type: "photo",
        }));
        
        setResults(normalizedResults);
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
    [orientation]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    search(query, 1);
  };

  const handleSuggestion = (q: string) => {
    setQuery(q);
    search(q, 1);
  };

  const totalPages = Math.ceil(totalResults / 12);

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Pexels photos…"
            className="pl-9 h-9 text-sm bg-background/50"
          />
        </div>
        <Button type="submit" size="sm" className="h-9 px-4" disabled={loading || !query.trim()}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Search"}
        </Button>
      </form>

      {/* Header and Clear button */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          Showing <span className="font-medium text-foreground">{orientation}</span> photos to match{" "}
          <span className="font-medium text-foreground">{aspectRatio}</span> aspect ratio
        </p>

        {selectedUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
            onClick={() => onSelect(null, null)}
          >
            <X className="h-3 w-3" />
            Clear selection
          </Button>
        )}
      </div>

      {/* Suggested queries */}
      {results.length === 0 && !loading && (
        <div className="space-y-3">
          {/* Recently Used */}
          {recents.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Recently Used
              </p>
              <div className="grid grid-cols-5 gap-1.5">
                {recents.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onSelect(r.url, r.photographer)}
                    className={cn(
                      "relative overflow-hidden rounded-lg border-2 transition-all duration-150",
                      selectedUrl === r.url
                        ? "border-primary shadow-md shadow-primary/30"
                        : "border-transparent hover:border-primary/50"
                    )}
                    style={{ aspectRatio: aspectRatio === "16:9" ? "16/9" : aspectRatio === "1:1" ? "1/1" : "9/16" }}
                    title={`photo by ${r.photographer}`}
                  >
                    <img
                      src={r.thumbnail}
                      alt={r.photographer}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {selectedUrl === r.url && (
                      <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Popular music categories */}
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">Popular on Pexels</p>
            <div className="grid grid-cols-2 gap-1.5">
              {POPULAR_CATEGORIES.map((cat) => (
                <button
                  key={cat.query}
                  type="button"
                  onClick={() => handleSuggestion(cat.query)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-muted/40 text-xs text-muted-foreground hover:bg-muted hover:text-foreground hover:border-primary/40 transition-all duration-150 text-left"
                >
                  <span className="text-sm leading-none">{cat.emoji}</span>
                  <span className="font-medium truncate">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
          {/* Free-text suggestions */}
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">Quick Search</p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_QUERIES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleSuggestion(q)}
                  className="px-2.5 py-1 rounded-full border border-border bg-muted/40 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[9/16] rounded-lg bg-muted animate-pulse"
              style={{ aspectRatio: aspectRatio === "16:9" ? "16/9" : aspectRatio === "1:1" ? "1/1" : "9/16" }}
            />
          ))}
        </div>
      )}

      {/* Results grid */}
      {!loading && results.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {results.map((item) => {
              const isSelected = selectedUrl === item.url;
              return (
                <MediaCard
                  key={item.id}
                  item={item}
                  isSelected={isSelected}
                  aspectRatio={aspectRatio}
                  onSelect={() => {
                    if (!isSelected) {
                      addRecent({ url: item.url, thumbnail: item.thumbnail, type: "photo", photographer: item.photographer });
                    }
                    onSelect(isSelected ? null : item.url, isSelected ? null : item.photographer);
                  }}
                />
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-3 text-xs gap-1"
                disabled={page <= 1 || loading}
                onClick={() => search(lastQuery, page - 1)}
              >
                <ChevronLeft className="h-3 w-3" />
                Prev
              </Button>
              <span className="text-xs text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-3 text-xs gap-1"
                disabled={page >= totalPages || loading}
                onClick={() => search(lastQuery, page + 1)}
              >
                Next
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Attribution */}
          <a
            href="https://www.pexels.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-2.5 w-2.5" />
            Photos provided by Pexels
          </a>
        </>
      )}
    </div>
  );
}
