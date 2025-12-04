import { useEffect, useState } from "react";
import { Bell, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";

interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type?: string;
  read?: boolean;
  link?: string | null;
  created_at?: string;
}

export const Notifications = ({ userId }: { userId: string }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!userId) return;
    let mounted = true;

    const fetchNotifications = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("notifications")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;
        if (mounted) setNotifications((data as any[]) || []);
      } catch (err) {
        console.error("Error loading notifications:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchNotifications();

    // Realtime subscription for notifications with polling fallback
    try {
      let pollingInterval: number | undefined;

      const channel = supabase
        .channel(`notifications-user-${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          (payload) => {
            console.log('Notification received via realtime:', payload);
            // Refresh list
            fetchNotifications();
            // Show toast for new notifications
            try {
              if (payload.eventType === "INSERT" && payload.new && !payload.new.read) {
                toast.info(payload.new.title || "New notification");
              }
            } catch (e) {
              console.error('Error processing notification payload:', e);
            }
          }
        )
        .subscribe((status) => {
          // status values: 'SUBSCRIBED', 'CHANNEL_ERROR', 'CLOSED', etc.
          if (status === "SUBSCRIBED") {
            // If previously polling, stop it
            if (pollingInterval) {
              clearInterval(pollingInterval);
              pollingInterval = undefined;
            }
            console.log("Realtime notifications subscribed");
          } else if (status === "CHANNEL_ERROR" || status === "CLOSED") {
            console.warn("Realtime subscription unavailable for notifications, falling back to polling");
            // Start polling every 5s
            if (!pollingInterval) {
              pollingInterval = window.setInterval(() => {
                fetchNotifications();
              }, 5000) as unknown as number;
            }
          }
        });

      return () => {
        mounted = false;
        try {
          supabase.removeChannel(channel);
        } catch (e) {
          // ignore
        }
        // clear polling if present
        try {
          if (typeof pollingInterval !== 'undefined') clearInterval(pollingInterval as number);
        } catch (e) {}
      };
    } catch (error) {
      console.error("Failed to set up realtime subscription for notifications:", error);
      // fallback: start simple polling
      const fallbackInterval = window.setInterval(() => fetchNotifications(), 5000) as unknown as number;
      return () => {
        mounted = false;
        try { clearInterval(fallbackInterval as number); } catch (e) {}
      };
    }
  }, [userId]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (id: string, link?: string | null, event?: React.MouseEvent) => {
    // Prevent default dropdown menu behavior
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    try {
      const { error } = await (supabase as any).from("notifications").update({ read: true }).eq("id", id);
      if (error) throw error;
      setNotifications((prev) => prev.map((p) => (p.id === id ? { ...p, read: true } : p)));
      
      // Navigate to link if provided, with fallback for invalid routes
      if (link) {
        // Fix old notification links
        const validLink = link.replace('/dashboard/appointments', '/dashboard');
        // Navigate to the link (remove trailing slash for comparison)
        const currentPath = window.location.pathname.replace(/\/$/, '');
        const targetPath = validLink.replace(/\/$/, '');
        
        // Only navigate if on a different page
        if (currentPath !== targetPath) {
          navigate(validLink, { replace: false });
        }
        // If already on the same page, just mark as read (no reload needed)
      }
    } catch (err) {
      console.error("Error marking notification as read:", err);
      toast.error("Failed to mark notification read");
    }
  };

  const markAllRead = async () => {
    try {
      const { error } = await (supabase as any).from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
      if (error) throw error;
      setNotifications((prev) => prev.map((p) => ({ ...p, read: true })));
      toast.success("All notifications marked read");
    } catch (err) {
      console.error("Error marking all notifications read:", err);
      toast.error("Failed to mark all read");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-medium leading-none text-white bg-destructive rounded-full">{unreadCount}</span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[calc(100vw-32px)] sm:w-96 max-h-[500px] overflow-y-auto p-0">
        <div className="sticky top-0 bg-background border-b border-border/50 p-3 z-10">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-sm">Notifications</span>
            <Button size="sm" variant="ghost" onClick={markAllRead} className="h-7 px-2 text-xs flex-shrink-0">
              <Check className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Mark all read</span>
              <span className="sm:hidden">Mark all</span>
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="p-4 text-sm text-muted-foreground text-center">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground text-center">No notifications</div>
        ) : (
          <div className="divide-y divide-border/30">
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={(e) => markAsRead(n.id, n.link, e as React.MouseEvent)}
                className={`w-full px-3 py-2.5 text-left hover:bg-accent/50 transition-colors ${n.read ? 'opacity-60' : 'font-medium'}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{n.title}</div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.message}</div>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0 sm:ml-2 mt-1 sm:mt-0">
                    {n.created_at ? new Date(n.created_at).toLocaleString('en-US', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default Notifications;
