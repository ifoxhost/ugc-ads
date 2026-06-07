import { Link, useNavigate } from "react-router-dom";
import { useNotifications, type AppNotification } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, CheckCheck, Trash2, ExternalLink, Loader2, Settings } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function timeAgo(iso: string) {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); }
  catch { return ""; }
}

const TYPE_LABEL: Record<string, string> = {
  stitch_success: "Re-stitch · Success",
  stitch_fallback: "Re-stitch · Fallback",
  stitch_failed: "Re-stitch · Failed",
  info: "Update",
};

const TYPE_TONE: Record<string, string> = {
  stitch_success: "bg-primary/10 text-primary border-primary/20",
  stitch_fallback: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  stitch_failed: "bg-destructive/10 text-destructive border-destructive/20",
  info: "bg-muted text-muted-foreground border-border",
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { items, loading, unreadCount, markRead, markAllRead, remove, clearAll } = useNotifications(100);
  const [tab, setTab] = useState<"all" | "unread">("all");

  const visible = tab === "unread" ? items.filter((n) => !n.read_at) : items;

  const handleOpen = (n: AppNotification) => {
    if (!n.read_at) markRead(n.id);
    if (n.url) navigate(n.url);
  };

  return (
    <div className="container max-w-3xl py-8 px-4 sm:px-6">
      <header className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6" /> Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Updates about your videos, re-stitch results, and account events.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/account/notifications"><Settings className="h-4 w-4 mr-2" />Preferences</Link>
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <CheckCheck className="h-4 w-4 mr-2" />Mark all read
            </Button>
          )}
          {items.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />Clear all
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all notifications?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes every notification on your account. You can't undo this.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={clearAll}>Clear all</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "unread")}>
        <TabsList>
          <TabsTrigger value="all">All ({items.length})</TabsTrigger>
          <TabsTrigger value="unread">Unread ({unreadCount})</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
            </div>
          ) : visible.length === 0 ? (
            <div className="text-center py-16 border rounded-lg">
              <Bell className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                {tab === "unread" ? "Nothing unread." : "No notifications yet."}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {visible.map((n) => {
                const tone = TYPE_TONE[n.type] ?? TYPE_TONE.info;
                return (
                  <li
                    key={n.id}
                    className={`border rounded-lg p-4 transition-colors ${!n.read_at ? "bg-accent/30 border-primary/30" : "bg-card"}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant="outline" className={`text-[10px] ${tone}`}>
                            {TYPE_LABEL[n.type] ?? n.type}
                          </Badge>
                          {!n.read_at && <span className="text-[10px] uppercase font-bold text-primary">New</span>}
                          <span className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</span>
                        </div>
                        <p className="font-medium text-sm">{n.title}</p>
                        {n.body && <p className="text-sm text-muted-foreground mt-1">{n.body}</p>}
                        {n.metadata && Object.keys(n.metadata).length > 0 && (
                          <details className="mt-2">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                              Details
                            </summary>
                            <pre className="text-[10px] mt-1 p-2 bg-muted rounded overflow-auto max-h-40">
                              {JSON.stringify(n.metadata, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        {n.url && (
                          <Button size="sm" variant="ghost" onClick={() => handleOpen(n)}>
                            <ExternalLink className="h-3.5 w-3.5 mr-1" />Open
                          </Button>
                        )}
                        {!n.read_at && (
                          <Button size="sm" variant="ghost" onClick={() => markRead(n.id)}>
                            <Check className="h-3.5 w-3.5 mr-1" />Read
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => remove(n.id)}>
                          <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
