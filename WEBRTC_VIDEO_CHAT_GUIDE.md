# WebRTC Real-Time Video Chat Implementation Guide

## Overview
This document describes the WebRTC video chat feature implementation for online appointments between doctors and patients. The feature uses peer-to-peer video communication via WebRTC with signaling through Supabase Realtime channels.

---

## Architecture

### Components

1. **useWebRTCCall Hook** (`src/hooks/use-webrtc-call.ts`)
   - Custom React hook managing WebRTC peer connections
   - Handles media stream acquisition and management
   - Manages offer/answer/ICE candidate signaling via Supabase Realtime
   - Provides call state and control actions

2. **VideoChat Component** (`src/components/dashboard/VideoChat.tsx`)
   - Main UI for video call interface
   - Displays local video (picture-in-picture) and remote video
   - Controls for audio/video toggle, call start/end
   - Displays call status and appointment information

3. **VideoChatDialog Component** (`src/components/dashboard/VideoChatDialog.tsx`)
   - Dialog wrapper for video chat
   - Integrates with appointment data
   - Only available for online consultations

4. **Integration Points**
   - `PatientAppointments.tsx` - Shows "Join Call" button for approved online appointments
   - `AppointmentManagement.tsx` - Shows "Start Call" button for approved online appointments

---

## How It Works

### Call Flow

```
PATIENT INITIATES CALL:
1. Patient clicks "Join Call" button on approved online appointment
2. VideoChatDialog opens
3. Patient clicks "Call Doctor"
4. useWebRTCCall.startCall() executes:
   - Requests camera/microphone permissions
   - Gets local media stream
   - Initializes RTCPeerConnection
   - Creates SDP offer
   - Sends offer via Supabase Realtime channel
   
DOCTOR RECEIVES CALL:
1. Doctor sees incoming call notification via Supabase
2. "Start Call" button becomes interactive
3. Doctor's browser receives offer via realtime channel
4. RTCPeerConnection.ontrack event fires when receiving offer
5. Doctor clicks "Start Call" (or "Answer Call" if implemented)
6. useWebRTCCall.answerCall() executes:
   - Requests camera/microphone permissions
   - Gets local media stream
   - Creates SDP answer
   - Sends answer via Supabase Realtime channel
   
CONNECTION ESTABLISHED:
1. Both sides exchange ICE candidates via Supabase Realtime
2. RTCPeerConnection.onicecandidate fires
3. ICE candidates establish direct peer connection
4. Once connected, video streams flow directly P2P
5. Both parties can toggle audio/video
6. Either party can end call

CALL END:
1. User clicks "End Call" button
2. Streams are stopped
3. RTCPeerConnection is closed
4. Call-end event sent via Supabase Realtime
5. Remote side receives notification and cleans up
```

### Signaling via Supabase Realtime

**Channel Name**: `video-call-{appointmentId}`

**Messages**:
- `offer`: SDP offer from call initiator
- `answer`: SDP answer from call responder  
- `ice-candidate`: ICE candidate for connection establishment
- `call-end`: Notification that remote user ended the call

Example payload:
```json
{
  "type": "offer",
  "sdp": "v=0\r\no=...",
  "type": "offer"
}
```

---

## Implementation Details

### WebRTC Configuration

```typescript
const configuration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ],
};
```

- Uses Google's STUN servers for NAT traversal
- STUN helps peers discover their public IP addresses
- No TURN server needed for basic P2P communication (can be added for NAT penetration)

### Media Constraints

```typescript
{
  video: { width: { ideal: 1280 }, height: { ideal: 720 } },
  audio: true,
}
```

- Requests HD video (720p)
- Enables audio by default
- User can toggle both on/off during call

### State Management

```typescript
interface WebRTCCallState {
  localStream: MediaStream | null;    // User's camera/mic
  remoteStream: MediaStream | null;   // Remote user's video
  isCallActive: boolean;              // Call established
  isCalling: boolean;                 // Currently initiating
  isAnswering: boolean;               // Awaiting answer
  error: string | null;               // Error messages
}
```

---

## Usage

