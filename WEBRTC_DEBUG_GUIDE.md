# WebRTC Connection Debugging Guide

## Quick Test Steps

1. **Open TWO browser tabs/windows** (or use incognito windows)
   - Tab 1: Patient/User A
   - Tab 2: Doctor/User B

2. **Both users open the video call dialog at roughly the SAME TIME**
   - Click "Start Call" or "Join Call" button
   - Dialog should open

3. **Check Browser Console (F12 → Console tab)**
   - Look for `[WebRTC]` logs
   - These show exactly what's happening

## Expected Connection Flow

### User A (Initiator) - who clicks "Start Call"
```
[WebRTC] Waiting for signaling channel to be ready...
[WebRTC] Signaling channel subscribed successfully
[WebRTC] Sending offer
[WebRTC] Connection state changed to: new
[WebRTC] Signaling state: have-local-offer
[WebRTC] ICE candidate: ...
[WebRTC] Received answer: ...
[WebRTC] Set remote answer successfully
[WebRTC] Connection state changed to: connecting
[WebRTC] Connection state changed to: connected ← VIDEO SHOULD APPEAR HERE
```

### User B (Receiver) - who opens dialog to answer
```
[WebRTC] Signaling channel subscribed successfully
[WebRTC] Received offer
[WebRTC] Creating new peer connection for offer
[WebRTC] Set remote description, ready to answer
[WebRTC] (User clicks "Answer Call" button)
[WebRTC] Sending answer
[WebRTC] Connection state changed to: new
[WebRTC] Connection state changed to: connecting
[WebRTC] Connection state changed to: connected ← VIDEO SHOULD APPEAR HERE
```

## What to Look For If It Fails

### Symptom: "Waiting for connection" forever
**Check:**
1. Are BOTH users' dialogs showing console logs? 
   - If only one shows logs → other user's dialog didn't open
2. Did the offer get sent? Look for `[WebRTC] Sending offer`
3. Did the receiver get the offer? Look for `[WebRTC] Received offer`

### Symptom: Offer sent but no answer received
**Check:**
1. Is there an "Answer Call" button visible on receiver's side?
2. Did they click it?
3. Does the console show `[WebRTC] Sending answer`?

### Symptom: Answer sent but connection never goes to "connected"
**Check:**
1. Connection state progression in console
   - Should go: new → connecting → connected
   - If it gets stuck on "connecting" → ICE candidate issue
2. Look for any errors about ICE candidates
3. Check if both sides are in the right signaling state

## Critical Requirements

✅ **Both users must have cameras/mics allowed**
- If you see "permission denied" error → allow camera/mic in browser settings

✅ **Both users must be in the SAME appointment**
- Signaling channel name is: `video-call-{appointmentId}`
- If different appointmentIds → won't connect

✅ **Call must be within time window**
- 30 minutes BEFORE appointment to 1 hour AFTER
- Outside this window → call button won't be visible

✅ **Status must be "approved"**
- Only approved appointments can have video calls

## Copy/Paste This to Check Channel Name

In browser console, run:
```javascript
console.log('Appointment ID from URL or state')
// Should be something like: 123e4567-e89b-12d3-a456-426614174000
```

Both users should have the SAME appointment ID.

## If Still Not Working

1. **Refresh both pages** completely (Ctrl+F5)
2. **Open both browser developer tools** (F12)
3. **Clear console** (circle with slash icon)
4. **Open video dialogs on BOTH at the same time**
5. **One clicks "Start Call"** and **other clicks "Answer Call"** 
6. **Share the FULL console output** from both tabs

The logs will show exactly where the connection is failing.

---

## Technical Details

### Signaling Channel Status
- `SUBSCRIBED` = Channel is ready to send/receive messages
- `CHANNEL_ERROR` = Connection to Supabase failed
- `CLOSED` = Channel was closed

### Connection States
- `new` = Just created
- `connecting` = Gathering ICE candidates and trying to establish
- `connected` = Ready to send/receive media
- `failed` = Tried but couldn't establish
- `disconnected` = Was connected but lost connection

### Signaling States
- `stable` = No active offer/answer exchange
- `have-local-offer` = Sent offer, waiting for answer
- `have-remote-offer` = Received offer, need to answer
- `closed` = Connection closed

## Network Requirements

Your network must allow:
- **STUN servers** (for NAT traversal)
  - `stun.l.google.com:19302`
  - `stun1.l.google.com:19302`
- **UDP traffic** on STUN ports (for ICE candidates)
- **Supabase WebSocket** connection

If you're behind a strict firewall, STUN might not work. That's a networking issue, not code issue.
