import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, CheckCheck } from "lucide-react";

export interface DemographicOptions {
  gender: string;
  bodyBuild: string;
  ageRange: string;
  ethnicity: string[];
}

export const DEFAULT_DEMOGRAPHICS: DemographicOptions = {
  gender: "any",
  bodyBuild: "any",
  ageRange: "any",
  ethnicity: ["any"],
};

const GENDER_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "non-binary", label: "Non-binary" },
];

const BODY_BUILD_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "slim", label: "Slim" },
  { value: "athletic", label: "Athletic" },
  { value: "average", label: "Average" },
  { value: "curvy", label: "Curvy" },
  { value: "plus-size", label: "Plus Size" },
];

const AGE_RANGE_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "18-25", label: "18-25" },
  { value: "26-35", label: "26-35" },
  { value: "36-45", label: "36-45" },
  { value: "46-55", label: "46-55" },
  { value: "56+", label: "56+" },
];

const ETHNICITY_OPTIONS = [
  { value: "random", label: "Random" },
  { value: "asian", label: "Asian" },
  { value: "black", label: "Black" },
  { value: "caucasian", label: "Caucasian" },
  { value: "hispanic", label: "Hispanic/Latino" },
  { value: "middle-eastern", label: "Middle Eastern" },
  { value: "mixed", label: "Mixed" },
  { value: "south-asian", label: "South Asian" },
];

interface ModelDemographicsProps {
  demographics: DemographicOptions;
  onDemographicsChange: (demographics: DemographicOptions) => void;
}

const ModelDemographics = ({ demographics, onDemographicsChange }: ModelDemographicsProps) => {
  const handleChange = (field: keyof Omit<DemographicOptions, 'ethnicity'>, value: string) => {
    onDemographicsChange({
      ...demographics,
      [field]: value,
    });
  };

  const handleEthnicityToggle = (value: string) => {
    const currentEthnicities = demographics.ethnicity;
    
    // If selecting "random" or "any", clear others and set just that
    if (value === "random" || value === "any") {
      onDemographicsChange({
        ...demographics,
        ethnicity: [value],
      });
      return;
    }
    
    // If currently has "any" or "random", replace with the new selection
    if (currentEthnicities.includes("any") || currentEthnicities.includes("random")) {
      onDemographicsChange({
        ...demographics,
        ethnicity: [value],
      });
      return;
    }
    
    // Toggle the ethnicity
    if (currentEthnicities.includes(value)) {
      const newEthnicities = currentEthnicities.filter(e => e !== value);
      // If nothing left, default to "any"
      onDemographicsChange({
        ...demographics,
        ethnicity: newEthnicities.length > 0 ? newEthnicities : ["any"],
      });
    } else {
      onDemographicsChange({
        ...demographics,
        ethnicity: [...currentEthnicities, value],
      });
    }
  };

  const removeEthnicity = (value: string) => {
    const newEthnicities = demographics.ethnicity.filter(e => e !== value);
    onDemographicsChange({
      ...demographics,
      ethnicity: newEthnicities.length > 0 ? newEthnicities : ["any"],
    });
  };

  const handleSelectAll = () => {
    // Get all specific ethnicities (exclude "random")
    const allSpecificEthnicities = ETHNICITY_OPTIONS
      .filter(opt => opt.value !== "random")
      .map(opt => opt.value);
    
    onDemographicsChange({
      ...demographics,
      ethnicity: allSpecificEthnicities,
    });
  };

  const getEthnicityLabel = (value: string) => {
    if (value === "any") return "Any";
    return ETHNICITY_OPTIONS.find(o => o.value === value)?.label || value;
  };

  // Check if all specific ethnicities are selected
  const allSpecificSelected = ETHNICITY_OPTIONS
    .filter(opt => opt.value !== "random")
    .every(opt => demographics.ethnicity.includes(opt.value));

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Model Appearance</h3>
        <p className="text-sm text-muted-foreground">
          Customize the model's appearance in your UGC ad (optional)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Gender */}
        <div className="space-y-2">
          <Label htmlFor="gender" className="text-sm font-medium">
            Gender
          </Label>
          <Select
            value={demographics.gender}
            onValueChange={(value) => handleChange("gender", value)}
          >
            <SelectTrigger id="gender" className="w-full">
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              {GENDER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Body Build */}
        <div className="space-y-2">
          <Label htmlFor="bodyBuild" className="text-sm font-medium">
            Body Build
          </Label>
          <Select
            value={demographics.bodyBuild}
            onValueChange={(value) => handleChange("bodyBuild", value)}
          >
            <SelectTrigger id="bodyBuild" className="w-full">
              <SelectValue placeholder="Select body build" />
            </SelectTrigger>
            <SelectContent>
              {BODY_BUILD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Age Range */}
        <div className="space-y-2">
          <Label htmlFor="ageRange" className="text-sm font-medium">
            Age Range
          </Label>
          <Select
            value={demographics.ageRange}
            onValueChange={(value) => handleChange("ageRange", value)}
          >
            <SelectTrigger id="ageRange" className="w-full">
              <SelectValue placeholder="Select age range" />
            </SelectTrigger>
            <SelectContent>
              {AGE_RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Ethnicity - Multi-select */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              Ethnicity
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={handleSelectAll}
              disabled={allSpecificSelected}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Select All
            </Button>
          </div>
          <div className="space-y-2">
            {/* Selected ethnicities as badges */}
            <div className="flex flex-wrap gap-1 min-h-[2.5rem] p-2 border rounded-md bg-background">
              {demographics.ethnicity.map((eth) => (
                <Badge 
                  key={eth} 
                  variant="secondary" 
                  className="flex items-center gap-1"
                >
                  {getEthnicityLabel(eth)}
                  {demographics.ethnicity.length > 1 || (eth !== "any") ? (
                    <X 
                      className="h-3 w-3 cursor-pointer hover:text-destructive" 
                      onClick={() => removeEthnicity(eth)}
                    />
                  ) : null}
                </Badge>
              ))}
            </div>
            
            {/* Ethnicity checkboxes */}
            <div className="grid grid-cols-2 gap-2 p-2 border rounded-md bg-muted/30 max-h-40 overflow-y-auto">
              {ETHNICITY_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-1 rounded"
                >
                  <Checkbox
                    checked={
                      option.value === "random" 
                        ? demographics.ethnicity.includes("random")
                        : demographics.ethnicity.includes(option.value)
                    }
                    onCheckedChange={() => handleEthnicityToggle(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelDemographics;