### For Patients

1. Navigate to Dashboard > Upcoming Appointments
2. Find an approved online appointment
3. Click "Join Call" button
4. Allow camera and microphone permissions
5. Click "Call Doctor"
6. Wait for doctor to answer
7. Once connected, video appears automatically
8. Use controls to mute/stop video or end call

### For Doctors

1. Navigate to Doctor Dashboard > Appointment Requests
2. Review and approve pending appointments
3. For approved online appointments, "Start Call" button is available
4. Click "Start Call"
5. Allow camera and microphone permissions
6. Wait for patient or answer incoming call
7. Once connected, video appears automatically
8. Use controls to manage call

---

## Browser Compatibility

WebRTC works on modern browsers:
- ✅ Chrome/Edge (66+)
- ✅ Firefox (55+)
- ✅ Safari (11+)
- ✅ Opera (53+)
- ❌ Internet Explorer

**Check browser support**: https://caniuse.com/rtc-peer-connection

---

## Requirements

### Permissions
- **Camera Access**: User must grant permission for video
- **Microphone Access**: User must grant permission for audio
- **HTTPS**: Required for WebRTC in production (except localhost)

### Network
- **Stable Internet Connection**: Required for peer connection establishment
- **Open NAT/Firewall**: May need TURN server if behind restrictive firewalls
- **Supabase Realtime**: Must be enabled for signaling

---

## Troubleshooting

### Call Not Connecting
1. **Check console for errors**: Browser DevTools > Console
2. **Verify camera/microphone**: Settings > Privacy > Camera/Microphone permissions
3. **Test internet connection**: Both parties need stable connectivity
4. **Check firewall**: Some firewalls block WebRTC
5. **Try TURN server**: Add TURN servers to configuration for NAT traversal

### No Video/Audio
1. **Check browser permissions**: Grant camera and microphone access
2. **Try different browser**: Some browsers have limitations
3. **Restart connection**: End call and try again
4. **Check browser console**: Look for getUserMedia errors

### Lag/Choppy Video
1. **Check internet speed**: Minimum 1 Mbps recommended
2. **Close other applications**: Free up bandwidth
3. **Move closer to router**: Better signal
4. **Reduce video quality**: Optional enhancement - reduce constraints

### Supabase Realtime Not Working
1. **Verify Realtime enabled**: Check Supabase dashboard
2. **Check network tab**: Ensure WebSocket connections established
3. **Monitor Supabase status**: Check status.supabase.com

---

## Future Enhancements

### Recommended Additions
1. **Screen Sharing**
   - Use `getDisplayMedia()` instead of `getUserMedia()`
   - Add toggle button for screen share
   - Useful for consultations requiring documentation review

2. **TURN Server**
   - Add TURN configuration for better NAT traversal
   - Improves connectivity for users behind restrictive firewalls
   - Services: TURN server providers or self-hosted

3. **Recording**
   - Use `MediaRecorder` API to record sessions
   - Store recordings in Supabase storage
   - Requires consent from both parties

4. **Call History**
   - Log call duration in database
   - Track call quality metrics
   - Store in new `call_sessions` table

5. **Notifications**
   - Real-time notifications when call arrives
   - Desktop notifications for incoming calls
   - Browser notifications API integration

6. **Call Scheduling**
   - Automatic call invitations at appointment time
   - Reminders for upcoming calls
   - Calendar integration

7. **Quality Monitoring**
   - Track bandwidth usage
   - Monitor connection quality metrics
   - Automatic quality adjustment
   - Display network status to users

8. **Multi-User Support**
   - Group consultations
   - Use SFU (Selective Forwarding Unit) or MCU
   - Requires different architecture

### Performance Optimizations
- Implement adaptive bitrate streaming
- Add data channel for text chat
- Optimize CPU usage with hardware encoding
- Implement connection redundancy

---

## Database Schema Consideration

Current implementation uses existing appointment fields:
- `consultation_type` - Identifies online/offline
- `meeting_url` - Could store call session info (optional)
- `appointment_id` - Used for signaling channel name

