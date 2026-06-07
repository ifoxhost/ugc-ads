import { User, Dumbbell, Calendar, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { DemographicOptions } from "./ModelDemographics";

interface DemographicsPreviewProps {
  demographics: DemographicOptions;
  className?: string;
}

const LABELS: Record<string, Record<string, string>> = {
  gender: {
    any: "Any Gender",
    female: "Female",
    male: "Male",
    "non-binary": "Non-binary",
  },
  bodyBuild: {
    any: "Any Build",
    slim: "Slim",
    athletic: "Athletic",
    average: "Average",
    curvy: "Curvy",
    "plus-size": "Plus Size",
  },
  ageRange: {
    any: "Any Age",
    "18-25": "18-25",
    "26-35": "26-35",
    "36-45": "36-45",
    "46-55": "46-55",
    "56+": "56+",
  },
  ethnicity: {
    any: "Any Ethnicity",
    random: "Random",
    asian: "Asian",
    black: "Black",
    caucasian: "Caucasian",
    hispanic: "Hispanic/Latino",
    "middle-eastern": "Middle Eastern",
    mixed: "Mixed",
    "south-asian": "South Asian",
  },
};

const DemographicsPreview = ({ demographics, className }: DemographicsPreviewProps) => {
  const hasCustomEthnicity = !demographics.ethnicity.includes("any");
  const hasCustomDemographics = 
    demographics.gender !== "any" ||
    demographics.bodyBuild !== "any" ||
    demographics.ageRange !== "any" ||
    hasCustomEthnicity;

  if (!hasCustomDemographics) {
    return null;
  }

  const items = [
    { key: "gender", icon: User, value: demographics.gender, isArray: false },
    { key: "bodyBuild", icon: Dumbbell, value: demographics.bodyBuild, isArray: false },
    { key: "ageRange", icon: Calendar, value: demographics.ageRange, isArray: false },
  ].filter(item => item.value !== "any");

  // Handle ethnicity separately since it's now an array
  const ethnicityItems = hasCustomEthnicity ? demographics.ethnicity : [];

  return (
    <div className={cn("bg-accent/50 rounded-xl p-3 border border-border", className)}>
      <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
        Model Appearance
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map(({ key, icon: Icon, value }) => (
          <div
            key={key}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-background border border-border text-xs font-medium"
          >
            <Icon className="h-3 w-3 text-primary" />
            <span>{LABELS[key]?.[value as string] || value}</span>
          </div>
        ))}
        {ethnicityItems.map((eth) => (
          <div
            key={eth}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-background border border-border text-xs font-medium"
          >
            <Globe className="h-3 w-3 text-primary" />
            <span>{LABELS.ethnicity[eth] || eth}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DemographicsPreview;
