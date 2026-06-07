import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Pricing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSelectPlan = async (planId: string) => {
    try {
      setLoading(planId);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: { plan_id: planId }
      });

      if (error) throw error;

      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast({
        title: "Error",
        description: "Failed to process checkout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const plans = [
    {
      id: "starter",
      name: "Starter",
      price: "R199",
      period: "/month",
      features: [
        "10 AI music videos / month",
        "HD export (1080p)",
        "Kling 3.0 + Veo 3.1 engines",
        "GPT-4o script writing",
        "Suno URL import",
        "ElevenLabs transcription",
        "9:16, 1:1, 16:9 formats",
        "Email support",
      ],
      cta: "Start Free Trial",
      variant: "outline" as const,
    },
    {
      id: "pro",
      name: "Pro",
      price: "R499",
      period: "/month",
      badge: "Most Popular",
      features: [
        "50 AI music videos / month",
        "4K export (Ultra HD)",
        "Kling 3.0 + Veo 3.1 engines",
        "GPT-4o + script customization",
        "Suno URL import + audio upload",
        "ElevenLabs Scribe v2 transcription",
        "Priority rendering queue",
        "All aspect ratios incl. 4:5",
        "Email + Chat support",
      ],
      cta: "Start Free Trial",
      variant: "default" as const,
      highlight: true,
    },
    {
      id: "studio",
      name: "Studio",
      price: "R1 299",
      period: "/month",
      features: [
        "200 AI music videos / month",
        "4K export + raw storyboard files",
        "All AI engines incl. future models",
        "Custom visual style presets",
        "Multi-project workspace",
        "Team collaboration (5 seats)",
        "Commercial license for all outputs",
        "Dedicated account manager",
      ],
      cta: "Start Free Trial",
      variant: "outline" as const,
    },
  ];

  const creditsTable = [
    { action: "AI Music Video — SD (9:16, Kling 3.0)", credits: 5 },
    { action: "AI Music Video — HD (9:16, Kling 3.0)", credits: 8 },
    { action: "AI Music Video — 4K (16:9, Veo 3.1)", credits: 15 },
    { action: "AI Music Video — 4K (9:16, Veo 3.1)", credits: 15 },
    { action: "AI Music Video — 1:1 Square (any engine)", credits: 8 },
    { action: "Storyboard only (Nano Banana Pro)", credits: 2 },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Pricing Hero */}
      <section className="pt-20 sm:pt-32 pb-12 sm:pb-20 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-[2rem] sm:text-[3rem] md:text-[4rem] font-tight font-semibold mb-3 sm:mb-4 tracking-tight">
            Simple Pricing for AI Music Video Creation
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg mb-6 sm:mb-8">
            Every plan includes Kling 3.0, Veo 3.1, GPT-4o script writing, ElevenLabs transcription, and Suno URL import
          </p>

          {/* Plans Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 max-w-6xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-6 border ${
                  plan.highlight
                    ? "bg-gradient-to-b from-primary/5 to-transparent border-primary/20"
                    : "bg-card border-border"
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                      {plan.badge}
                    </span>
                  </div>
                )}
                
                <div className="mb-6">
                  <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 justify-center">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-6 text-left">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={plan.variant}
                  className={`w-full rounded-xl h-12 ${
                    plan.highlight
                      ? "bg-foreground text-background hover:bg-foreground/90"
                      : ""
                  }`}
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={loading === plan.id}
                >
                  {loading === plan.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    plan.cta
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Credits Table */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 bg-card/30">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-[1.75rem] sm:text-[2.5rem] font-tight font-semibold text-center mb-8 sm:mb-12 tracking-tight">
            Credit Usage
          </h2>
          <div className="bg-card rounded-xl overflow-x-auto border border-border">
            <table className="w-full min-w-[400px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 sm:py-4 px-3 sm:px-6 font-medium text-sm sm:text-base">Action</th>
                  <th className="text-left py-3 sm:py-4 px-3 sm:px-6 font-medium text-sm sm:text-base">SongDoe Credits Used</th>
                </tr>
              </thead>
              <tbody>
                {creditsTable.map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="py-3 sm:py-4 px-3 sm:px-6 text-sm sm:text-base">{row.action}</td>
                    <td className="py-3 sm:py-4 px-3 sm:px-6 text-sm sm:text-base">{row.credits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-12 sm:py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-[1.75rem] sm:text-[2.5rem] font-tight font-semibold text-center mb-3 sm:mb-4 tracking-tight">
            Pricing FAQ
          </h2>
          <p className="text-center text-muted-foreground mb-8 sm:mb-12 text-sm sm:text-base">
            Fine answers to common questions
          </p>
          <FAQ />
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Pricing;
