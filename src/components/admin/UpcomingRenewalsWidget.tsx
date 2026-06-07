import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CalendarClock, AlertTriangle } from "lucide-react";
import { format, differenceInDays } from "date-fns";

interface UpcomingRenewal {
  id: string;
  user_id: string;
  plan_id: string;
  amount: number;
  credits: number;
  credits_used: number;
  renew_date: string;
  status: string;
  profile?: {
    email: string | null;
    full_name: string | null;
  };
}

export const UpcomingRenewalsWidget = () => {
  const [renewals, setRenewals] = useState<UpcomingRenewal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUpcomingRenewals();
  }, []);

  const fetchUpcomingRenewals = async () => {
    try {
      const now = new Date();
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      // Fetch active subscriptions renewing in the next 7 days
      const { data: subscriptions, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("status", "active")
        .gte("renew_date", now.toISOString())
        .lte("renew_date", sevenDaysFromNow.toISOString())
        .order("renew_date", { ascending: true });

      if (error) throw error;

      if (subscriptions && subscriptions.length > 0) {
        // Fetch profiles for these subscriptions
        const userIds = subscriptions.map(s => s.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .in("id", userIds);

        // Map profiles to subscriptions
        const renewalsWithProfiles = subscriptions.map(sub => ({
          ...sub,
          profile: profiles?.find(p => p.id === sub.user_id) || undefined
        }));

        setRenewals(renewalsWithProfiles);
      } else {
        setRenewals([]);
      }
    } catch (error) {
      console.error("Error fetching upcoming renewals:", error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysUntilRenewal = (renewDate: string) => {
    return differenceInDays(new Date(renewDate), new Date());
  };

  const getUrgencyBadge = (daysLeft: number) => {
    if (daysLeft <= 1) {
      return <Badge variant="destructive" className="text-xs">Tomorrow</Badge>;
    } else if (daysLeft <= 3) {
      return <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700">{daysLeft} days</Badge>;
    }
    return <Badge variant="outline" className="text-xs">{daysLeft} days</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Upcoming Renewals
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" />
          Upcoming Renewals
        </CardTitle>
        <CardDescription>
          Subscriptions renewing in the next 7 days
        </CardDescription>
      </CardHeader>
      <CardContent>
        {renewals.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <CalendarClock className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No renewals in the next 7 days</p>
          </div>
        ) : (
          <div className="space-y-3">
            {renewals.map((renewal) => {
              const daysLeft = getDaysUntilRenewal(renewal.renew_date);
              const creditsRemaining = renewal.credits - renewal.credits_used;
              
              return (
                <div 
                  key={renewal.id} 
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">
                        {renewal.profile?.full_name || renewal.profile?.email || "Unknown User"}
                      </p>
                      {daysLeft <= 1 && (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {renewal.profile?.email}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs capitalize">
                        {renewal.plan_id}
                      </Badge>
                      <span>•</span>
                      <span>R{renewal.amount}</span>
                      <span>•</span>
                      <span>{creditsRemaining}/{renewal.credits} credits left</span>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    {getUrgencyBadge(daysLeft)}
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(renewal.renew_date), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
