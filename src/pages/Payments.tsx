import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, CreditCard, Calendar, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CancelSubscriptionDialog } from "@/components/payments/CancelSubscriptionDialog";

interface Subscription {
  id: string;
  plan_id: string;
  amount: number;
  credits: number;
  credits_used: number;
  renew_date: string;
  status: string;
}

interface Transaction {
  id: string;
  payment_id: string;
  amount: number;
  status: string;
  created_at: string;
  metadata: any;
}

export default function Payments() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      // Fetch subscription
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      setSubscription(subData);

      // Fetch transactions
      const { data: txData } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      setTransactions(txData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = () => {
    navigate("/pricing");
  };

  const handleCancelSubscription = async () => {
    setCancelling(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !subscription) return;

      // Update subscription status
      await supabase
        .from("subscriptions")
        .update({ status: "cancelled" })
        .eq("user_id", user.id);

      // Send cancellation confirmation email
      try {
        await supabase.functions.invoke("send-cancellation-email", {
          body: {
            userId: user.id,
            planName: subscription.plan_id.charAt(0).toUpperCase() + subscription.plan_id.slice(1),
            endDate: subscription.renew_date,
            creditsRemaining: subscription.credits - subscription.credits_used,
          },
        });
      } catch (emailError) {
        console.error("Failed to send cancellation email:", emailError);
        // Don't block the cancellation if email fails
      }

      toast({
        title: "Subscription Cancelled",
        description: "Your subscription will remain active until the renewal date. Check your email for details!",
      });

      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to cancel subscription. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const creditsRemaining = subscription ? subscription.credits - subscription.credits_used : 0;
  const creditsPercentage = subscription ? (creditsRemaining / subscription.credits) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 py-12 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Billing & Payments
          </h1>
          <p className="text-muted-foreground mt-2">Manage your subscription and view payment history</p>
        </div>

        {!subscription ? (
          <Card className="border-2 border-dashed">
            <CardHeader className="text-center">
              <CardTitle>No Active Subscription</CardTitle>
              <CardDescription>
                Choose a plan to start creating lyric videos
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button onClick={handleUpgrade} size="lg">
                View Plans
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="capitalize">{subscription.plan_id} Plan</CardTitle>
                  <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'}>
                    {subscription.status}
                  </Badge>
                </div>
                <CardDescription>R{subscription.amount}/month</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Credits Remaining</span>
                    <span className="font-medium">{creditsRemaining} / {subscription.credits}</span>
                  </div>
                  <Progress value={creditsPercentage} />
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Renews on {new Date(subscription.renew_date).toLocaleDateString()}</span>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleUpgrade} variant="default" className="flex-1">
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Upgrade
                  </Button>
                  {subscription.status === 'active' && (
                    <CancelSubscriptionDialog
                      renewDate={subscription.renew_date}
                      planName={subscription.plan_id}
                      creditsRemaining={creditsRemaining}
                      onConfirm={handleCancelSubscription}
                      isLoading={cancelling}
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
                <CardDescription>Your recent transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {transactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No transactions yet
                    </p>
                  ) : (
                    transactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex items-center gap-3">
                          {tx.status === 'success' ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : tx.status === 'failed' ? (
                            <XCircle className="h-5 w-5 text-red-500" />
                          ) : (
                            <CreditCard className="h-5 w-5 text-yellow-500" />
                          )}
                          <div>
                            <p className="text-sm font-medium">
                              {tx.metadata?.plan_name || 'Payment'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(tx.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <span className="font-medium">R{tx.amount}</span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
