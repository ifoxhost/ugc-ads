import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Check, Hand, Layout, ArrowLeftRight, MessageSquare, Sparkles, Camera, Sun, TreePine, Palette, Snowflake, Zap, Heart, Umbrella, Leaf, Coffee, Home, Waves, Building, Save, X, Bookmark, Pencil, RotateCcw, Copy, User, Dumbbell, Calendar, Globe } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DemographicOptions, DEFAULT_DEMOGRAPHICS } from "./ModelDemographics";

export interface UGCStyle {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  promptHint: string;
}

interface PromptTemplate {
  id: string;
  label: string;
  prompt: string;
  icon: React.ReactNode;
  category: "mood" | "seasonal" | "location";
}

interface UserPreset {
  id: string;
  name: string;
  prompt: string;
  demographics?: DemographicOptions | null;
}

const PROMPT_TEMPLATES: PromptTemplate[] = [
  // Mood & Lighting
  { id: "warm", label: "Warm Lighting", prompt: "warm golden hour lighting, soft amber tones", icon: <Sun className="h-3 w-3" />, category: "mood" },
  { id: "minimal", label: "Minimalist", prompt: "clean minimalist aesthetic, simple uncluttered background", icon: <Sparkles className="h-3 w-3" />, category: "mood" },
  { id: "cozy", label: "Cozy Vibes", prompt: "cozy warm atmosphere, soft textures, comfortable setting", icon: <Heart className="h-3 w-3" />, category: "mood" },
  { id: "vibrant", label: "Vibrant Colors", prompt: "vibrant saturated colors, bold and eye-catching", icon: <Palette className="h-3 w-3" />, category: "mood" },
  { id: "cool", label: "Cool Tones", prompt: "cool blue tones, modern sleek aesthetic", icon: <Snowflake className="h-3 w-3" />, category: "mood" },
  { id: "energetic", label: "Energetic", prompt: "dynamic energetic mood, action-oriented, movement", icon: <Zap className="h-3 w-3" />, category: "mood" },
  
  // Seasonal
  { id: "summer", label: "Summer", prompt: "bright summer vibes, warm sunlight, fresh and airy feel", icon: <Sun className="h-3 w-3" />, category: "seasonal" },
  { id: "winter", label: "Winter", prompt: "cozy winter aesthetic, soft cool tones, hygge atmosphere", icon: <Snowflake className="h-3 w-3" />, category: "seasonal" },
  { id: "fall", label: "Autumn", prompt: "warm autumn colors, earthy tones, cozy fall aesthetic", icon: <Leaf className="h-3 w-3" />, category: "seasonal" },
  { id: "spring", label: "Spring", prompt: "fresh spring vibes, soft pastels, blooming flowers, natural light", icon: <Umbrella className="h-3 w-3" />, category: "seasonal" },
  
  // Location
  { id: "outdoor", label: "Outdoor", prompt: "outdoor natural environment, greenery in background", icon: <TreePine className="h-3 w-3" />, category: "location" },
  { id: "beach", label: "Beach", prompt: "beach setting, ocean vibes, sandy textures, coastal aesthetic", icon: <Waves className="h-3 w-3" />, category: "location" },
  { id: "cafe", label: "Café", prompt: "cozy café setting, coffee shop aesthetic, warm ambient lighting", icon: <Coffee className="h-3 w-3" />, category: "location" },
  { id: "home", label: "Home Office", prompt: "home office setting, desk setup, productive workspace aesthetic", icon: <Home className="h-3 w-3" />, category: "location" },
  { id: "urban", label: "Urban", prompt: "urban city backdrop, modern architecture, street style setting", icon: <Building className="h-3 w-3" />, category: "location" },
];

const CATEGORY_LABELS: Record<string, string> = {
  mood: "Mood & Lighting",
  seasonal: "Seasonal",
  location: "Location",
};

