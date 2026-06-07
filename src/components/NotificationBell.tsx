import { Link, useNavigate } from "react-router-dom";
import { Bell, Check, X, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications, type AppNotification } from "@/hooks/useNotifications";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

const TYPE_ACCENT: Record<string, string> = {
  stitch_success: "bg-primary",
  stitch_fallback: "bg-amber-500",
  stitch_failed: "bg-destructive",
  info: "bg-muted-foreground",
};

function timeAgo(iso: string) {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); }
  catch { return ""; }
}

export default function NotificationBell({ variant = "light" }: { variant?: "light" | "dark" }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { items, unreadCount, markRead, markAllRead, remove } = useNotifications(15);
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const handleOpen = (n: AppNotification) => {
    if (!n.read_at) markRead(n.id);
    setOpen(false);
    if (n.url) navigate(n.url);
  };

  const triggerColor = variant === "dark"
    ? "text-white/80 hover:text-white hover:bg-white/10"
    : "text-foreground hover:bg-accent";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`relative rounded-full h-9 w-9 ${triggerColor}`}
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px] font-bold rounded-full flex items-center justify-center"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => markAllRead()} className="h-7 text-xs">
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              You're all caught up.
            </p>
          ) : (
            <ul className="divide-y">
              {items.slice(0, 8).map((n) => (
                <li key={n.id} className={`group relative ${!n.read_at ? "bg-accent/40" : ""}`}>
                  <button
                    type="button"
                    onClick={() => handleOpen(n)}
                    className="w-full text-left p-3 pr-9 hover:bg-accent transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${TYPE_ACCENT[n.type] ?? "bg-muted-foreground"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{n.title}</p>
                        {n.body && <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>}
                        <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.created_at)}</p>
                      </div>
                    </div>
                  </button>
                  <div className="absolute top-2 right-1 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!n.read_at && (
                      <button
                        onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                        title="Mark read"
                        className="p-1 rounded hover:bg-background"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); remove(n.id); }}
                      title="Dismiss"
                      className="p-1 rounded hover:bg-background"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <div className="border-t p-2">
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block text-center text-xs font-medium text-primary hover:underline py-1"
          >
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
