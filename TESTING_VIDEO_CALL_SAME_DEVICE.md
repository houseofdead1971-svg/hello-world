# Testing Video Calls on the Same Device

This guide explains how to test the video call feature using the same device for both doctor and patient views.

## Method 1: Two Browser Windows (Recommended)

### Step-by-Step Instructions:

1. **Open Two Browser Windows**
   - Window 1: Regular browser window
   - Window 2: Incognito/Private window (or another browser)
   - **OR** use two different browsers (Chrome + Firefox, Chrome + Edge, etc.)

2. **Login as Different Users**
   - **Window 1 (Patient)**: 
     - Go to `http://localhost:8080/dashboard`
     - Login as a **patient** user
   - **Window 2 (Doctor)**:
     - Go to `http://localhost:8080/doctor-dashboard`
     - Login as a **doctor** user

3. **Create/Find the Same Appointment**
   - Make sure both users can see the **same appointment**
   - The appointment must be:
     - Status: **"Approved"**
     - Consultation Type: **"Online"**
     - Within the call time window (30 min before to 1 hour after appointment time)

4. **Open Video Call Dialogs**
   - **Patient Window**: Click "Join Call" button on the appointment
   - **Doctor Window**: Click "Start Call" button on the same appointment
   - Both dialogs should open

5. **Initiate the Call**
   - **Patient**: Click "Call Doctor" button
   - **Doctor**: Wait for the "Answer Call" button to appear, then click it
   - Both should see each other's video

## Method 2: Two Browser Tabs (Same Browser)

### Important Notes:
- Some browsers may share camera/mic permissions between tabs
- You may need to allow camera/mic access for each tab separately
- If one tab blocks the camera, try the incognito method instead

### Steps:
1. Open two tabs in the same browser
2. Tab 1: `http://localhost:8080/dashboard` (Patient)
3. Tab 2: `http://localhost:8080/doctor-dashboard` (Doctor)
4. Login as different users in each tab
5. Follow steps 3-5 from Method 1

## Method 3: Different Browsers (Easiest)

### Recommended Combinations:
- Chrome + Firefox
- Chrome + Edge
- Chrome + Brave
- Edge + Firefox

### Steps:
1. Open Browser 1 (e.g., Chrome) → Patient dashboard
2. Open Browser 2 (e.g., Firefox) → Doctor dashboard
3. Login as different users
4. Follow steps 3-5 from Method 1

## Troubleshooting

### Issue: "Camera already in use" or "Camera/Microphone is in use by another application"

This error occurs when:
- Another browser tab/window is using the camera
- Another application (Zoom, Teams, Skype) is using the camera
- Testing in two tabs of the same browser

**Solutions** (try in order):

1. **Use Different Browsers** (BEST SOLUTION)
   - Patient: Chrome → `http://localhost:8080/dashboard`
   - Doctor: Firefox/Edge → `http://localhost:8080/doctor-dashboard`
   - This prevents camera conflicts

2. **Close Other Camera Apps**
   - Close Zoom, Teams, Skype, or any other video apps
   - Close other browser tabs that might be using the camera
   - Check Windows Camera app isn't running

3. **Use Incognito Mode**
   - Regular window: Patient dashboard
   - Incognito window: Doctor dashboard
   - Some browsers handle camera access better in incognito

4. **Close and Reopen**
   - Close both browser windows completely
   - Reopen them
   - Try again

5. **Check Browser Permissions**
   - Go to browser settings → Privacy → Camera
   - Make sure camera is allowed
   - Try resetting permissions and allowing again

6. **Restart Browser**
   - Completely close the browser
   - Reopen and try again

### Issue: "Starting videoinput failed" or "Camera hardware error"

This error indicates a problem with the camera hardware or drivers.

**Solutions** (try in order):

1. **Restart Browser**
   - Completely close all browser windows
   - Reopen and try again
   - This resets camera access

2. **Update Camera Drivers**
   - Windows: Device Manager → Cameras → Right-click → Update driver
   - Mac: System Settings → Software Update
   - Linux: Check your distribution's driver update tool

3. **Unplug/Replug USB Camera**
   - If using external camera, unplug it
   - Wait 5 seconds
   - Plug it back in
   - Try again

