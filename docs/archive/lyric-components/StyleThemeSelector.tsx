import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export const FONT_THEMES = [
  { id: "bold", name: "Bold", description: "Heavy impact", preview: "font-black text-xl" },
  { id: "serif", name: "Serif", description: "Classic elegance", preview: "font-serif text-base italic" },
  { id: "modern-sans", name: "Modern Sans", description: "Clean & sharp", preview: "font-light text-base tracking-widest" },
  { id: "handwritten", name: "Handwritten", description: "Personal touch", preview: "font-medium text-base italic" },
] as const;

export const COLOR_PALETTES = [
  {
    id: "dark",
    name: "Dark",
    description: "Dark bg, white text",
    colors: ["#0a0a0a", "#1a1a2e", "#ffffff"],
  },
  {
    id: "neon",
    name: "Neon",
    description: "Electric accents",
    colors: ["#0d0d0d", "#00fff5", "#ff00e4"],
  },
  {
    id: "pastel",
    name: "Pastel",
    description: "Soft & dreamy",
    colors: ["#fce4ec", "#e8f5e9", "#e3f2fd"],
  },
  {
    id: "monochrome",
    name: "Mono",
    description: "Pure black & white",
    colors: ["#000000", "#555555", "#ffffff"],
  },
] as const;

export type FontTheme = typeof FONT_THEMES[number]["id"];
export type ColorPalette = typeof COLOR_PALETTES[number]["id"];

interface StyleThemeSelectorProps {
  fontTheme: FontTheme;
  colorPalette: ColorPalette;
  onFontThemeChange: (value: FontTheme) => void;
  onColorPaletteChange: (value: ColorPalette) => void;
}

const StyleThemeSelector = ({
  fontTheme,
  colorPalette,
  onFontThemeChange,
  onColorPaletteChange,
}: StyleThemeSelectorProps) => {
  return (
    <div className="space-y-6">
      {/* Font Theme */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Font Style</label>
        <div className="grid grid-cols-2 gap-2">
          {FONT_THEMES.map((theme) => {
            const isSelected = fontTheme === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => onFontThemeChange(theme.id)}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200",
                  "bg-card hover:bg-muted/50",
                  isSelected
                    ? "border-primary ring-2 ring-primary/20 shadow-md"
                    : "border-border hover:border-primary/40"
                )}
              >
                <span className={cn("text-sm text-foreground", theme.preview)}>
                  Aa
                </span>
                <div className="text-center">
                  <p className="text-xs font-semibold">{theme.name}</p>
                  <p className="text-[10px] text-muted-foreground">{theme.description}</p>
                </div>
                {isSelected && (
                  <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-2.5 w-2.5 text-primary-foreground" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Color Palette */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Color Palette</label>
        <div className="grid grid-cols-2 gap-2">
          {COLOR_PALETTES.map((palette) => {
            const isSelected = colorPalette === palette.id;
            return (
              <button
                key={palette.id}
                type="button"
                onClick={() => onColorPaletteChange(palette.id)}
                className={cn(
                  "relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 text-left",
                  "bg-card hover:bg-muted/50",
                  isSelected
                    ? "border-primary ring-2 ring-primary/20 shadow-md"
                    : "border-border hover:border-primary/40"
                )}
              >
                {/* Color swatches */}
                <div className="flex gap-0.5 flex-shrink-0">
                  {palette.colors.map((color, i) => (
                    <div
                      key={i}
                      className="w-4 h-8 rounded-sm border border-white/10"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div>
                  <p className="text-xs font-semibold">{palette.name}</p>
                  <p className="text-[10px] text-muted-foreground">{palette.description}</p>
                </div>
                {isSelected && (
                  <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-2.5 w-2.5 text-primary-foreground" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StyleThemeSelector;
