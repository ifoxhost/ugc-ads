import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { X, AlignLeft } from "lucide-react";

interface LyricEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const LyricEditor = ({ value, onChange, placeholder, disabled }: LyricEditorProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [lineCount, setLineCount] = useState(1);
  const charLimit = 3000;

  // Sync line numbers with textarea scroll
  const syncScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  useEffect(() => {
    const lines = value ? value.split("\n").length : 1;
    setLineCount(Math.max(lines, 1));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (newValue.length <= charLimit) {
      onChange(newValue);
    }
  };

  const handleClear = () => {
    onChange("");
    textareaRef.current?.focus();
  };

  const charCount = value.length;
  const isNearLimit = charCount > charLimit * 0.85;
  const isAtLimit = charCount >= charLimit;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium flex items-center gap-2">
          <AlignLeft className="h-4 w-4 text-muted-foreground" />
          Lyrics
        </label>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            disabled={disabled}
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      <div className={cn(
        "relative flex rounded-xl border-2 overflow-hidden transition-all duration-200 bg-muted/30",
        "focus-within:border-primary/60 focus-within:bg-background",
        disabled ? "opacity-50 cursor-not-allowed" : "border-border",
        isAtLimit && "border-destructive/50"
      )}>
        {/* Line numbers */}
        <div
          ref={lineNumbersRef}
          className="flex-shrink-0 w-9 overflow-hidden bg-muted/50 border-r border-border select-none"
          style={{ height: "240px" }}
        >
          <div className="pt-3 pb-3">
            {Array.from({ length: lineCount }, (_, i) => (
              <div
                key={i + 1}
                className="text-[11px] text-muted-foreground/60 text-right pr-2 leading-6"
              >
                {i + 1}
              </div>
            ))}
          </div>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onScroll={syncScroll}
          disabled={disabled}
          placeholder={placeholder || `Paste your song lyrics here...\n\nVerse 1:\n...\n\nChorus:\n...`}
          className={cn(
            "flex-1 resize-none bg-transparent px-3 py-3 text-sm font-mono leading-6",
            "placeholder:text-muted-foreground/50 focus:outline-none",
            "scrollbar-thin",
            disabled && "cursor-not-allowed"
          )}
          style={{ height: "240px", minHeight: "240px" }}
          spellCheck={false}
        />
      </div>

      {/* Footer: line count + char count */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
        <span>{lineCount} line{lineCount !== 1 ? "s" : ""}</span>
        <span className={cn(isNearLimit && "text-amber-500", isAtLimit && "text-destructive font-medium")}>
          {charCount.toLocaleString()} / {charLimit.toLocaleString()}
        </span>
      </div>
    </div>
  );
};

export default LyricEditor;
