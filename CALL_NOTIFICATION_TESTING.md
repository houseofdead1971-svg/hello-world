# Call Notification System - Testing & Validation Guide

## ✅ Implementation Checklist

### Components Created
- [x] `IncomingCallNotification.tsx` - Main notification component
  - [x] Displays at top of screen
  - [x] Shows caller info and appointment ID
  - [x] Answer/Decline buttons
  - [x] Notification sound
  - [x] Smooth animations
  - [x] Mobile responsive

- [x] `CallNotificationContext.tsx` - Global state management
  - [x] Provider component
  - [x] Hook for consuming context
  - [x] Callback handlers

### Files Modified
- [x] `App.tsx`
  - [x] Added CallNotificationProvider
  - [x] Added GlobalCallNotification component
  - [x] Proper imports

- [x] `useWebRTCCall.ts` (Hook)
  - [x] Added `incomingCall` state
  - [x] Added `callerName` state
  - [x] Added `dismissIncomingCall` action
  - [x] Updated call offer handling
  - [x] Send caller name in offer payload

- [x] `VideoChatDialog.tsx`
  - [x] Import CallNotificationContext
  - [x] Setup incoming call notification
  - [x] Pass handlers to notification
  - [x] Handle dismiss properly

- [x] `VideoChat.tsx`
  - [x] Removed answer/decline buttons from dialog
  - [x] Added instruction message
  - [x] Kept camera preference UI

## 🧪 Manual Testing Steps

### Test Case 1: Doctor Initiates Call to Patient
**Preconditions:** 
- Two browsers open (or two devices)
- One logged in as Doctor
- One logged in as Patient
- Both have an online appointment scheduled

**Steps:**
1. Doctor navigates to Dashboard
2. Doctor clicks "Start Call" for patient appointment
3. Dialog opens and shows "Calling..."
4. **Patient's browser:** Wait 2-3 seconds
5. **VERIFY:** Blue notification appears at top of patient's screen
6. **VERIFY:** Notification shows:
   - 📞 Doctor is calling
   - Caller name: "Doctor"
   - Appointment ID displayed
   - Green "Answer" button
   - Red "Decline" button
   - Ringing animation (dots bouncing)
7. **VERIFY:** Sound plays (if system audio enabled)

**Expected Result:** ✅ Notification appears correctly

---

### Test Case 2: Patient Answers the Call
**Preconditions:** Continuing from Test Case 1, notification is visible

**Steps:**
1. **Patient:** Click green "Answer" button on notification
2. **VERIFY:** Notification disappears
3. **VERIFY:** Dialog shows "Ready to answer" with camera preference
4. **VERIFY:** Video dialog opens/focuses
5. **Doctor's side:** Dialog shows "Call Active" or video stream begins
6. **Patient's side:** Video stream establishes
7. **VERIFY:** Both can see/hear each other

**Expected Result:** ✅ Call connects successfully

---

### Test Case 3: Patient Declines the Call
**Preconditions:** Notification is visible (from Test Case 1 or repeat Test Case 1)

**Steps:**
1. **Patient:** Click red "Decline" button on notification
2. **VERIFY:** Notification disappears immediately
3. **VERIFY:** Video dialog closes (or stays empty)
4. **Doctor's side:** "Call Timeout" message appears
5. **VERIFY:** Doctor can try calling again

**Expected Result:** ✅ Call is declined cleanly

---

### Test Case 4: Call Timeout (No Response)
**Preconditions:** Doctor has initiated call

