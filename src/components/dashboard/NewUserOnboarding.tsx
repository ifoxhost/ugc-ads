import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Music2, ArrowRight, Check, Link2, LayoutGrid, Video } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const steps: OnboardingStep[] = [
  {
    id: 1,
    title: "Paste Your Lyrics",
    description: "Drop in a Suno link and we'll auto-fill the title, artist, and lyrics — or type them in manually.",
    icon: <Link2 className="h-6 w-6" />,
  },
  {
    id: 2,
    title: "Pick a Style",
    description: "Choose from Kinetic, Neon, Cinematic, Waveform and more — each with its own mood and aesthetic.",
    icon: <LayoutGrid className="h-6 w-6" />,
  },
  {
    id: 3,
    title: "Generate Your Video",
    description: "SongDoe creates a cinematic AI music video in minutes. Download in SD, HD, or 4K.",
    icon: <Video className="h-6 w-6" />,
  },
];

interface NewUserOnboardingProps {
  onDismiss: () => void;
}

export const NewUserOnboarding = ({ onDismiss }: NewUserOnboardingProps) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      navigate("/create");
    }
  };

  const handleSkip = () => {
    onDismiss();
  };

  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/10 overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Welcome to SongDoe!</CardTitle>
              <CardDescription>Create your first AI music video in 3 simple steps</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            Skip
          </Button>
        </div>
        <Progress value={progress} className="h-1 mt-4" />
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`relative p-4 rounded-lg border transition-all ${
                index === currentStep
                  ? "border-primary bg-primary/10 shadow-sm"
                  : index < currentStep
                  ? "border-primary/30 bg-primary/5"
                  : "border-border bg-muted/30"
              }`}
            >
              {index < currentStep && (
                <div className="absolute top-2 right-2">
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                </div>
              )}
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${
                  index === currentStep
                    ? "bg-primary text-primary-foreground"
                    : index < currentStep
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step.icon}
              </div>
              <h3 className={`font-semibold mb-1 ${index <= currentStep ? "text-foreground" : "text-muted-foreground"}`}>
                {step.title}
              </h3>
              <p className={`text-sm ${index <= currentStep ? "text-muted-foreground" : "text-muted-foreground/60"}`}>
                {step.description}
              </p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Music2 className="h-4 w-4" />
              <span>Suno Link Parsing</span>
            </div>
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              <span>SD / HD / 4K Export</span>
            </div>
          </div>
          <Button onClick={handleNext} className="gap-2">
            {currentStep === steps.length - 1 ? (
              <>
                Create Your First Ad
                <Sparkles className="h-4 w-4" />
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

