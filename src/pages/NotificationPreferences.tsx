import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bell, Trash2, CalendarDays, Sparkles, Mail, Smartphone, Loader2, Video, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { usePushNotifications } from "@/hooks/usePushNotifications";

interface NotificationPrefs {
  trash_expiry_notifications: boolean;
  weekly_digest: boolean;
  feature_announcements: boolean;
  marketing_emails: boolean;
  video_status_emails: boolean;
  subscription_expiry_notifications: boolean;
}

const NotificationPreferences = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPrefs>({
    trash_expiry_notifications: true,
    weekly_digest: true,
    feature_announcements: true,
    marketing_emails: false,
    video_status_emails: true,
    subscription_expiry_notifications: true,
  });
  const [user, setUser] = useState<any>(null);
  
  // Push notification hook
  const { 
    isSupported: pushSupported, 
    isSubscribed: pushSubscribed, 
    isLoading: pushLoading,
    permission: pushPermission,
    toggleSubscription: togglePush
  } = usePushNotifications();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }
      setUser(user);
      await loadPreferences(user.id);
    };
    checkAuth();
  }, [navigate]);

  const loadPreferences = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPreferences({
          trash_expiry_notifications: data.trash_expiry_notifications,
          weekly_digest: data.weekly_digest,
          feature_announcements: data.feature_announcements,
          marketing_emails: data.marketing_emails,
          video_status_emails: data.video_status_emails ?? true,
          subscription_expiry_notifications: data.subscription_expiry_notifications ?? true,
        });
      }
    } catch (error) {
      console.error("Error loading preferences:", error);
      toast.error("Failed to load notification preferences");
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = (key: keyof NotificationPrefs, value: boolean) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const savePreferences = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("notification_preferences")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("notification_preferences")
          .update(preferences)
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("notification_preferences")
          .insert({
            user_id: user.id,
            ...preferences,
          });

        if (error) throw error;
      }

      toast.success("Notification preferences saved");
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <Button
          variant="ghost"
          onClick={() => navigate("/account")}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Account
        </Button>

        <div className="flex items-center gap-3 mb-8">
          <Bell className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Notification Preferences</h1>
            <p className="text-muted-foreground">
              Manage how and when you receive notifications
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Push Notifications */}
          {pushSupported && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Push Notifications</CardTitle>
                <CardDescription>
                  Get instant browser notifications when your videos are ready
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <Smartphone className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="space-y-1">
                      <Label htmlFor="push-notifications" className="font-medium">
                        Browser Push Notifications
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {pushPermission === 'denied' 
                          ? 'Notifications are blocked. Please enable them in your browser settings.'
                          : 'Receive instant notifications when your video ads finish processing'
                        }
                      </p>
                    </div>
                  </div>
                  {pushLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <Switch
                      id="push-notifications"
                      checked={pushSubscribed}
                      onCheckedChange={togglePush}
                      disabled={pushPermission === 'denied'}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Account Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Email Notifications</CardTitle>
              <CardDescription>
                Important updates about your account and content
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <Trash2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="space-y-1">
                    <Label htmlFor="trash-expiry" className="font-medium">
                      Trash Expiry Reminders
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified 2 days before your deleted ads are permanently removed
                    </p>
                  </div>
                </div>
                <Switch
                  id="trash-expiry"
                  checked={preferences.trash_expiry_notifications}
                  onCheckedChange={(checked) => updatePreference("trash_expiry_notifications", checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <Video className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="space-y-1">
                    <Label htmlFor="video-status" className="font-medium">
                      Video Generation Status
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when your video ads finish processing or fail
                    </p>
                  </div>
                </div>
                <Switch
                  id="video-status"
                  checked={preferences.video_status_emails}
                  onCheckedChange={(checked) => updatePreference("video_status_emails", checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="space-y-1">
                    <Label htmlFor="subscription-expiry" className="font-medium">
                      Subscription Renewal Reminders
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified 7 days before your subscription renews
                    </p>
                  </div>
                </div>
                <Switch
                  id="subscription-expiry"
                  checked={preferences.subscription_expiry_notifications}
                  onCheckedChange={(checked) => updatePreference("subscription_expiry_notifications", checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <CalendarDays className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="space-y-1">
                    <Label htmlFor="weekly-digest" className="font-medium">
                      Weekly Digest
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Receive a weekly summary of your activity and generation stats
                    </p>
                  </div>
                </div>
                <Switch
                  id="weekly-digest"
                  checked={preferences.weekly_digest}
                  onCheckedChange={(checked) => updatePreference("weekly_digest", checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Product Updates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Product Updates</CardTitle>
              <CardDescription>
                Stay informed about new features and improvements
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="space-y-1">
                    <Label htmlFor="feature-announcements" className="font-medium">
                      Feature Announcements
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Be the first to know about new features and improvements
                    </p>
                  </div>
                </div>
                <Switch
                  id="feature-announcements"
                  checked={preferences.feature_announcements}
                  onCheckedChange={(checked) => updatePreference("feature_announcements", checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="space-y-1">
                    <Label htmlFor="marketing-emails" className="font-medium">
                      Marketing Emails
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Tips, tutorials, and promotional offers
                    </p>
                  </div>
                </div>
                <Switch
                  id="marketing-emails"
                  checked={preferences.marketing_emails}
                  onCheckedChange={(checked) => updatePreference("marketing_emails", checked)}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={savePreferences} disabled={saving} size="lg">
              {saving ? "Saving..." : "Save Preferences"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationPreferences;