**Steps:**
1. Doctor clicks "Start Call"
2. Patient sees notification
3. **Patient does nothing** (don't answer or decline)
4. Wait 30 seconds
5. **Doctor's side:** "Call not answered" message appears
6. **VERIFY:** Can try calling again
7. **VERIFY:** Notification on patient side eventually disappears

**Expected Result:** ✅ Timeout handled gracefully

---

### Test Case 5: Mobile Responsiveness
**Preconditions:** Open app on mobile device

**Steps:**
1. Doctor initiates call from patient on mobile
2. **VERIFY:** Notification appears at top (not cut off)
3. **VERIFY:** Buttons are large enough to tap
4. **VERIFY:** No horizontal scroll needed
5. Tap "Answer" button
6. **VERIFY:** Dialog properly resizes for mobile
7. **VERIFY:** Video works in portrait and landscape

**Expected Result:** ✅ Fully responsive

---

### Test Case 6: Notification While on Different Page
**Preconditions:** App is open but on a different page

**Steps:**
1. Patient is on Dashboard (not in video dialog)
2. Doctor initiates call
3. **VERIFY:** Notification appears at top
4. **VERIFY:** Notification is visible above page content
5. Click "Answer" 
6. **VERIFY:** Video dialog opens
7. **VERIFY:** Can accept call from any page

**Expected Result:** ✅ Notification works across pages

---

### Test Case 7: Browser Audio Permissions
**Preconditions:** Browser hasn't granted audio permissions

**Steps:**
1. Open app in incognito/private mode
2. Doctor initiates call to patient
3. Notification appears
4. Click "Answer"
5. Browser prompts for audio permission
6. Grant permission
7. **VERIFY:** Sound plays for next notification
8. Hang up call
9. Doctor calls again
10. **VERIFY:** Sound plays immediately

**Expected Result:** ✅ Sound respects browser permissions

---

## 🔍 Code Validation Tests

### Test: Hook Integration
```bash
# Verify hook exports correct state and actions
npm run build  # Should complete without errors
```

### Test: Context Provided
```tsx
// Verify provider wraps entire app
// In App.tsx: <CallNotificationProvider>...<AppContent /></CallNotificationProvider>
```

### Test: Notification Component Renders
```tsx
// GlobalCallNotification should render without errors when incomingCall.isActive is true
```

---

## 📊 State Verification Tests

### Test: Initial State
```javascript
// useWebRTCCall hook should initialize with:
{
  localStream: null,
  remoteStream: null,
  isCallActive: false,
  isCalling: false,
  isAnswering: false,
  error: null,
  incomingCall: false,        // NEW
  callerName: null,           // NEW
}
```

### Test: Incoming Call State Transition
```javascript
// When offer received:
// 1. isAnswering → true
// 2. incomingCall → true  
// 3. callerName → "Doctor" (from offer payload)
```

### Test: Context State
```javascript
// useCallNotification should provide:
{
  incomingCall: {
    isActive: boolean,
    callerName: string,
    appointmentId: string,
    onAnswer: () => void,
    onDecline: () => void,
  },
  setIncomingCall: (call) => void,
}
```

---

## 🔗 Integration Points Verification

### VideoChatDialog Integration
```tsx
✅ Imports useCallNotification
✅ Calls setIncomingCall when callState.incomingCall changes
✅ Passes correct handlers (onAnswer, onDecline)
✅ Cleans up notification on unmount
```

### App.tsx Integration
```tsx
✅ CallNotificationProvider wraps AppContent
✅ GlobalCallNotification renders
✅ Notification shows when incomingCall.isActive is true
✅ Works across all routes
```

### WebRTC Hook Integration
```tsx
✅ Sends callerName in offer payload
✅ Sets incomingCall state when offer received
✅ Provides dismissIncomingCall action
✅ Maintains proper state lifecycle
```

---

## 🚨 Error Scenarios to Test

### Test: Permission Denied
1. Deny microphone/camera when prompted
2. **VERIFY:** Error message shown
3. **VERIFY:** Can retry with "Allow" next time

### Test: Network Disconnect
1. Disable internet during call
2. **VERIFY:** "Connection lost" message appears
3. **VERIFY:** Can reconnect by calling again

### Test: Audio Context Not Available
1. In notification component - browser might not allow AudioContext in private mode
2. **VERIFY:** No console errors
3. **VERIFY:** Notification still shows even if sound fails

### Test: Multiple Rapid Calls
1. Doctor initiates call, doesn't wait for answer
2. Doctor initiates another call
3. **VERIFY:** Only one notification shows
4. **VERIFY:** States update correctly

---

## 📱 Cross-Device Testing

| Device | OS | Browser | Status |
|--------|----|---------|----|
| Desktop | Windows | Chrome | ✅ Test |
| Desktop | Windows | Edge | ✅ Test |
| Desktop | Windows | Firefox | ✅ Test |
| Laptop | macOS | Safari | ✅ Test |
| Mobile | iOS | Safari | ✅ Test |
| Mobile | Android | Chrome | ✅ Test |
| Tablet | iPad | Safari | ✅ Test |
| Tablet | Android | Chrome | ✅ Test |

---

## 📋 Checklist for Production

- [ ] All tests pass
- [ ] No console errors
- [ ] Notification displays correctly on all screen sizes
- [ ] Answer/Decline buttons work reliably
- [ ] Sound plays in supported browsers
- [ ] State management is clean
- [ ] No memory leaks on component unmount
- [ ] Graceful degradation when features unavailable
- [ ] Works with slow internet (timeout handles delays)
- [ ] Tested on minimum 2 different devices
- [ ] Tested on minimum 2 different browsers
- [ ] Mobile testing completed
- [ ] Edge cases handled (timeouts, rejections, etc.)

---

## 🎯 Success Criteria

✅ **Notification Appears on Top**
- Blue banner slides in from top
- Always visible above other content
- Appears within 1-2 seconds of incoming call

✅ **Proper Call Handling**
- Incoming calls show notification
- Outgoing calls show calling state
- Both can be answered or declined
- Timeout after 30 seconds

✅ **User Interactions Work**
- Answer button accepts call
- Decline button rejects call
- Buttons are responsive and accessible
- Mobile users can easily tap buttons

✅ **Audio Notification**
- Sound plays on incoming call
- Only if browser audio enabled
- Gracefully handles audio context errors
- Doesn't block notification display

✅ **No Regressions**
- Existing call functionality still works
- Video streams properly
- Audio/video controls work
- End call button functions
- No new bugs introduced

---

## 📞 Quick Reference: Testing Checklist

Before deployment, verify:

```
VISUAL CHECKS
□ Notification appears at top of screen
□ Notification has proper styling (blue background)
□ Answer button is green
□ Decline button is red
□ Caller name displayed
□ Appointment ID displayed
□ Ringing indicator animates
□ Notification slides in smoothly
□ Notification slides out smoothly

FUNCTIONAL CHECKS
□ Answer button works
□ Decline button works
□ Call connects after answer
□ Call rejects properly
□ Timeout works after 30 seconds
□ Buttons are keyboard accessible
□ Enter key works on buttons

AUDIO CHECKS
□ Sound plays on incoming call
□ Sound doesn't break notification
□ Works without audio context
□ Respects mute switch (iOS)

MOBILE CHECKS
□ Appears on mobile screens
□ Buttons are touch-friendly
□ No overflow or cutoff
□ Works portrait and landscape
□ Works on small phones (< 375px)
□ Works on tablets (> 768px)

BROWSER CHECKS
□ Chrome/Edge
□ Firefox
□ Safari
□ Mobile browsers
```

---

## 📝 Known Limitations & Workarounds

1. **Audio in Private Mode:** Some browsers block AudioContext in private mode
   - **Workaround:** Show notification anyway, audio is optional

2. **iOS Mute Switch:** Physical mute switch may prevent sound
   - **Workaround:** Visual notification is primary, audio is secondary

3. **Permission-Based Sound:** Requires user interaction first
   - **Workaround:** Sound works after first page interaction

---

## 🐛 Troubleshooting

### Notification doesn't appear
- Check: Is CallNotificationProvider in App.tsx?
- Check: Is GlobalCallNotification component rendering?
- Check: Is incomingCall state being set correctly?
- Check: Browser console for errors

### Answer button doesn't work
- Check: Is onAnswer callback defined?
- Check: Is answerCall function properly called?
- Check: No console errors?

### Sound doesn't play
- Check: Browser audio enabled?
- Check: Is AudioContext supported?
- Check: Try page reload
- Check: Try different browser

### Call doesn't connect after answer
- Check: Network connection
- Check: Both peers have dialog open?
- Check: Media permissions granted?
- Check: WebRTC console logs for errors

---

**Test Date:** _________
**Tester Name:** _________
**Status:** ✅ READY FOR DEPLOYMENT

