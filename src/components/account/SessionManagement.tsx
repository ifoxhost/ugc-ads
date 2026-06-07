import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Monitor, 
  Smartphone, 
  Tablet, 
  Globe, 
  Loader2, 
  LogOut, 
  Clock,
  MapPin,
  Shield,
  AlertTriangle
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface UserSession {
  id: string;
  session_token: string;
  device_info: string | null;
  browser: string | null;
  os: string | null;
  ip_address: string | null;
  location: string | null;
  is_current: boolean;
  last_active_at: string;
  created_at: string;
  expires_at: string | null;
}

interface SessionManagementProps {
  refreshKey?: number;
}

const SessionManagement = ({ refreshKey = 0 }: SessionManagementProps) => {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, [refreshKey]);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("user_sessions")
        .select("*")
        .order("last_active_at", { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      toast({
        title: "Error",
        description: "Failed to load sessions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const revokeSession = async (sessionId: string, isCurrent: boolean) => {
    try {
      setRevokingId(sessionId);

      const { error } = await supabase
        .from("user_sessions")
        .delete()
        .eq("id", sessionId);

      if (error) throw error;

      setSessions(sessions.filter(s => s.id !== sessionId));

      toast({
        title: "Session revoked",
        description: isCurrent 
          ? "You will be logged out shortly" 
          : "The session has been revoked successfully",
      });

      // If revoking current session, sign out
      if (isCurrent) {
        setTimeout(() => {
          supabase.auth.signOut();
        }, 1500);
      }
    } catch (error) {
      console.error("Error revoking session:", error);
      toast({
        title: "Error",
        description: "Failed to revoke session",
        variant: "destructive",
      });
    } finally {
      setRevokingId(null);
    }
  };

  const revokeAllOtherSessions = async () => {
    try {
      setRevokingAll(true);

      const otherSessions = sessions.filter(s => !s.is_current);
      
      for (const session of otherSessions) {
        await supabase
          .from("user_sessions")
          .delete()
          .eq("id", session.id);
      }

      setSessions(sessions.filter(s => s.is_current));

      toast({
        title: "Sessions revoked",
        description: `${otherSessions.length} session(s) have been revoked`,
      });
    } catch (error) {
      console.error("Error revoking sessions:", error);
      toast({
        title: "Error",
        description: "Failed to revoke some sessions",
        variant: "destructive",
      });
    } finally {
      setRevokingAll(false);
    }
  };

  const getDeviceIcon = (deviceInfo: string | null, os: string | null) => {
    const info = (deviceInfo || os || "").toLowerCase();
    if (info.includes("mobile") || info.includes("android") || info.includes("iphone")) {
      return <Smartphone className="h-5 w-5" />;
    }
    if (info.includes("tablet") || info.includes("ipad")) {
      return <Tablet className="h-5 w-5" />;
    }
    return <Monitor className="h-5 w-5" />;
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const otherSessionsCount = sessions.filter(s => !s.is_current).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Active Sessions
            </CardTitle>
            <CardDescription>
              Manage devices where you're currently logged in
            </CardDescription>
          </div>
          {otherSessionsCount > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={revokingAll}>
                  {revokingAll ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <LogOut className="h-4 w-4 mr-2" />
                  )}
                  Revoke All Other Sessions
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Revoke all other sessions?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will log you out of {otherSessionsCount} other device{otherSessionsCount > 1 ? "s" : ""}. 
                    Your current session will remain active.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={revokeAllOtherSessions}>
                    Revoke All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {sessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No active sessions found</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={`flex items-center justify-between p-4 border rounded-lg ${
                session.is_current ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-2 rounded-lg ${session.is_current ? "bg-primary/10 text-primary" : "bg-muted"}`}>
                  {getDeviceIcon(session.device_info, session.os)}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">
                      {session.browser || "Unknown Browser"}
                      {session.os && ` on ${session.os}`}
                    </p>
                    {session.is_current && (
                      <Badge variant="default" className="text-xs">
                        Current
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {session.ip_address && (
                      <span className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {session.ip_address}
                      </span>
                    )}
                    {session.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {session.location}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Last active: {formatTimeAgo(session.last_active_at)}
                  </p>
                </div>
              </div>
              <div>
                {session.is_current ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        disabled={revokingId === session.id}
                      >
                        {revokingId === session.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <LogOut className="h-4 w-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                          Sign out of current session?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This will log you out immediately. You'll need to sign in again.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => revokeSession(session.id, true)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Sign Out
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => revokeSession(session.id, false)}
                    disabled={revokingId === session.id}
                  >
                    {revokingId === session.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <LogOut className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default SessionManagement;
