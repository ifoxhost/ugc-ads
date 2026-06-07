import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Video, Image } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const DashboardStats = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalVideos: 0,
    totalImages: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const [usersResult, videosResult, imagesResult] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("video_generations").select("*", { count: "exact", head: true }),
        supabase.from("image_generations").select("*", { count: "exact", head: true }),
      ]);

      setStats({
        totalUsers: usersResult.count || 0,
        totalVideos: videosResult.count || 0,
        totalImages: imagesResult.count || 0,
      });
    };

    fetchStats();
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalUsers}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Video Generations</CardTitle>
          <Video className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalVideos}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Image Generations</CardTitle>
          <Image className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalImages}</div>
        </CardContent>
      </Card>
    </div>
  );
};