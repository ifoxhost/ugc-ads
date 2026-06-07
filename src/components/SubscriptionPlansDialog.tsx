import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Music2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SubscriptionPlansDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: "R199",
    period: "/month",
    features: [
      "20 lyric videos / month",
      "SD export",
      "All 6 templates",
      "Suno link parsing",
    ],
    variant: "outline" as const,
  },
  {
    id: "pro",
    name: "Pro",
    price: "R499",
    period: "/month",
    badge: "Most Popular",
    offerBadge: "🔥 Best Value",
    features: [
      "100 lyric videos / month",
      "HD export",
      "All 6 premium templates",
      "Suno link parsing",
      "Priority rendering",
    ],
    variant: "default" as const,
    highlight: true,
  },
  {
    id: "studio",
    name: "Studio",
    price: "R1 299",
    period: "/month",
    features: [
      "400 lyric videos / month",
      "4K export",
      "Custom font uploads",
      "Multi-project workspace",
      "Team collaboration",
    ],
    variant: "outline" as const,
  },
];

const SubscriptionPlansDialog = ({ open, onOpenChange }: SubscriptionPlansDialogProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSelectPlan = async (planId: string) => {
    try {
      setLoading(planId);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center pb-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Music2 className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-2xl font-semibold">
            Subscribe to Generate Videos
          </DialogTitle>
          <DialogDescription>
            Choose a plan to unlock lyric video generation and start creating stunning music content
          </DialogDescription>
        </DialogHeader>

        <div className="grid sm:grid-cols-3 gap-4 py-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl p-5 border transition-all ${
                plan.highlight
                  ? "bg-gradient-to-b from-primary/10 to-transparent border-primary/30 shadow-lg shadow-primary/10"
                  : "bg-card border-border hover:border-primary/20"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 flex gap-1.5">
                  <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                    {plan.badge}
                  </span>
                  {plan.offerBadge && (
                    <span className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-medium px-3 py-1 rounded-full animate-pulse">
                      {plan.offerBadge}
                    </span>
                  )}
                </div>
              )}
              
              <div className="mb-4 pt-1">
                <h3 className="text-lg font-semibold mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-2 mb-5">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant={plan.highlight ? "default" : "outline"}
                className={`w-full rounded-xl ${
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
                  "Get Started"
                )}
              </Button>
            </div>
          ))}
        </div>

        <div className="text-center pt-2 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onOpenChange(false);
              navigate("/pricing");
            }}
          >
            View full pricing details
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SubscriptionPlansDialog;
