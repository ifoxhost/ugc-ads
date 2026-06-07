import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Music, ChevronDown, ChevronUp, Scissors, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import SunoLinkParser, { ParsedSongData } from "./SunoLinkParser";
import PexelsBackgroundPicker from "./PexelsBackgroundPicker";
import { cn } from "@/lib/utils";

export type AspectRatio = "16:9" | "9:16" | "1:1" | "4:5";

export interface LyricVideoFormData {
  inputMode: "suno" | "upload";
  songTitle: string;
  artist: string;
  albumName: string;
  genre: string;
  videoStyle: string;
  visualTheme: string;
  mainCharacterDescription: string;
  additionalCharacterImages: string[];
  lyrics: string;
  template: string;
  aspectRatio: AspectRatio;
  fontTheme: string;
  colorPalette: string;
  variationCount: number;
  pexelsBackgroundUrl: string | null;
  pexelsBackgroundThumbnail: string | null;
  audioFileUrl: string | null;
  audioFileName: string | null;
  bpm: number;
  referenceImageUrl: string | null;
  referenceImageName: string | null;
  aiModel: "seedance" | "seedance-pro" | "kling" | "veo";
  aiImageModel: "nano-banana";
  resolution: "720p" | "1080p" | "1440p" | "4k";
  quality: "standard" | "high" | "ultra";
  fps: 24 | 30 | 60;
  duration: number;
  
  // Advanced Prompt Instructions
  storyDescription: string;
  characterInstructions: string;
  cameraInstructions: string;
  environmentInstructions: string;
  colorGradingInstructions: string;
  visualEffectsInstructions: string;
}

export const DEFAULT_LYRIC_FORM: LyricVideoFormData = {
  inputMode: "suno",
  songTitle: "",
  artist: "",
  albumName: "",
  genre: "Gospel / Afrobeat",
  videoStyle: "Cinematic",
  visualTheme: "Gold & Dark Neon",
  mainCharacterDescription: "A young energetic singer in dynamic lighting",
  additionalCharacterImages: [],
  lyrics: "",
  template: "kinetic",
  aspectRatio: "16:9",
  fontTheme: "bold",
  colorPalette: "dark",
  variationCount: 1,
  pexelsBackgroundUrl: null,
  pexelsBackgroundThumbnail: null,
  audioFileUrl: null,
  audioFileName: null,
  bpm: 128,
  referenceImageUrl: null,
  referenceImageName: null,
  aiModel: "seedance",
  aiImageModel: "nano-banana",
  resolution: "1080p",
  quality: "high",
  fps: 30,
  duration: 60,
  
  storyDescription: "",
  characterInstructions: "",
  cameraInstructions: "",
  environmentInstructions: "",
  colorGradingInstructions: "",
  visualEffectsInstructions: "",
};

const ASPECT_RATIOS: { value: AspectRatio; label: string; description: string }[] = [
  { value: "16:9", label: "16:9", description: "Widescreen YouTube" },
  { value: "9:16", label: "9:16", description: "TikTok / Reels" },
  { value: "1:1", label: "1:1", description: "Square Feed" },
  { value: "4:5", label: "4:5", description: "Portrait Grid" },
];

const VIDEO_STYLES = [
  "Cinematic", "Anime / Cel-Shaded", "Retro 80s Cyberpunk", "Vintage Film 35mm", "Realistic Photorealism", "Abstract Waveform"
];

const VISUAL_THEMES = [
  "Gold & Dark Neon", "Pastel Dreams", "Monochrome Noir", "Vibrant Cyberpunk", "Warm Sunset Cozy", "High Contrast Dark Glow"
];

interface LyricVideoFormProps {
  formData: LyricVideoFormData;
  onChange: (data: LyricVideoFormData) => void;
  disabled?: boolean;
}