export const UGC_STYLES: UGCStyle[] = [
  {
    id: "lifestyle",
    name: "Lifestyle / In-use",
    description: "Product being used in real life",
    icon: <Camera className="h-5 w-5" />,
    promptHint: "lifestyle product photography, casual everyday use, natural environment, authentic moment"
  },
  {
    id: "handheld",
    name: "Hand-holding POV",
    description: "Creator holding product view",
    icon: <Hand className="h-5 w-5" />,
    promptHint: "first-person POV, hand holding product, casual creator perspective, natural daylight"
  },
  {
    id: "flatlay",
    name: "Flat Lay",
    description: "Top-down on styled surface",
    icon: <Layout className="h-5 w-5" />,
    promptHint: "flat lay photography, top-down view, styled surface, aesthetic arrangement"
  },
  {
    id: "before-after",
    name: "Before / After",
    description: "Comparison style visual",
    icon: <ArrowLeftRight className="h-5 w-5" />,
    promptHint: "before and after comparison, split view, transformation showcase"
  },
  {
    id: "testimonial",
    name: "Testimonial Style",
    description: "Soft text overlay look",
    icon: <MessageSquare className="h-5 w-5" />,
    promptHint: "testimonial style, clean background with soft text space, authentic review aesthetic"
  },
  {
    id: "minimal-studio",
    name: "Minimal Studio",
    description: "Clean UGC-realistic studio",
    icon: <Sparkles className="h-5 w-5" />,
    promptHint: "minimal studio photography, clean neutral background, soft natural lighting, UGC realistic"
  }
];

interface UGCStyleSelectorProps {
  selectedStyle: string | null;
  onStyleSelect: (styleId: string) => void;
  customPrompt?: string;
  onCustomPromptChange?: (prompt: string) => void;
  demographics?: DemographicOptions;
  onDemographicsChange?: (demographics: DemographicOptions) => void;
}

