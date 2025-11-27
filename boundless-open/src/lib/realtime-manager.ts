import { supabase } from '@/integrations/supabase/client';

/**
 * Safe Realtime subscription wrapper with error handling and graceful fallback
 * Uses polling if WebSocket fails instead of completely breaking the app
 */
export class RealtimeSubscriptionManager {
  private subscriptions = new Map();
  private pollingIntervals = new Map();
  private isRealtimeAvailable = true;

  /**
   * Subscribe to realtime changes with fallback to polling
   */
  subscribe(
    channelName: string,
    table: string,
    userId: string,
    onUpdate: (payload: any) => void,
    onError?: (error: Error) => void
  ) {
    try {
      if (!this.isRealtimeAvailable) {
        this.setupPolling(channelName, table, userId, onUpdate, onError);
        return;
      }

      const channel = supabase
        .channel(channelName, {
          config: {
            broadcast: { self: false },
          },
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: table,
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            try {
              onUpdate(payload);
            } catch (error) {
              console.error('Error in realtime callback:', error);
              onError?.(error instanceof Error ? error : new Error(String(error)));
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`Subscribed to ${channelName}`);
          } else if (status === 'CHANNEL_ERROR') {
            console.warn(`Channel error for ${channelName}, falling back to polling`);
            this.isRealtimeAvailable = false;
            supabase.removeChannel(channel);
            this.setupPolling(channelName, table, userId, onUpdate, onError);
          }
        });

      this.subscriptions.set(channelName, channel);
    } catch (error) {
      console.error('Realtime subscription error:', error);
      this.isRealtimeAvailable = false;
      this.setupPolling(channelName, table, userId, onUpdate, onError);
    }
  }

  /**
   * Fallback polling mechanism when Realtime is unavailable
   */
  private setupPolling(
    channelName: string,
    table: string,
    userId: string,
    onUpdate: (payload: any) => void,
    onError?: (error: Error) => void,
    intervalMs = 5000
  ) {
    // Clear existing polling interval
    if (this.pollingIntervals.has(channelName)) {
      clearInterval(this.pollingIntervals.get(channelName));
    }

    // Set up polling
    const interval = setInterval(async () => {
      try {
        const client: any = supabase;
        const { data, error } = await client
          .from(table)
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        onUpdate({
          eventType: 'POLLING',
          new: data,
          old: null,
          schema: 'public',
          table: table,
        });
      } catch (error) {
        console.error('Polling error:', error);
        onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    }, intervalMs);

    this.pollingIntervals.set(channelName, interval);
    console.log(`Set up polling for ${channelName} every ${intervalMs}ms`);
  }

  /**
   * Remove subscription and clean up
   */
  unsubscribe(channelName: string) {
    const channel = this.subscriptions.get(channelName);
    if (channel) {
      supabase.removeChannel(channel);
      this.subscriptions.delete(channelName);
    }

    if (this.pollingIntervals.has(channelName)) {
      clearInterval(this.pollingIntervals.get(channelName));
      this.pollingIntervals.delete(channelName);
    }
  }

  /**
   * Clean up all subscriptions
   */
  cleanup() {
    for (const [name] of this.subscriptions) {
      this.unsubscribe(name);
    }
  }

  /**
   * Check if realtime is available
   */
  isAvailable() {
    return this.isRealtimeAvailable;
  }
}

export const realtimeManager = new RealtimeSubscriptionManager();
