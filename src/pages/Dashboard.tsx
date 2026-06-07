import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Video, ImageIcon, TrendingUp, Clock, Zap, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { format } from "date-fns";
import { WeeklyActivityWidget } from "@/components/dashboard/WeeklyActivityWidget";
import { NewUserOnboarding } from "@/components/dashboard/NewUserOnboarding";
import { AdThumbnail } from "@/components/dashboard/AdThumbnail";
import { VideoPlayerModal } from "@/components/dashboard/VideoPlayerModal";
interface GeneratedAd {
  id: string;
  created_at: string;
  status: string;
  style_template: string;
  generated_image_url: string | null;
  generated_video_url: string | null;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { hasActiveSubscription, loading: subscriptionLoading } = useSubscription();
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [stats, setStats] = useState({
    totalImageAds: 0,
    totalVideoAds: 0,
    creditsRemaining: 0,
  });
  const [recentAds, setRecentAds] = useState<GeneratedAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Defer real-time subscriptions until after initial load
  useEffect(() => {
    if (loading) return;

    const adsChannel = supabase
      .channel('ads-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'generated_ads' }, loadDashboardData)
      .subscribe();

    const subscriptionChannel = supabase
      .channel('subscription-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, loadDashboardData)
      .subscribe();

    return () => {
      supabase.removeChannel(adsChannel);
      supabase.removeChannel(subscriptionChannel);
    };
  }, [loading]);

  const loadDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }
      setUser(user);

      // Parallelize all queries for faster loading
      const [
        subData,
        imageAdsResult,
        videoAdsResult,
        recentAdsResult
      ] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("plan_id, status, credits, credits_used")
          .eq("user_id", user.id)
          .eq("status", "active")
          .maybeSingle(),
        supabase
          .from("generated_ads")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .not("generated_image_url", "is", null)
          .is("deleted_at", null),
        supabase
          .from("generated_ads")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .not("generated_video_url", "is", null)
          .is("deleted_at", null),
        supabase
          .from("generated_ads")
          .select("id, created_at, status, style_template, generated_image_url, generated_video_url")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(5)
      ]);

      const creditsRemaining = subData.data 
        ? (subData.data.credits || 0) - (subData.data.credits_used || 0)
        : 0;

      if (subData.data) {
        setSubscriptionData(subData.data);
      }

      setStats({
        totalImageAds: imageAdsResult.count || 0,
        totalVideoAds: videoAdsResult.count || 0,
        creditsRemaining,
      });

      const ads = recentAdsResult.data || [];
      setRecentAds(ads);

      // Check if this is a new user (no ads created yet)
      const totalAds = (imageAdsResult.count || 0) + (videoAdsResult.count || 0);
      const hasSeenOnboarding = localStorage.getItem(`onboarding_dismissed_${user.id}`);
      if (totalAds === 0 && !hasSeenOnboarding) {
        setIsNewUser(true);
        setShowOnboarding(true);
      }
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismissOnboarding = () => {
    setShowOnboarding(false);
    if (user) {
      localStorage.setItem(`onboarding_dismissed_${user.id}`, "true");
    }
  };

  const handleAdClick = (ad: GeneratedAd) => {
    if (ad.generated_video_url && ad.status === 'completed') {
      setSelectedVideo({
        url: ad.generated_video_url,
        title: `${ad.style_template} Video Ad`,
      });
      setVideoModalOpen(true);
    } else {
      navigate("/library");
    }
  };

  const getAdType = (ad: GeneratedAd): 'video' | 'image' => {
    return ad.generated_video_url ? 'video' : 'image';
  };


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'processing':
        return 'secondary';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  if (loading || subscriptionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 sm:px-6 py-20 sm:py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-tight text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {user?.email?.split('@')[0]}</p>
        </div>

        {/* New User Onboarding */}
        {showOnboarding && (
          <div className="mb-8">
            <NewUserOnboarding onDismiss={handleDismissOnboarding} />
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card 
            className="border-border hover:border-primary/50 transition-colors cursor-pointer" 
            onClick={() => navigate("/library")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AI Music Videos</CardTitle>
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalImageAds}</div>
              <p className="text-xs text-muted-foreground">Lyric videos generated</p>
            </CardContent>
          </Card>

          <Card 
            className="border-border hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => navigate("/library")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Videos This Month</CardTitle>
              <Video className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalVideoAds}</div>
              <p className="text-xs text-muted-foreground">Rendered this billing period</p>
            </CardContent>
          </Card>

          <Card 
            className="border-border hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => navigate("/pricing")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Credits Left</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.creditsRemaining}</div>
              <p className="text-xs text-muted-foreground">Available generation credits</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Action - Create AI Music Video */}
        <div className="mb-8">
          <Card 
            className="border-border hover:border-primary/50 transition-colors cursor-pointer group bg-gradient-to-br from-primary/5 to-primary/10" 
            onClick={() => navigate("/create")}
          >
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
                  <Sparkles className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl">Create AI Music Video</CardTitle>
                  <CardDescription>Generate a stunning AI music video from your song</CardDescription>
                </div>
                <Button className="group-hover:bg-primary/90">
                  Get Started <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Weekly Activity Widget */}
        <div className="mb-8">
          <WeeklyActivityWidget />
        </div>

        {/* Recent Videos */}
        <Card className="border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent AI Music Videos</CardTitle>
                <CardDescription>Your latest generated videos</CardDescription>
              </div>
              <Button variant="outline" onClick={() => navigate("/library")}>
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentAds.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No videos created yet. Start generating!</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => navigate("/create")}
                >
                  Create Your First Video
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {recentAds.map((ad) => (
                  <div
                    key={ad.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer"
                    onClick={() => handleAdClick(ad)}
                  >
                    <div className="flex items-center gap-4">
                      <AdThumbnail
                        imageUrl={ad.generated_image_url}
                        videoUrl={ad.generated_video_url}
                        status={ad.status}
                        styleTemplate={ad.style_template}
                      />
                      <div>
                    <p className="font-medium capitalize">
                          AI Music Video • {ad.style_template}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(new Date(ad.created_at), "MMM dd, yyyy 'at' HH:mm")}
                        </div>
                      </div>
                    </div>
                    <Badge variant={getStatusColor(ad.status)}>
                      {ad.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subscription Info */}
        {subscriptionData && (
          <Card className="border-border mt-8">
            <CardHeader>
              <CardTitle>Subscription Details</CardTitle>
              <CardDescription>Your current plan and usage</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Plan</p>
                  <p className="text-xl font-semibold capitalize">{subscriptionData.plan_id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Status</p>
                  <Badge variant={subscriptionData.status === 'active' ? 'default' : 'secondary'}>
                    {subscriptionData.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Credits Remaining</p>
                  <p className="text-xl font-semibold">{stats.creditsRemaining}</p>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full md:w-auto mt-6"
                onClick={() => navigate("/pricing")}
              >
                Manage Subscription
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Video Player Modal */}
      <VideoPlayerModal
        isOpen={videoModalOpen}
        onClose={() => {
          setVideoModalOpen(false);
          setSelectedVideo(null);
        }}
        videoUrl={selectedVideo?.url || null}
        title={selectedVideo?.title}
      />
    </div>
  );
};

export default Dashboard;