**Optional enhancement**: Add call session tracking table:
```sql
CREATE TABLE call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES appointments(id),
  initiator_id UUID NOT NULL,
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  duration_seconds INT,
  status VARCHAR(20), -- 'active', 'completed', 'failed'
  connection_quality VARCHAR(10), -- 'excellent', 'good', 'fair', 'poor'
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Security Considerations

### Current Implementation
- Uses Supabase Realtime authentication (inherits user auth)
- Channel names include appointment ID (semi-private)
- Media streams are P2P (not recorded on server)

### Recommendations
1. **RLS Policies**: Add Row Level Security to call_sessions table
2. **Encryption**: Consider DTLS-SRTP for media (built-in with WebRTC)
3. **Access Control**: Verify only appointment participants can join call
4. **Consent**: Explicit consent before recording any session
5. **Data Retention**: Define policy for call session cleanup

### Example RLS Policy
```sql
-- Only appointment participants can access their call session
CREATE POLICY "users_can_view_own_calls"
  ON call_sessions
  FOR SELECT
  USING (
    initiator_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = call_sessions.appointment_id
      AND (a.patient_id = auth.uid() OR a.doctor_id = auth.uid())
    )
  );
```

---

## Testing Checklist

- [ ] Browser camera/microphone permissions work
- [ ] Patient can initiate call for online appointments
- [ ] Doctor receives call notification (via Realtime)
- [ ] Both parties see video after connection
- [ ] Audio/video toggle works on both sides
- [ ] Call duration is reasonable (no excessive lag)
- [ ] Closing dialog properly ends call
- [ ] Call ends when remote user disconnects
- [ ] Multiple calls don't interfere (different appointment IDs)
- [ ] Offline appointments don't show video button
- [ ] Pending appointments don't show video button
- [ ] Expired appointments don't show video button
- [ ] Mobile responsive UI
- [ ] Works on multiple browsers
- [ ] Graceful error handling with user messages

---

## File Structure

```
src/
├── hooks/
│   └── use-webrtc-call.ts              # WebRTC peer connection logic
├── components/dashboard/
│   ├── VideoChat.tsx                   # Video UI component
│   ├── VideoChatDialog.tsx             # Dialog wrapper
│   ├── PatientAppointments.tsx         # Updated with video button
│   └── AppointmentManagement.tsx       # Updated with video button
└── lib/
    └── istTimezone.ts                  # (existing) Timezone utilities
```

---

## Environment Setup

### Required Supabase Configuration
1. **Enable Realtime**: Project Settings > Realtime > Enable Realtime
2. **Create table** (optional): `call_sessions` table for recording
3. **Set RLS policies** (optional): Control access to call data

### Browser Requirements
- Modern browser with WebRTC support
- HTTPS in production (localhost works without HTTPS)
- Camera and microphone hardware

---

## Debugging

### Enable Console Logging
The implementation includes console.log statements prefixed with `[WebRTC]`:
```typescript
console.log('[WebRTC] ICE candidate:', event.candidate);
console.log('[WebRTC] Connection state:', peerConnection.connectionState);
```

### Monitor Realtime Events
Open browser DevTools > Network > WS to see Supabase Realtime messages:
1. Look for WebSocket connection to `realtime-db.*.supabase.co`
2. Check "Messages" tab for broadcast events
3. Verify `offer`, `answer`, `ice-candidate` messages

### Check RTCPeerConnection State
```javascript
// In browser console
console.log(peerConnection.signalingState);      // stable, have-local-offer, etc.
console.log(peerConnection.connectionState);      // connecting, connected, failed, etc.
console.log(peerConnection.iceConnectionState);   // checking, connected, failed, etc.
```

---

## Support & Resources

### WebRTC Documentation
- [MDN WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [WebRTC.org](https://webrtc.org/)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)

### Common Issues
- [WebRTC Troubleshooting Guide](https://webrtc.org/support/)
- [MDN WebRTC Issues](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)

### Testing Tools
- [WebRTC Samples](https://webrtc.github.io/samples/)
- [Browser WebRTC Test](https://test.webrtc.org/)
