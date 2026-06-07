import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Video, ImageIcon, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface WeeklyStats {
  imageAds: number;
  videoAds: number;
  total: number;
}

export const WeeklyActivityWidget = () => {
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>({
    imageAds: 0,
    videoAds: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWeeklyStats();

    // Set up real-time subscription for generated_ads
    const channel = supabase
      .channel('weekly-ads-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'generated_ads' }, loadWeeklyStats)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadWeeklyStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const weekStart = oneWeekAgo.toISOString();

      const [imageAdsResult, videoAdsResult] = await Promise.all([
        supabase
          .from("generated_ads")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("created_at", weekStart)
          .not("generated_image_url", "is", null)
          .is("deleted_at", null),
        supabase
          .from("generated_ads")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("created_at", weekStart)
          .not("generated_video_url", "is", null)
          .is("deleted_at", null),
      ]);

      const imageAds = imageAdsResult.count || 0;
      const videoAds = videoAdsResult.count || 0;

      setWeeklyStats({
        imageAds,
        videoAds,
        total: imageAds + videoAds,
      });
    } catch (error) {
      console.error("Error loading weekly stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const getWeekRange = () => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const formatDate = (date: Date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${formatDate(oneWeekAgo)} - ${formatDate(now)}`;
  };

  const activityItems = [
    { label: "Image Ads", count: weeklyStats.imageAds, icon: ImageIcon, color: "text-blue-500", bgColor: "bg-blue-500/20" },
    { label: "Video Ads", count: weeklyStats.videoAds, icon: Video, color: "text-orange-500", bgColor: "bg-orange-500/20" },
  ];

  const maxCount = Math.max(...activityItems.map(item => item.count), 1);

  if (loading) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            This Week's Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 animate-pulse">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              This Week's Activity
            </CardTitle>
            <CardDescription>{getWeekRange()}</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-primary">{weeklyStats.total}</p>
            <p className="text-xs text-muted-foreground">ads created</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {weeklyStats.total === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No ads created this week yet.</p>
            <p className="text-xs">Start generating to see your progress!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activityItems.map((item) => (
              <div key={item.label} className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full ${item.bgColor} flex items-center justify-center flex-shrink-0`}>
                  <item.icon className={`h-5 w-5 ${item.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{item.label}</span>
                    <span className="text-sm font-bold">{item.count}</span>
                  </div>
                  <Progress 
                    value={(item.count / maxCount) * 100} 
                    className="h-2"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
