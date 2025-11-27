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

  const markAsRead = async (id: string, link?: string | null) => {
    try {
      const { error } = await (supabase as any).from("notifications").update({ read: true }).eq("id", id);
      if (error) throw error;
      setNotifications((prev) => prev.map((p) => (p.id === id ? { ...p, read: true } : p)));
      
      // Navigate to link if provided, with fallback for invalid routes
      if (link) {
        // Fix old notification links
        const validLink = link.replace('/dashboard/appointments', '/dashboard');
        navigate(validLink);
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

      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-auto">
        <DropdownMenuLabel>
          <div className="flex items-center justify-between">
            <span className="font-medium">Notifications</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={markAllRead}>
                <Check className="h-4 w-4 mr-2" />
                Mark all read
              </Button>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No notifications</div>
        ) : (
          notifications.map((n) => (
            <DropdownMenuItem key={n.id} onClick={() => markAsRead(n.id, n.link)} className={`flex flex-col items-start gap-1 hover:bg-accent hover:text-accent-foreground ${n.read ? 'opacity-60' : ''}`}>
              <div className="flex items-center justify-between w-full">
                <div className="text-sm font-medium">{n.title}</div>
                <div className="text-xs">{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</div>
              </div>
              <div className="text-xs max-w-full truncate">{n.message}</div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default Notifications;
