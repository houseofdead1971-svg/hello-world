# Call Notification - Visual Guide & Quick Reference

## 🎯 What Changed

### BEFORE
```
Video Chat Dialog
├── Pre-Call State
├── Calling State
├── Incoming Call State
│   ├── Camera preference checkbox
│   ├── [Answer Call] button      ← Inside dialog
│   └── [Decline] button          ← Inside dialog
├── Active Call State
└── Call Ended
```

### AFTER
```
┌─────────────────────────────────────────────────────────────┐
│ 📞 Doctor is calling...                                    │
│ [Answer ✓]  [Decline ✗]        ← TOP OF SCREEN - ALWAYS    │
└─────────────────────────────────────────────────────────────┘
                         ↓
          (Click Answer to proceed)
                         ↓
Video Chat Dialog
├── Pre-Call State
├── Calling State
├── Incoming Call State (Simplified)
│   ├── Camera preference checkbox
│   └── "Check notification at top" message
├── Active Call State
└── Call Ended
```

## 📱 Visual Layout

### Notification Display
```
┌─────────────────────────────────────────────────────────────────┐
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓   │
│  ┃  📞  Dr. Smith is calling                    │ ✓  │  ✗  ┃   │
│  ┃      Incoming Video Call                                  ┃   │
│  ┃      Appointment ID: appt_123456                         ┃   │
│  ┃      ◯ ◯ ◯  (ringing dots)                              ┃   │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │
│                                                                   │
│                        [Rest of page]                           │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 Call Flow Diagram

### Patient Perspective (Receives Call)
```
┌─────────────────────────────────┐
│ Patient on Dashboard            │
└──────────────┬──────────────────┘
               │
               │ Doctor initiates call
               ↓
      ┌─────────────────────┐
      │ Notification appears│
      │ at TOP of screen    │
      │ 📞 Doctor calling..│
      └──────┬──────────┬───┘
             │          │
        Click│          │Click
        Answer│          │Decline
             ↓          ↓
        ┌──────────┐  ┌────────────┐
        │  Call    │  │ Call Ended │
        │ Accepted │  │ (Declined) │
        └────┬─────┘  └────────────┘
             ↓
        Video Chat Opens
             ↓
        Live Video Stream
             ↓
        Call Active
```

### Doctor Perspective (Initiates Call)
```
┌──────────────────────────────────┐
│ Doctor in Video Chat Dialog      │
│                                  │
│ [Start Call] button clicked      │
└──────────────┬───────────────────┘
               │
               ↓
        ┌──────────────────────┐
        │ Dialog shows:        │
        │ "Calling Patient..." │
        │ [Cancel button]      │
        └──────┬───────────────┘
               │
               │ (Wait max 30 seconds)
               │
        ┌──────┴───────────┬─────────────────┐
        │                  │                 │
        │ Patient answers  │ No response or  │
        │                  │ Patient declines│
        ↓                  ↓                 ↓
     ┌────────┐      ┌──────────┐    ┌────────────┐
     │ Video  │      │ Call     │    │ Call       │
     │ Stream │      │ Timeout  │    │ Declined   │
     │ Starts │      │ Msg      │    │ Msg        │
     └────────┘      └──────────┘    └────────────┘
```

## 🎨 User Interactions

### Answering a Call
```
1. Notification appears at top
   ↓
2. User sees caller name and appointment info
   ↓
3. User clicks green "Answer" button
   ↓
4. Camera preference dialog shows (in the main dialog)
   ↓
5. User can select camera on/off before answering
   ↓
6. Click "Answer Call" in dialog (or already answered from notification)
   ↓
7. Connection established
   ↓
8. Video stream begins
   ↓
9. Call controls appear (mute, video toggle, end call)
```

### Declining a Call
```
1. Notification appears at top
   ↓
2. User sees caller details
   ↓
3. User clicks red "Decline" button
   ↓
4. Notification disappears
   ↓
5. Call is rejected (remote peer gets "call rejected" message)
   ↓