const LyricVideoForm = ({ formData, onChange, disabled }: LyricVideoFormProps) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const update = (partial: Partial<LyricVideoFormData>) => {
    onChange({ ...formData, ...partial });
  };

  const handleSunoParsed = (data: ParsedSongData) => {
    update({
      songTitle: data.title || formData.songTitle,
      artist: data.artist || formData.artist,
      lyrics: data.lyricsSnippet || formData.lyrics,
      audioFileUrl: data.audioUrl || null,
      audioFileName: data.audioUrl ? "Parsed Audio Track.mp3" : null,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in text-foreground">
      {/* ── Song Input Tabs ── */}
      <Tabs
        value={formData.inputMode}
        onValueChange={(v) => update({ inputMode: v as "suno" | "upload" })}
      >
        <TabsList className="grid w-full grid-cols-2 h-11 bg-muted/30 border border-border/50 rounded-xl">
          <TabsTrigger value="suno" className="flex items-center gap-2 text-sm rounded-lg" disabled={disabled}>
            <Music className="h-4 w-4" />
            Suno / Udio URL
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-2 text-sm rounded-lg" disabled={disabled}>
            <Music className="h-4 w-4 animate-pulse" />
            Upload Audio File
          </TabsTrigger>
        </TabsList>

        <TabsContent value="suno" className="mt-4 space-y-4 animate-fade-in">
          <SunoLinkParser
            onParsed={handleSunoParsed}
            disabled={disabled}
            defaultUrl="https://suno.com/s/IhaahcrCF6Lz6hf9"
          />
          {/* Editable lyrics after Suno parse */}
          {formData.lyrics && (
            <div className="space-y-1.5 animate-fade-in">
              <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide flex items-center gap-2">
                <Scissors className="h-3 w-3" />
                Parsed Lyrics
                <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">editable</span>
              </Label>
              <textarea
                value={formData.lyrics}
                onChange={(e) => update({ lyrics: e.target.value })}
                disabled={disabled}
                placeholder="Lyrics extracted from Suno will appear here. Edit if needed..."
                className="w-full h-28 rounded-xl border border-border/60 bg-card/40 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring resize-none font-mono leading-relaxed"
              />
              <p className="text-[9px] text-muted-foreground">These lyrics are sent directly to ChatGPT (GPT-4o) as the song script source.</p>
            </div>
          )}
          <Separator className="bg-border/40" />
          <MetadataFields formData={formData} update={update} disabled={disabled} />
        </TabsContent>

        <TabsContent value="upload" className="mt-4 space-y-4 animate-fade-in">
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Music className="h-4 w-4 text-muted-foreground" />
              Upload Audio Track
            </Label>
            <div className="border-2 border-dashed border-border/80 rounded-2xl p-6 text-center hover:border-primary/50 transition-all relative bg-muted/10">
              <input
                type="file"
                accept="audio/mp3,audio/wav,audio/m4a,audio/flac,audio/*"
                disabled={disabled}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const url = URL.createObjectURL(file);
                    
                    // Simulate automatic duration detection
                    const audio = new Audio(url);
                    audio.addEventListener("loadedmetadata", () => {
                      update({
                        audioFileUrl: url,
                        audioFileName: file.name,
                        duration: Math.round(audio.duration),
                        songTitle: file.name.replace(/\.[^/.]+$/, "").split("-")[1]?.trim() || file.name.replace(/\.[^/.]+$/, "").trim(),
                        artist: file.name.replace(/\.[^/.]+$/, "").split("-")[0]?.trim() || "",
                      });
                    });
                  }
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {formData.audioFileName ? formData.audioFileName : "Click or drag your audio file here"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports MP3, WAV, M4A, FLAC up to 50MB (Duration Auto-Detected)
                </p>
              </div>
            </div>
          </div>

          {formData.audioFileUrl && (
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-2 animate-fade-in flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-wide">Audio Preview</p>
                <p className="text-xs text-muted-foreground mt-0.5">Duration: {formData.duration}s</p>
              </div>
              <audio src={formData.audioFileUrl} controls className="w-full md:w-3/5 h-9 rounded-lg mt-2 md:mt-0" />
            </div>
          )}

          {/* Optional lyrics field for Upload mode — combined with transcript for richer ChatGPT script */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide flex items-center gap-2">
              <Scissors className="h-3 w-3" />
              Song Lyrics
              <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">optional</span>
            </Label>
            <textarea
              value={formData.lyrics}
              onChange={(e) => update({ lyrics: e.target.value })}
              disabled={disabled}
              placeholder={`Paste song lyrics here (optional). If provided, they will be merged with the ElevenLabs audio transcript to give ChatGPT (GPT-4o) a richer source for generating your ${formData.songTitle ? `"${formData.songTitle}"` : 'music'} video script...`}
              className="w-full h-28 rounded-xl border border-border/60 bg-card/40 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring resize-none font-mono leading-relaxed"
            />
            <p className="text-[9px] text-muted-foreground">
              🎙️ <strong>ElevenLabs Scribe v2</strong> will transcribe your audio. If you also paste lyrics, both are merged and sent to <strong>ChatGPT</strong> for maximum scene quality.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <MetadataFields formData={formData} update={update} disabled={disabled} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">BPM (Tempo)</Label>
              <Input
                type="number"
                value={formData.bpm || ""}
                onChange={(e) => update({ bpm: Number(e.target.value) })}
                placeholder="e.g. 128"
                disabled={disabled}
                className="h-10 text-sm rounded-xl border-border bg-card"
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Visual Styles & Theme ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Video Style</Label>
          <select
            value={formData.videoStyle}
            onChange={(e) => update({ videoStyle: e.target.value })}
            className="w-full h-10 px-3 text-sm rounded-xl border border-border bg-card/60 focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={disabled}
          >
            {VIDEO_STYLES.map((style) => (
              <option key={style} value={style} className="bg-card text-foreground">{style}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Visual Theme</Label>
          <select
            value={formData.visualTheme}
            onChange={(e) => update({ visualTheme: e.target.value })}
            className="w-full h-10 px-3 text-sm rounded-xl border border-border bg-card/60 focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={disabled}
          >
            {VISUAL_THEMES.map((theme) => (
              <option key={theme} value={theme} className="bg-card text-foreground">{theme}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Main Character settings ── */}
      <div className="space-y-3 p-4 rounded-xl border border-border/60 bg-card/30">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Character Continuity Settings
        </h4>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Main Character Description</Label>
          <textarea
            value={formData.mainCharacterDescription}
            onChange={(e) => update({ mainCharacterDescription: e.target.value })}
            placeholder="Describe the main character (e.g., A young black African male singer in church choir robe)..."
            disabled={disabled}
            className="w-full h-16 rounded-xl border border-border bg-card/50 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="space-y-2">
            <Label className="text-[10px] text-muted-foreground uppercase font-bold">Primary Reference Image</Label>
            <Tabs defaultValue="upload" className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-8 p-0.5 bg-muted/30 rounded-lg">
                <TabsTrigger value="upload" className="text-[10px] py-0.5">Upload</TabsTrigger>
                <TabsTrigger value="pexels" className="text-[10px] py-0.5">Search</TabsTrigger>
              </TabsList>
              <TabsContent value="upload" className="mt-1.5">
                <div className="border border-dashed border-border rounded-xl p-3 text-center bg-card/45 relative hover:border-primary/50 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const url = URL.createObjectURL(file);
                        update({ referenceImageUrl: url, referenceImageName: file.name });
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <span className="text-[10px] text-muted-foreground truncate block">
                    {formData.referenceImageUrl ? formData.referenceImageName : "Upload Primary Character"}
                  </span>
                </div>
              </TabsContent>
              <TabsContent value="pexels" className="mt-1.5">
                <PexelsBackgroundPicker
                  aspectRatio={formData.aspectRatio}
                  selectedUrl={formData.referenceImageUrl}
                  onSelect={(url, name) => update({ referenceImageUrl: url, referenceImageName: name || "Pexels image" })}
                />
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] text-muted-foreground uppercase font-bold">Additional References (Multi)</Label>
            <div className="border border-dashed border-border rounded-xl p-4 text-center bg-card/45 relative hover:border-primary/50 transition-colors flex flex-col justify-center items-center h-[72px]">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  const urls = files.map(f => URL.createObjectURL(f));
                  update({ additionalCharacterImages: [...formData.additionalCharacterImages, ...urls] });
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <span className="text-[10px] text-muted-foreground">Upload additional angles/expressions</span>
              {formData.additionalCharacterImages.length > 0 && (
                <span className="text-[10px] text-primary font-bold mt-1">
                  {formData.additionalCharacterImages.length} images added
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Custom Script / Prompt Instructions Box ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Visual Story Script (Optional)</Label>
          <span className="text-xs text-muted-foreground">
            {formData.lyrics.length}/500 chars
          </span>
        </div>
        <textarea
          value={formData.lyrics}
          onChange={(e) => update({ lyrics: e.target.value.slice(0, 500) })}
          placeholder='e.g., "Afrobeat song: \"Your Blessings\", video main character is a young black african male lead with choir in church..."'
          disabled={disabled}
          maxLength={500}
          className="w-full h-24 rounded-xl border border-input bg-card px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono leading-relaxed"
        />
        <p className="text-[10px] text-muted-foreground leading-normal">
          This script details setting, character, and mood to supplement transcribed audio lyrics for AI video generation (e.g. for character lip-syncing).
        </p>
      </div>

      {/* ── Advanced Video settings Toggle ── */}
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between gap-2 h-11 rounded-xl bg-card/30 border-border hover:bg-card/60"
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        <span className="flex items-center gap-2 font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          {showAdvanced ? "Hide Advanced Production Settings" : "Open Advanced Production Settings"}
        </span>
        {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </Button>

      {showAdvanced && (
        <div className="space-y-5 p-5 rounded-2xl border border-border bg-card/40 animate-fade-in text-xs">
          
          {/* AI Generator Engine Models */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">AI Video Engine</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: "seedance", label: "Seedance 2.0 Fast", desc: "Default · beat-aware motion" },
                  { value: "seedance-pro", label: "Seedance 2.0", desc: "Higher fidelity, slower" },
                  { value: "kling", label: "Kling 3.0", desc: "Cinematic movement" },
                  { value: "veo", label: "Google VEO 3.1", desc: "Photorealistic detailing" }
                ].map((model) => (
                  <button
                    key={model.value}
                    type="button"
                    onClick={() => update({ aiModel: model.value as any })}
                    className={cn(
                      "flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all",
                      formData.aiModel === model.value
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border hover:border-primary/40 bg-background/50"
                    )}
                  >
                    <span className="text-xs font-semibold">{model.label}</span>
                    <span className="text-[9px] text-muted-foreground mt-0.5">{model.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">AI Image Engine</Label>
              <div className="flex items-center justify-between gap-2 p-3 rounded-xl border border-primary bg-primary/10">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-foreground">Nano Banana</span>
                  <span className="text-[9px] text-muted-foreground mt-0.5">Google Gemini image — fast, high quality</span>
                </div>
                <span className="text-[9px] uppercase tracking-wider font-semibold text-primary">Active</span>
              </div>
            </div>
          </div>

          {/* Aspect Ratio, Quality, FPS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Aspect Ratio</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {ASPECT_RATIOS.map((ratio) => (
                  <button
                    key={ratio.value}
                    type="button"
                    onClick={() => update({ aspectRatio: ratio.value })}
                    className={cn(
                      "flex flex-col items-center justify-center p-1.5 rounded-xl border text-center transition-all",
                      formData.aspectRatio === ratio.value
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border hover:border-primary/40 bg-background/50"
                    )}
                  >
                    <span className="text-xs font-semibold">{ratio.label}</span>
                    <span className="text-[8px] text-muted-foreground mt-0.5 truncate max-w-full">{ratio.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Render Quality</Label>
              <div className="grid grid-cols-3 gap-1">
                {["standard", "high", "ultra"].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => update({ quality: q as any })}
                    className={cn(
                      "flex items-center justify-center py-2 rounded-xl border capitalize font-semibold transition-all",
                      formData.quality === q
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/40 bg-background/50"
                    )}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Framerate (FPS)</Label>
              <div className="grid grid-cols-3 gap-1">
                {[24, 30, 60].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => update({ fps: f as any })}
                    className={cn(
                      "flex items-center justify-center py-2 rounded-xl border font-semibold transition-all",
                      formData.fps === f
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/40 bg-background/50"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Separator className="bg-border/30" />

          {/* ── Advanced Prompt Instructions ── */}
          <div className="space-y-3">
            <h5 className="font-bold text-foreground text-xs tracking-wider uppercase">Advanced Scene Directives</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] text-muted-foreground">Story Description</Label>
                <textarea
                  value={formData.storyDescription}
                  onChange={(e) => update({ storyDescription: e.target.value })}
                  placeholder="Cinematic narrative arc of the music video..."
                  className="w-full h-16 rounded-xl border border-border bg-background px-2 py-1 text-xs focus:ring-1 focus:ring-primary focus:outline-none resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] text-muted-foreground">Character Instructions</Label>
                <textarea
                  value={formData.characterInstructions}
                  onChange={(e) => update({ characterInstructions: e.target.value })}
                  placeholder="Wardrobe details, facial features, expressions..."
                  className="w-full h-16 rounded-xl border border-border bg-background px-2 py-1 text-xs focus:ring-1 focus:ring-primary focus:outline-none resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] text-muted-foreground">Camera Instructions</Label>
                <textarea
                  value={formData.cameraInstructions}
                  onChange={(e) => update({ cameraInstructions: e.target.value })}
                  placeholder="Pushes, pans, dolly zooms, tracking moves, speed..."
                  className="w-full h-16 rounded-xl border border-border bg-background px-2 py-1 text-xs focus:ring-1 focus:ring-primary focus:outline-none resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] text-muted-foreground">Environment Instructions</Label>
                <textarea
                  value={formData.environmentInstructions}
                  onChange={(e) => update({ environmentInstructions: e.target.value })}
                  placeholder="Set descriptions, rain, steam, reflections, lighting..."
                  className="w-full h-16 rounded-xl border border-border bg-background px-2 py-1 text-xs focus:ring-1 focus:ring-primary focus:outline-none resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] text-muted-foreground">Color Grading Instructions</Label>
                <textarea
                  value={formData.colorGradingInstructions}
                  onChange={(e) => update({ colorGradingInstructions: e.target.value })}
                  placeholder="LUT filters, high-contrast, teal and orange, gold tones..."
                  className="w-full h-16 rounded-xl border border-border bg-background px-2 py-1 text-xs focus:ring-1 focus:ring-primary focus:outline-none resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] text-muted-foreground">Visual Effects (VFX)</Label>
                <textarea
                  value={formData.visualEffectsInstructions}
                  onChange={(e) => update({ visualEffectsInstructions: e.target.value })}
                  placeholder="Slow motion, flares, light leaks, glitches, transitions..."
                  className="w-full h-16 rounded-xl border border-border bg-background px-2 py-1 text-xs focus:ring-1 focus:ring-primary focus:outline-none resize-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MetadataFields = ({
  formData,
  update,
  disabled,
}: {
  formData: LyricVideoFormData;
  update: (partial: Partial<LyricVideoFormData>) => void;
  disabled?: boolean;
}) => (
  <div className="space-y-3">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Song Title</Label>
        <Input
          value={formData.songTitle}
          onChange={(e) => update({ songTitle: e.target.value })}
          placeholder="e.g. Blinding Lights"
          disabled={disabled}
          className="h-10 text-sm rounded-xl border-border bg-card"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Artist Name</Label>
        <Input
          value={formData.artist}
          onChange={(e) => update({ artist: e.target.value })}
          placeholder="e.g. The Weeknd"
          disabled={disabled}
          className="h-10 text-sm rounded-xl border-border bg-card"
        />
      </div>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Album Name (Optional)</Label>
        <Input
          value={formData.albumName}
          onChange={(e) => update({ albumName: e.target.value })}
          placeholder="e.g. After Hours"
          disabled={disabled}
          className="h-10 text-sm rounded-xl border-border bg-card"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Genre</Label>
        <Input
          value={formData.genre}
          onChange={(e) => update({ genre: e.target.value })}
          placeholder="e.g. Pop, R&B, Gospel"
          disabled={disabled}
          className="h-10 text-sm rounded-xl border-border bg-card"
        />
      </div>
    </div>
  </div>
);

export default LyricVideoForm;