4. **Check Camera in Device Manager**
   - Windows: Device Manager → Cameras
   - Look for yellow warning icons
   - If found, right-click → Update driver or Uninstall (then reconnect)

5. **Test Camera in Another App**
   - Open Windows Camera app
   - Or try camera in Zoom/Teams
   - If it works there, it's a browser-specific issue
   - If it doesn't work, it's a hardware/driver issue

6. **Use Different Camera**
   - If you have multiple cameras (built-in + external)
   - Try switching to a different one
   - Browser settings → Camera → Select different device

7. **Check Windows Privacy Settings**
   - Settings → Privacy & Security → Camera
   - Make sure "Camera access" is ON
   - Make sure "Let apps access your camera" is ON
   - Make sure your browser is allowed

8. **Try Different Browser**
   - Some browsers handle camera errors better
   - Try Chrome, Firefox, or Edge
   - See if the issue persists

### Issue: "Can't see video on one side"
**Check**:
1. Open browser console (F12) on both windows
2. Look for `[WebRTC]` logs
3. Check if connection state shows "connected"
4. Verify both sides have camera permissions allowed

### Issue: "Waiting for connection" forever
**Check**:
1. Are both users viewing the **SAME appointment ID**?
2. Check console logs - do you see "Received offer" on the doctor side?
3. Did the doctor click "Answer Call" button?
4. Are both windows showing console logs?

### Issue: "Signaling channel not ready"
**Solution**:
- Wait 2-3 seconds after opening the dialog before clicking buttons
- Check your internet connection
- Refresh both windows and try again

## Quick Test Checklist

- [ ] Two browser windows/tabs open
- [ ] Different users logged in (patient + doctor)
- [ ] Same appointment visible in both windows
- [ ] Appointment is "Approved" and "Online"
- [ ] Both video call dialogs are open
- [ ] Camera permissions allowed in both windows
- [ ] Browser console open (F12) to see logs
- [ ] Patient clicks "Call Doctor"
- [ ] Doctor sees "Answer Call" button and clicks it
- [ ] Both see "Call Active" status
- [ ] Video streams appear on both sides

## Testing Tips

1. **Use Browser DevTools**: Open F12 on both windows to see connection logs
2. **Check Console Logs**: Look for `[WebRTC]` messages to debug issues
3. **Test Audio**: Make sure you can hear audio from both sides
4. **Test Video Toggle**: Try turning camera on/off during the call
5. **Test Mute**: Try muting/unmuting audio during the call
6. **Test Call End**: Make sure ending the call works from both sides

## Expected Behavior

### Patient Side:
1. Click "Join Call" → Dialog opens
2. Click "Call Doctor" → Shows "Calling..."
3. Wait for doctor to answer
4. Once connected → See doctor's video (large) and own video (small PIP)
5. Can toggle audio/video, end call

### Doctor Side:
1. Click "Start Call" → Dialog opens
2. Wait for patient's call (or click "Start Call" to initiate)
3. See "Answer Call" button when offer received
4. Click "Answer Call" → Shows "Call answered"
5. Once connected → See patient's video (large) and own video (small PIP)
6. Can toggle audio/video, end call

## Network Requirements

- Both windows must be on the same network (or localhost)
- Internet connection required for Supabase signaling
- STUN servers must be accessible (usually automatic)

## Camera/Microphone Setup

When testing on the same device:
- The browser will ask for camera/mic permission **twice** (once per window)
- Allow permissions for both windows
- If you have multiple cameras, you can select different ones in each window
- Some browsers allow using the same camera in multiple windows, others don't

## Best Practices

1. **Use Incognito Mode**: Prevents cookie/session conflicts
2. **Use Different Browsers**: Most reliable method
3. **Clear Permissions**: If stuck, clear browser permissions and try again
4. **Check Console**: Always have F12 open to see what's happening
5. **Test Both Directions**: Try patient initiating and doctor initiating

---

## Quick Start Command

```bash
# Terminal 1: Start dev server
npm run dev

# Then:
# 1. Open Chrome → http://localhost:8080/dashboard (Patient)
# 2. Open Firefox → http://localhost:8080/doctor-dashboard (Doctor)
# 3. Login as different users
# 4. Open same appointment
# 5. Start video call!
```