6. Dialog closes automatically
```

## 🔊 Audio & Notifications

### Notification Sound
- Plays automatically when call arrives
- 500ms beeping tone
- Gracefully handles if audio context unavailable
- No error shown to user

### Sound Code
```javascript
const audioContext = new AudioContext();
const oscillator = audioContext.createOscillator();
oscillator.frequency.value = 800; // Hz
oscillator.start();
oscillator.stop(currentTime + 0.5); // 500ms duration
```

## 📊 State Machine

```
                    ┌─────────────┐
                    │ Pre-Call    │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │             │
                    ↓             ↓
            ┌──────────────┐ ┌──────────────┐
            │   Calling    │ │  Answering   │
            │  (Initiator) │ │  (Receiver)  │
            └──────┬───────┘ └──────┬───────┘
                   │                │
        ┌──────────┴─────────┬──────┴───────────┐
        │                    │                  │
        │ Answer received    │ User clicks     │
        │                    │ Answer button   │
        │                    │                 │
        ↓                    ↓                 ↓
   ┌────────────────────────────────────┐  ┌─────────┐
   │     Call Active (Connected)        │  │ Declined│
   │ - Video streams flowing            │  └─────────┘
   │ - Audio enabled                    │
   │ - Call duration tracking           │
   │ - Media controls available         │
   └──────────┬───────────────────────┘
              │
              │ User clicks End Call
              ↓
          ┌──────────┐
          │ Call End │
          └──────────┘
```

## 🛠️ Component Integration

```
App.tsx
├── CallNotificationProvider (Context)
│   └── GlobalCallNotification (Component)
│       └── IncomingCallNotification
│           ├── Display banner at top
│           ├── Show caller info
│           ├── Answer button
│           ├── Decline button
│           └── Play notification sound
│
└── Routes
    └── Dashboard/DoctorDashboard
        └── VideoChatDialog
            ├── useWebRTCCall hook
            │   ├── Setup offer/answer signaling
            │   ├── Manage WebRTC connection
            │   └── Set incomingCall state
            │
            └── VideoChat
                ├── Display video streams
                ├── Show call controls
                └── Handle camera preferences
```

## 📋 Key Files

| File | Purpose | Changes |
|------|---------|---------|
| `IncomingCallNotification.tsx` | Display notification banner | NEW |
| `CallNotificationContext.tsx` | Global state management | MODIFIED |
| `use-webrtc-call.ts` | WebRTC signaling | MODIFIED - Added incoming call state |
| `VideoChatDialog.tsx` | Dialog wrapper | MODIFIED - Integrated context |
| `VideoChat.tsx` | Video UI | MODIFIED - Removed dialog buttons |
| `App.tsx` | App root | MODIFIED - Added provider & notification |

## ✨ Features Summary

✅ **Answer/Decline at Top**
- Notification banner at top of screen
- Always visible and accessible
- Works on any page

✅ **Proper Call Handling**
- Incoming vs outgoing distinction
- Timeout after 30 seconds
- State management for all phases
- Clean error handling

✅ **Audio Notification**
- Automatic beep on incoming call
- Web Audio API integration
- Graceful degradation

✅ **Mobile Friendly**
- Responsive buttons
- Touch-friendly interface
- Works portrait and landscape

✅ **User Feedback**
- Visual animations
- Status messages
- Call information display
- Ringing indicator

## 🚀 How to Test

### Test 1: Basic Incoming Call
1. Open two browsers/devices
2. Login as doctor and patient
3. Doctor initiates call to patient
4. Patient should see notification at top
5. Click Answer
6. Video should connect

### Test 2: Decline Call
1. Repeat steps 1-4 above
2. Click Decline button
3. Notification should disappear
4. Doctor should get "declined" message

### Test 3: Call Timeout
1. Doctor initiates call
2. Patient doesn't answer
3. After 30 seconds, doctor gets timeout message

### Test 4: Mobile Response
1. Open patient view on mobile
2. Receive incoming call
3. Verify notification appears fully visible
4. Verify buttons are easy to tap

## 🎓 Usage Example

```tsx
// In VideoChatDialog component
const { setIncomingCall } = useCallNotification();

useEffect(() => {
  if (callState.incomingCall) {
    setIncomingCall({
      callerName: callState.callerName,
      appointmentId,
      onAnswer: async () => {
        await callActions.answerCall();
      },
      onDecline: () => {
        callActions.dismissIncomingCall();
      },
    });
  }
}, [callState.incomingCall]);
```

## 📞 API Reference

### useCallNotification Hook
```tsx
const { incomingCall, setIncomingCall } = useCallNotification();

// incomingCall object
{
  isActive: boolean;           // Is notification showing?
  callerName: string;          // Who's calling?
  appointmentId: string;       // Which appointment?
  onAnswer: () => void;        // Answer button handler
  onDecline: () => void;       // Decline button handler
}

// Update notification
setIncomingCall({
  callerName: "Dr. Smith",
  appointmentId: "appt_123",
  onAnswer: () => { /* handle */ },
  onDecline: () => { /* handle */ },
});

// Clear notification
setIncomingCall(null);
```

### useWebRTCCall Hook
```tsx
// New state properties
callState.incomingCall: boolean;
callState.callerName: string | null;

// New action
callActions.dismissIncomingCall(): void;
```

---

**Status:** ✅ Complete and ready to use
**Last Updated:** December 28, 2025
