import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface LyricTemplate {
  id: string;
  name: string;
  description: string;
  gradient: string;
  accentColor: string;
  preview: string; // CSS class for the preview animation
}

export const LYRIC_TEMPLATES: LyricTemplate[] = [
  {
    id: "kinetic",
    name: "Kinetic",
    description: "Words fly in with energy",
    gradient: "from-violet-600 to-indigo-800",
    accentColor: "text-violet-300",
    preview: "kinetic",
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Clean, elegant fade-ins",
    gradient: "from-zinc-800 to-zinc-950",
    accentColor: "text-zinc-300",
    preview: "minimal",
  },
  {
    id: "neon",
    name: "Neon",
    description: "Glowing cyberpunk vibes",
    gradient: "from-cyan-900 to-black",
    accentColor: "text-cyan-300",
    preview: "neon",
  },
  {
    id: "cinematic",
    name: "Cinematic",
    description: "Movie-style letterbox",
    gradient: "from-amber-950 to-stone-950",
    accentColor: "text-amber-300",
    preview: "cinematic",
  },
  {
    id: "waveform",
    name: "Waveform",
    description: "Animated audio bars",
    gradient: "from-emerald-900 to-teal-950",
    accentColor: "text-emerald-300",
    preview: "waveform",
  },
  {
    id: "karaoke",
    name: "Karaoke",
    description: "Highlighted word-by-word",
    gradient: "from-pink-900 to-rose-950",
    accentColor: "text-pink-300",
    preview: "karaoke",
  },
];

interface TemplateSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const WaveformBars = () => (
  <div className="flex items-end gap-0.5 h-6">
    {[3, 5, 8, 6, 4, 7, 5, 3, 6, 8, 4, 5].map((h, i) => (
      <div
        key={i}
        className="w-1 bg-emerald-400 rounded-full opacity-80"
        style={{
          height: `${h * 3}px`,
          animationDelay: `${i * 0.1}s`,
        }}
      />
    ))}
  </div>
);

const TemplatePreview = ({ template }: { template: LyricTemplate }) => {
  return (
    <div className={cn("w-full h-full bg-gradient-to-br flex flex-col items-center justify-center p-3 gap-1.5", template.gradient)}>
      {template.id === "waveform" && (
        <WaveformBars />
      )}
      {template.id === "neon" && (
        <div className="text-cyan-300 text-xs font-mono font-bold tracking-widest drop-shadow-[0_0_8px_rgba(103,232,249,0.8)]">
          YEAH
        </div>
      )}
      {template.id === "kinetic" && (
        <div className="text-white text-xs font-black uppercase tracking-tight leading-none">
          <div className="text-violet-200 text-[10px]">feel the</div>
          <div className="text-lg leading-none">MUSIC</div>
        </div>
      )}
      {template.id === "minimal" && (
        <div className="text-zinc-300 text-xs font-light tracking-[0.2em] uppercase">
          moment
        </div>
      )}
      {template.id === "cinematic" && (
        <div className="w-full">
          <div className="h-2 bg-black/60 w-full" />
          <div className="text-amber-200 text-[10px] font-medium text-center py-1 tracking-wider">
            lyrics here
          </div>
          <div className="h-2 bg-black/60 w-full" />
        </div>
      )}
      {template.id === "karaoke" && (
        <div className="text-xs font-medium">
          <span className="text-pink-200">feel </span>
          <span className="text-white bg-pink-500 px-1 rounded">the</span>
          <span className="text-pink-400"> beat</span>
        </div>
      )}
    </div>
  );
};

const TemplateSelector = ({ value, onChange }: TemplateSelectorProps) => {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">Video Template</label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {LYRIC_TEMPLATES.map((template) => {
          const isSelected = value === template.id;
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onChange(template.id)}
              className={cn(
                "relative rounded-xl overflow-hidden border-2 transition-all duration-200 text-left group",
                isSelected
                  ? "border-primary shadow-lg shadow-primary/20 ring-2 ring-primary/30"
                  : "border-border hover:border-primary/50"
              )}
            >
              {/* Preview area */}
              <div className="aspect-[9/6] w-full overflow-hidden">
                <TemplatePreview template={template} />
              </div>

              {/* Label */}
              <div className="p-2.5 bg-card">
                <p className="text-xs font-semibold">{template.name}</p>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{template.description}</p>
              </div>

              {/* Selected checkmark */}
              {isSelected && (
                <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-md">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TemplateSelector;
