import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Search, TrendingUp, DollarSign, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  amount: number;
  credits: number;
  credits_used: number;
  renew_date: string;
  status: string;
  created_at: string;
  profiles?: {
    email?: string;
    full_name?: string;
  } | null;
}

export const SubscriptionsManagement = () => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState({
    totalRevenue: 0,
    activeSubscriptions: 0,
    totalUsers: 0,
  });

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);

      // Fetch subscriptions with user profiles
      const { data: subsData, error: subsError } = await supabase
        .from("subscriptions")
        .select("*")
        .order("created_at", { ascending: false });

      if (subsError) throw subsError;

      setSubscriptions(subsData || []);

      // Calculate stats
      const activeCount = subsData?.filter(s => s.status === 'active').length || 0;
      const totalRev = subsData?.reduce((sum, s) => sum + (s.status === 'active' ? Number(s.amount) : 0), 0) || 0;
      const uniqueUsers = new Set(subsData?.map(s => s.user_id)).size;

      setStats({
        totalRevenue: totalRev,
        activeSubscriptions: activeCount,
        totalUsers: uniqueUsers,
      });
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
      toast.error("Failed to load subscriptions");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async (subscriptionId: string) => {
    try {
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: "cancelled" })
        .eq("id", subscriptionId);

      if (error) throw error;

      toast.success("Subscription cancelled");
      fetchSubscriptions();
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      toast.error("Failed to cancel subscription");
    }
  };

  const filteredSubscriptions = subscriptions.filter((sub) =>
    sub.profiles?.email?.toLowerCase().includes(search.toLowerCase()) ||
    sub.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    sub.plan_id.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue (MRR)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R{stats.totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Monthly recurring revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground">Currently paying users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">With subscriptions</p>
          </CardContent>
        </Card>
      </div>

      {/* Subscriptions Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Subscriptions</CardTitle>
          <CardDescription>Manage user subscriptions and billing</CardDescription>
          <div className="pt-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email, name, or plan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredSubscriptions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No subscriptions found
              </p>
            ) : (
              filteredSubscriptions.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{sub.profiles?.email || "Unknown"}</p>
                      <Badge
                        variant={sub.status === "active" ? "default" : "secondary"}
                      >
                        {sub.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {sub.profiles?.full_name || "No name"}
                    </p>
                    <div className="flex gap-4 text-sm">
                      <span className="capitalize">{sub.plan_id} Plan</span>
                      <span>R{sub.amount}/month</span>
                      <span>Credits: {sub.credits - sub.credits_used}/{sub.credits}</span>
                      <span className="text-muted-foreground">
                        Renews: {new Date(sub.renew_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {sub.status === "active" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancelSubscription(sub.id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