const UGCStyleSelector = ({ 
  selectedStyle, 
  onStyleSelect,
  customPrompt = "",
  onCustomPromptChange,
  demographics = DEFAULT_DEMOGRAPHICS,
  onDemographicsChange
}: UGCStyleSelectorProps) => {
  const { toast } = useToast();
  const [userPresets, setUserPresets] = useState<UserPreset[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [presetToDelete, setPresetToDelete] = useState<UserPreset | null>(null);
  const [presetName, setPresetName] = useState("");
  const [editPresetName, setEditPresetName] = useState("");
  const [editPresetPrompt, setEditPresetPrompt] = useState("");
  const [editingPreset, setEditingPreset] = useState<UserPreset | null>(null);
  const [savingPreset, setSavingPreset] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (userId) {
      fetchUserPresets();
    }
  }, [userId]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id || null);
  };

  const fetchUserPresets = async () => {
    if (!userId) return;
    
    const { data, error } = await supabase
      .from("user_prompt_presets")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    
    if (!error && data) {
      const typedPresets: UserPreset[] = data.map(p => ({
        id: p.id,
        name: p.name,
        prompt: p.prompt,
        demographics: p.demographics as unknown as DemographicOptions | null,
      }));
      setUserPresets(typedPresets);
    }
  };

  const hasCustomDemographics = () => {
    return demographics.gender !== "any" ||
           demographics.bodyBuild !== "any" ||
           demographics.ageRange !== "any" ||
           !demographics.ethnicity.includes("any");
  };

  const handleSavePreset = async () => {
    if (!userId || !presetName.trim() || (!customPrompt.trim() && !hasCustomDemographics())) return;
    
    setSavingPreset(true);
    try {
      const demographicsJson = hasCustomDemographics() ? JSON.parse(JSON.stringify(demographics)) : null;
      const { error } = await supabase
        .from("user_prompt_presets")
        .insert([{
          user_id: userId,
          name: presetName.trim(),
          prompt: customPrompt.trim(),
          demographics: demographicsJson
        }]);

      if (error) throw error;

      toast({ title: "Preset saved!", description: `"${presetName}" has been saved to your presets.` });
      setPresetName("");
      setSaveDialogOpen(false);
      fetchUserPresets();
    } catch (error) {
      toast({ title: "Error", description: "Failed to save preset", variant: "destructive" });
    } finally {
      setSavingPreset(false);
    }
  };

  const handleEditPreset = (preset: UserPreset) => {
    setEditingPreset(preset);
    setEditPresetName(preset.name);
    setEditPresetPrompt(preset.prompt);
    setEditDialogOpen(true);
  };

  const handleDuplicatePreset = (preset: UserPreset) => {
    setPresetName(`${preset.name} (Copy)`);
    onCustomPromptChange?.(preset.prompt);
    if (preset.demographics) {
      onDemographicsChange?.(preset.demographics);
    }
    setSaveDialogOpen(true);
  };

  const handleUpdatePreset = async () => {
    if (!editingPreset || !editPresetName.trim() || !editPresetPrompt.trim()) return;
    
    setSavingPreset(true);
    try {
      const { error } = await supabase
        .from("user_prompt_presets")
        .update({
          name: editPresetName.trim(),
          prompt: editPresetPrompt.trim()
        })
        .eq("id", editingPreset.id);

      if (error) throw error;

      toast({ title: "Preset updated!", description: `"${editPresetName}" has been updated.` });
      setEditDialogOpen(false);
      setEditingPreset(null);
      fetchUserPresets();
    } catch (error) {
      toast({ title: "Error", description: "Failed to update preset", variant: "destructive" });
    } finally {
      setSavingPreset(false);
    }
  };

  const handleConfirmDelete = (preset: UserPreset) => {
    setPresetToDelete(preset);
    setDeleteDialogOpen(true);
  };

  const handleDeletePreset = async () => {
    if (!presetToDelete) return;

    const { error } = await supabase
      .from("user_prompt_presets")
      .delete()
      .eq("id", presetToDelete.id);

    if (!error) {
      toast({ title: "Preset deleted", description: `"${presetToDelete.name}" has been removed.` });
      fetchUserPresets();
    } else {
      toast({ title: "Error", description: "Failed to delete preset", variant: "destructive" });
    }
    
    setDeleteDialogOpen(false);
    setPresetToDelete(null);
  };

  const handleApplyPreset = (preset: UserPreset) => {
    onCustomPromptChange?.(preset.prompt);
    if (preset.demographics) {
      onDemographicsChange?.(preset.demographics);
    }
  };

  const handleClearAll = () => {
    onCustomPromptChange?.("");
  };
  
  const handleTemplateClick = (template: PromptTemplate) => {
    if (!onCustomPromptChange) return;
    
    if (customPrompt.includes(template.prompt)) {
      const newPrompt = customPrompt
        .replace(template.prompt, "")
        .replace(/,\s*,/g, ",")
        .replace(/^,\s*/, "")
        .replace(/,\s*$/, "")
        .trim();
      onCustomPromptChange(newPrompt);
    } else {
      const newPrompt = customPrompt 
        ? `${customPrompt}, ${template.prompt}`
        : template.prompt;
      onCustomPromptChange(newPrompt);
    }
  };

  const isTemplateActive = (template: PromptTemplate) => {
    return customPrompt.includes(template.prompt);
  };

  const getTemplatesByCategory = (category: string) => {
    return PROMPT_TEMPLATES.filter(t => t.category === category);
  };

  const hasActiveSelections = customPrompt.trim().length > 0;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Choose Ad Style</h3>
        <p className="text-sm text-muted-foreground">
          Select a UGC style template for your product ad
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {UGC_STYLES.map((style) => (
          <button
            key={style.id}
            onClick={() => onStyleSelect(style.id)}
            className={cn(
              "relative p-4 rounded-xl border-2 text-left transition-all duration-200",
              "hover:border-primary/50 hover:bg-primary/5",
              selectedStyle === style.id
                ? "border-primary bg-primary/10"
                : "border-border bg-card"
            )}
          >
            {selectedStyle === style.id && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="h-3 w-3 text-primary-foreground" />
              </div>
            )}
            
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 text-primary">
              {style.icon}
            </div>
            
            <h4 className="font-medium text-sm mb-1">{style.name}</h4>
            <p className="text-xs text-muted-foreground">{style.description}</p>
          </button>
        ))}
      </div>

      {/* Custom Prompt Section */}
      <div className="pt-2 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <label htmlFor="custom-prompt" className="text-sm font-medium mb-2 block">
              Custom Instructions <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <p className="text-xs text-muted-foreground">
              Click presets below or type your own styling preferences
            </p>
          </div>
          {hasActiveSelections && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={handleClearAll}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Clear All
            </Button>
          )}
        </div>

        {/* Preset Templates by Category */}
        {["mood", "seasonal", "location"].map((category) => (
          <div key={category} className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {CATEGORY_LABELS[category]}
            </p>
            <div className="flex flex-wrap gap-2">
              {getTemplatesByCategory(category).map((template) => (
                <Badge
                  key={template.id}
                  variant={isTemplateActive(template) ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer transition-all duration-200 py-1.5 px-3 gap-1.5",
                    isTemplateActive(template) 
                      ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                      : "hover:bg-primary/10 hover:border-primary/50"
                  )}
                  onClick={() => handleTemplateClick(template)}
                >
                  {template.icon}
                  {template.label}
                </Badge>
              ))}
            </div>
          </div>
        ))}

        {/* User Saved Presets */}
        {userId && userPresets.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Your Saved Presets
            </p>
            <div className="flex flex-wrap gap-2">
              {userPresets.map((preset) => (
                <Badge
                  key={preset.id}
                  variant="secondary"
                  className="cursor-pointer transition-all duration-200 py-1.5 px-3 gap-1.5 group hover:bg-secondary/80"
                >
                  <span onClick={() => handleApplyPreset(preset)} className="flex items-center gap-1.5">
                    <Bookmark className="h-3 w-3" />
                    {preset.name}
                    {preset.demographics && (
                      <span title="Includes model appearance settings">
                        <User className="h-3 w-3 text-primary" />
                      </span>
                    )}
                  </span>
                  <span 
                    className="opacity-50 hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicatePreset(preset);
                    }}
                    title="Duplicate preset"
                  >
                    <Copy className="h-3 w-3 ml-1" />
                  </span>
                  <span 
                    className="opacity-50 hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditPreset(preset);
                    }}
                    title="Edit preset"
                  >
                    <Pencil className="h-3 w-3" />
                  </span>
                  <span 
                    className="opacity-50 hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleConfirmDelete(preset);
                    }}
                    title="Delete preset"
                  >
                    <X className="h-3 w-3" />
                  </span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Textarea
          id="custom-prompt"
          placeholder="Add any specific features, styling preferences, or customizations..."
          value={customPrompt}
          onChange={(e) => onCustomPromptChange?.(e.target.value)}
          className="min-h-[80px] resize-none"
          maxLength={500}
        />
        
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {customPrompt.length}/500 characters
          </p>
          
          {/* Save Preset Button */}
          {userId && (customPrompt.trim() || hasCustomDemographics()) && (
            <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5">
                  <Save className="h-3.5 w-3.5" />
                  Save as Preset
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Save Custom Preset</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Preset Name</label>
                    <Input
                      placeholder="e.g., My Summer Style"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      maxLength={50}
                    />
                  </div>
                  {customPrompt && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">Prompt Preview</label>
                      <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                        {customPrompt}
                      </p>
                    </div>
                  )}
                  {hasCustomDemographics() && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">Model Appearance</label>
                      <div className="flex flex-wrap gap-2 bg-muted/50 p-3 rounded-lg">
                        {demographics.gender !== "any" && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-background rounded text-xs">
                            <User className="h-3 w-3" /> {demographics.gender}
                          </span>
                        )}
                        {demographics.bodyBuild !== "any" && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-background rounded text-xs">
                            <Dumbbell className="h-3 w-3" /> {demographics.bodyBuild}
                          </span>
                        )}
                        {demographics.ageRange !== "any" && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-background rounded text-xs">
                            <Calendar className="h-3 w-3" /> {demographics.ageRange}
                          </span>
                        )}
                        {!demographics.ethnicity.includes("any") && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-background rounded text-xs">
                            <Globe className="h-3 w-3" /> {demographics.ethnicity.join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  <Button 
                    onClick={handleSavePreset} 
                    disabled={!presetName.trim() || savingPreset}
                    className="w-full"
                  >
                    {savingPreset ? "Saving..." : "Save Preset"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Edit Preset Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Preset</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium mb-2 block">Preset Name</label>
              <Input
                placeholder="e.g., My Summer Style"
                value={editPresetName}
                onChange={(e) => setEditPresetName(e.target.value)}
                maxLength={50}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Prompt</label>
              <Textarea
                placeholder="Enter your custom prompt..."
                value={editPresetPrompt}
                onChange={(e) => setEditPresetPrompt(e.target.value)}
                className="min-h-[100px] resize-none"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {editPresetPrompt.length}/500 characters
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleUpdatePreset} 
                disabled={!editPresetName.trim() || !editPresetPrompt.trim() || savingPreset}
                className="flex-1"
              >
                {savingPreset ? "Saving..." : "Update Preset"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Preset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{presetToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPresetToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePreset} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UGCStyleSelector;
