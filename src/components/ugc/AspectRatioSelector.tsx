import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface AspectRatio {
  id: string;
  label: string;
  ratio: string;
  width: number;
  height: number;
}

export const ASPECT_RATIOS: AspectRatio[] = [
  { id: "1:1", label: "Square", ratio: "1:1", width: 1024, height: 1024 },
  { id: "4:5", label: "Portrait", ratio: "4:5", width: 1024, height: 1280 },
  { id: "9:16", label: "Story", ratio: "9:16", width: 1024, height: 1820 },
  { id: "16:9", label: "Landscape", ratio: "16:9", width: 1920, height: 1080 },
];

interface AspectRatioSelectorProps {
  selectedRatio: string;
  onRatioSelect: (ratioId: string) => void;
}

const AspectRatioSelector = ({ selectedRatio, onRatioSelect }: AspectRatioSelectorProps) => {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium mb-1">Aspect Ratio</h3>
        <p className="text-xs text-muted-foreground">
          Choose the format for your ad
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {ASPECT_RATIOS.map((ratio) => (
          <button
            key={ratio.id}
            onClick={() => onRatioSelect(ratio.id)}
            className={cn(
              "relative px-4 py-2 rounded-lg border transition-all duration-200",
              "hover:border-primary/50",
              selectedRatio === ratio.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-foreground"
            )}
          >
            <div className="flex items-center gap-2">
              {selectedRatio === ratio.id && (
                <Check className="h-3 w-3" />
              )}
              <span className="text-sm font-medium">{ratio.label}</span>
              <span className="text-xs text-muted-foreground">({ratio.ratio})</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default AspectRatioSelector;
