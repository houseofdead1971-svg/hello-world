# Supabase WebSocket Connection Troubleshooting

## Issue
Firefox shows error: `Firefox can't establish a connection to the server at wss://wvhlrmsugmcdhsaltygg.supabase.co/realtime/v1/websocket`

## Solutions Applied

### 1. **Enhanced Supabase Client Configuration**
- Added Realtime configuration to `src/integrations/supabase/client.ts`
- Set event rate limiting to 10 events/second
- Added client info header for debugging

### 2. **Graceful Error Handling in Components**
Updated all Realtime subscriptions to:
- Wrap subscriptions in try-catch blocks
- Check subscription status for CHANNEL_ERROR and CLOSED states
- Log warnings instead of crashing
- Continue app functionality even if Realtime fails

**Files Updated:**
- `src/components/dashboard/ProfileDropdown.tsx`
- `src/components/dashboard/PatientAppointments.tsx`

### 3. **New Realtime Manager Utility**
Created `src/lib/realtime-manager.ts` with:
- Automatic fallback from WebSocket to polling
- Graceful error recovery
- Cleanup utilities for subscriptions
- Status checking methods

## How to Fix WebSocket Connection Issues

### For Users:
1. **Check Browser Console** - Look for WebSocket connection errors
2. **Clear Browser Cache** - Cache may contain stale connection info
3. **Check Network** - Ensure WebSockets aren't blocked by firewall/proxy
4. **Disable VPN/Proxy** - Some VPNs block WebSocket connections
5. **Try Different Browser** - Test in Chrome/Safari if Firefox fails

### For Development:

#### Option A: Disable Realtime (Temporary)
```typescript
// In src/integrations/supabase/client.ts
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { /* ... */ },
  realtime: {
    enabled: false, // Disable WebSocket
  }
});
```

#### Option B: Use Custom Polling Interval
```typescript
// In component
useEffect(() => {
  const pollInterval = setInterval(() => {
    fetchData(); // Poll every 30 seconds instead of real-time
  }, 30000);
  
  return () => clearInterval(pollInterval);
}, []);
```

#### Option C: Check Supabase Project Status
1. Go to Supabase Dashboard
2. Check Project Status
3. Verify API is online
4. Check for ongoing maintenance

### Network Debugging:

```bash
# Test WebSocket connectivity
curl -i -N -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  "wss://wvhlrmsugmcdhsaltygg.supabase.co/realtime/v1/websocket?apikey=YOUR_KEY"
```

## What's Now Working:
✅ App loads even if WebSocket fails
✅ Automatic fallback to polling
✅ No more complete app crashes
✅ Clear error logging in console
✅ Graceful degradation of real-time features

## Next Steps:
- Monitor browser console for persistent WebSocket errors
- Implement automatic retry logic if needed
- Consider using Supabase Functions instead of Realtime for real-time updates
- Set up Sentry or similar for error tracking
