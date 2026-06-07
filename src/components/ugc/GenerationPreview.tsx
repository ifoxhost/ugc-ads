import { Loader2, Image as ImageIcon, Sparkles, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AdCopy {
  headline: string;
  cta: string;
  caption: string;
  hashtags: string[];
}

interface GenerationPreviewProps {
  status: "idle" | "analyzing" | "generating" | "complete" | "error";
  generatedImageUrl?: string | null;
  adCopy?: AdCopy | null;
  error?: string | null;
}

const GenerationPreview = ({
  status,
  generatedImageUrl,
  adCopy,
  error,
}: GenerationPreviewProps) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (status === "idle") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mb-4">
          <ImageIcon className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">No generation yet</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Upload a product image and select a style to generate your UGC ad
        </p>
      </div>
    );
  }

  if (status === "analyzing") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
        </div>
        <h3 className="text-lg font-medium mb-2">Analyzing your product...</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          AI is understanding your product to create the perfect ad
        </p>
      </div>
    );
  }

  if (status === "generating") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Sparkles className="h-10 w-10 text-primary animate-pulse" />
        </div>
        <h3 className="text-lg font-medium mb-2">Creating your UGC ad...</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Generating authentic creator-style visuals and ad copy
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <ImageIcon className="h-10 w-10 text-destructive" />
        </div>
        <h3 className="text-lg font-medium mb-2 text-destructive">Generation failed</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {error || "Something went wrong. Please try again."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {generatedImageUrl && (
        <div className="rounded-2xl overflow-hidden bg-card border border-border">
          <img
            src={generatedImageUrl}
            alt="Generated UGC ad"
            className="w-full aspect-square object-cover"
          />
        </div>
      )}

      {adCopy && (
        <div className="space-y-4 p-4 rounded-xl bg-card border border-border">
          <h4 className="font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Generated Ad Copy
          </h4>

          <div className="space-y-3">
            <CopyableField
              label="Headline"
              value={adCopy.headline}
              field="headline"
              copiedField={copiedField}
              onCopy={copyToClipboard}
            />
            <CopyableField
              label="CTA"
              value={adCopy.cta}
              field="cta"
              copiedField={copiedField}
              onCopy={copyToClipboard}
            />
            <CopyableField
              label="Caption"
              value={adCopy.caption}
              field="caption"
              copiedField={copiedField}
              onCopy={copyToClipboard}
            />
            <CopyableField
              label="Hashtags"
              value={adCopy.hashtags.join(" ")}
              field="hashtags"
              copiedField={copiedField}
              onCopy={copyToClipboard}
            />
          </div>
        </div>
      )}
    </div>
  );
};

interface CopyableFieldProps {
  label: string;
  value: string;
  field: string;
  copiedField: string | null;
  onCopy: (text: string, field: string) => void;
}

const CopyableField = ({ label, value, field, copiedField, onCopy }: CopyableFieldProps) => {
  const isCopied = copiedField === field;

  return (
    <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-muted/30">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => onCopy(value, field)}
      >
        {isCopied ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
};

export default GenerationPreview;
