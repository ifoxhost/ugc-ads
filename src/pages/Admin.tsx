import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserRole } from "@/hooks/useUserRole";
import { UsersManagement } from "@/components/admin/UsersManagement";
import { VideoGenerationsManagement } from "@/components/admin/VideoGenerationsManagement";
import { ImageGenerationsManagement } from "@/components/admin/ImageGenerationsManagement";
import { DashboardStats } from "@/components/admin/DashboardStats";
import { SubscriptionsManagement } from "@/components/admin/SubscriptionsManagement";
import { UpcomingRenewalsWidget } from "@/components/admin/UpcomingRenewalsWidget";
import { AppSettingsManagement } from "@/components/admin/AppSettingsManagement";

const Admin = () => {
  const { isAdmin, loading } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate("/");
    }
  }, [isAdmin, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background px-6 py-20">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-10 h-10 text-primary" />
          <div>
            <h1 className="text-4xl font-tight text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage all platform functionality</p>
          </div>
        </div>

        {/* Stats Overview */}
        <DashboardStats />

        {/* Upcoming Renewals Widget */}
        <div className="mt-6">
          <UpcomingRenewalsWidget />
        </div>

        {/* Management Tabs */}
        <Tabs defaultValue="subscriptions" className="mt-8">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="videos">Videos</TabsTrigger>
            <TabsTrigger value="images">Images</TabsTrigger>
          </TabsList>

          <TabsContent value="subscriptions">
            <SubscriptionsManagement />
          </TabsContent>

          <TabsContent value="users">
            <UsersManagement />
          </TabsContent>

          <TabsContent value="videos">
            <VideoGenerationsManagement />
          </TabsContent>

          <TabsContent value="images">
            <ImageGenerationsManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;