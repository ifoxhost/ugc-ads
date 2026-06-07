import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Music, Check, AlertCircle, Link, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ParsedSongData {
  title: string;
  artist: string;
  lyricsSnippet: string;
  audioUrl?: string;
  success: boolean;
}

const BACKEND_URL = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3000` : 'http://localhost:3000';

interface SunoLinkParserProps {
  onParsed: (data: ParsedSongData) => void;
  disabled?: boolean;
  defaultUrl?: string;
}

const SunoLinkParser = ({ onParsed, disabled, defaultUrl }: SunoLinkParserProps) => {
  const [url, setUrl] = useState(defaultUrl || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ParsedSongData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastAutoTriggered = useRef<string>("");

  const isValidSunoUrl = (input: string) => {
    return (
      input.includes("suno.com/song/") ||
      input.includes("suno.ai/song/") ||
      /suno\.com\/s\/[a-zA-Z0-9]+/.test(input)
    );
  };

  const parseUrl = async (target: string) => {
    if (!target || !isValidSunoUrl(target)) {
      setError("Please enter a valid Suno song URL (e.g. https://suno.com/song/... or https://suno.com/s/...)");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Use local backend proxy for parsing (avoids CORS and Supabase function issues)
      const resp = await fetch(`${BACKEND_URL}/api/suno/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sunoUrl: target }),
      });

      if (!resp.ok) throw new Error(`Backend returned ${resp.status}`);
      const data = await resp.json() as ParsedSongData;

      setResult(data);
      onParsed(data);

      if (!data.success) {
        setError("Could not fully extract song data. You can still edit the fields below manually.");
      }
    } catch (err) {
      console.error('[SunoLinkParser] Parse error:', err);
      setError("Failed to fetch Suno song data. Please try again or use Manual Entry.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-parse when a defaultUrl is provided — fires once on mount only
  useEffect(() => {
    if (defaultUrl && isValidSunoUrl(defaultUrl)) {
      parseUrl(defaultUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUrl(val);
    setError(null);
    setResult(null);
    // Auto-trigger parse when a valid URL is pasted
    if (isValidSunoUrl(val) && val !== lastAutoTriggered.current) {
      lastAutoTriggered.current = val;
      parseUrl(val);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") parseUrl(url.trim());
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2">
          <Link className="h-4 w-4 text-muted-foreground" />
          Suno Song URL
        </label>
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="https://suno.com/song/... or https://suno.com/s/..."
            disabled={disabled || loading}
            className={cn(
              "font-mono text-sm",
              error && "border-destructive focus-visible:ring-destructive"
            )}
          />
          <Button
            type="button"
            onClick={() => parseUrl(url.trim())}
            disabled={!url.trim() || loading || disabled}
            className="shrink-0 px-4"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Parse"
            )}
          </Button>
        </div>
        {error && (
          <p className="text-xs text-amber-500 flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}
      </div>

      {/* Parsed result card */}
      {result && (
        <div className={cn(
          "rounded-xl border p-4 space-y-3 animate-fade-in",
          result.success
            ? "border-primary/30 bg-primary/5"
            : "border-amber-500/30 bg-amber-500/5"
        )}>
          <div className="flex items-center gap-2">
            {result.success ? (
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                <Check className="h-3.5 w-3.5 text-primary" />
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
              </div>
            )}
            <span className="text-sm font-medium">
              {result.success ? "Song data extracted" : "Partial data — please review below"}
            </span>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Title</p>
              <p className="text-sm font-medium truncate">{result.title || "Unknown"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Artist</p>
              <p className="text-sm font-medium truncate">{result.artist || "Unknown"}</p>
            </div>
          </div>

          {result.lyricsSnippet && (
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Lyrics Preview</p>
              <p className="text-xs text-muted-foreground font-mono leading-relaxed line-clamp-3 bg-muted/50 rounded-lg p-2">
                {result.lyricsSnippet}
              </p>
            </div>
          )}

          {result.audioUrl && (
            <div className="space-y-1 pt-1">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Preview Song</p>
              <audio src={result.audioUrl} controls className="w-full h-9 rounded-lg mt-1" />
            </div>
          )}
        </div>
      )}

      {/* Helper hint */}
      {!result && !loading && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/40 border border-border">
          <Music className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Paste a public Suno song link to automatically extract the title, artist, and lyrics. Works best with public songs. You can edit the extracted data before generating.
          </p>
        </div>
      )}
    </div>
  );
};

export default SunoLinkParser;
