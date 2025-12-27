# WebRTC Video Chat - Quick Start Guide

## What's New? 🎥
Your healthcare platform now has **real-time video chat** for online appointments! Doctors and patients can have face-to-face consultations directly in the app using WebRTC peer-to-peer technology.

---

## Features

✅ **Real-time HD Video** (up to 720p)
✅ **Crystal Clear Audio**
✅ **Mute/Video Toggle** during calls
✅ **One-click Video Calls** for approved online appointments
✅ **Automatic Connection** using STUN servers
✅ **Mobile Responsive** UI
✅ **No Plugins Required** - works in modern browsers
✅ **Secure P2P** - direct connection, no server recording

---

## For Patients

### How to Join a Video Call

1. **Go to Dashboard**
   - Click "Upcoming Appointments"

2. **Find Your Online Appointment**
   - Look for appointments marked "Online (Video Call)"
   - Must be in "Approved" status
   - Time must not have passed

3. **Join the Call**
   - Click the blue "Join Call" button
   - Grant camera and microphone permissions
   - Click "Call Doctor"

4. **During the Call**
   - Your video appears in the corner (picture-in-picture)
   - Doctor's video fills the screen
   - Use buttons to mute/stop video
   - Click "End Call" when done

### Troubleshooting
- **"Allow" button doesn't appear?** → Check browser settings for camera/mic permissions
- **Black video screen?** → Ensure correct camera is selected in OS settings
- **No connection?** → Check internet speed (minimum 1 Mbps recommended)

---

## For Doctors

### How to Start a Video Call

1. **Go to Doctor Dashboard**
   - View "Appointment Requests"

2. **Review and Approve**
   - Click "Review" on pending appointment
   - Click "Approve" after reviewing details

3. **Start Video Call**
   - Once approved, "Start Call" button appears for online appointments
   - Click "Start Call"
   - Grant camera and microphone permissions

4. **Wait for Patient**
   - Calling status displays
   - Patient will see "Call incoming" notification
   - Once connected, video appears automatically

5. **During the Call**
   - Toggle audio/video as needed
   - Appointment ID shown for reference
   - Patient is in main video area
   - Click "End Call" when consultation ends

### Pro Tips
- Approve appointments early so patients can join at scheduled time
- Ensure proper lighting before call
- Use headphones to avoid echo
- Close other apps to reduce network usage

---

## System Requirements

### Minimum
- **Browser**: Chrome, Firefox, Safari, or Edge (recent version)
- **Camera & Microphone**: Built-in or USB
- **Internet**: 1+ Mbps upload/download
- **OS**: Windows, Mac, Linux, iOS, or Android

### Recommended
- **Browser**: Latest version (Chrome/Edge recommended)
- **Internet**: 5+ Mbps for smooth HD video
- **Camera**: HD webcam (1080p or higher)
- **Audio**: Headphones or good microphone
- **Lighting**: Good room lighting
- **Connection**: Wired internet (not WiFi) for stability

### Browser Support
- ✅ Chrome 66+ (Desktop & Android)
- ✅ Edge 79+ (Desktop & iOS)
- ✅ Firefox 55+ (Desktop & Android)
- ✅ Safari 11+ (Mac & iOS)
- ⚠️ Opera 53+ (Limited testing)
- ❌ Internet Explorer (Not supported)

---

## Permissions Guide

### Camera Permission
When you first click "Join Call" or "Start Call", your browser will ask permission to access your camera.

**Allow or Deny?** → Click "Allow" to use video chat

**If you already denied it:**
- Chrome: Settings → Privacy and security → Site settings → Camera
- Firefox: Preferences → Privacy → Permissions → Camera
- Safari: Preferences → Websites → Camera
- Edge: Settings → Privacy → Camera

### Microphone Permission
Similarly, you'll be asked for microphone access for audio.

**Same steps as Camera** to change settings if needed.

---

## Appointment Types

### Online Appointment
```
✅ Has a blue "Join Call" or "Start Call" button
✅ Video chat is available
✅ Meeting URL might be shown
✅ No physical location needed
```

### Offline Appointment
```
❌ No video button
❌ Requires in-person visit
✅ Clinic location shown instead
```

**Check consultation type** when booking to ensure you choose the right type!

---

## Call Status Indicators

### Patient Side
- **"Calling..."** - Waiting for doctor to accept
- **"Call Active"** - Connected, video streaming
- **"Ready to answer"** - Doctor's call incoming
- **"Waiting for connection"** - Initializing call

### Doctor Side
- **"Calling..."** - Waiting for patient to answer
- **"Call Active"** - Connected, video streaming
- **Green pulse badge** - Call is active and stable

---

## During the Call

### Controls Available

**Audio/Video Toggle:**
- 🎤 **Mute** - Turn off your microphone
- 📹 **Stop Video** - Turn off your camera
- Useful for privacy or bandwidth saving

**Call Management:**
- ☎️ **End Call** - Disconnect and close video chat
- Confirms before ending if actively in call

**Call Info:**
- Shows appointment ID for reference
- Current connection status
- Participant name

---

## Common Issues & Solutions

### "Camera not found"
- Check System Settings > Privacy > Camera
- Ensure no other app is using camera
- Try restarting browser
- Unplug and replug USB camera if external

### "No audio"
- Check System Settings > Privacy > Microphone
- Ensure microphone volume is up
- Try different microphone if available
- Restart browser and retry

### "Blurry or delayed video"
- Check internet speed: speedtest.net
- Close other apps/tabs using internet
- Move closer to WiFi router
- Try wired connection instead of WiFi
- Reduce number of open browser tabs

### "Connection keeps dropping"
- Check internet stability
- Reduce background app activity
- Try different network (WiFi vs wired)
- Restart your internet router
- Check browser console for errors

### "Call won't connect"
- Refresh page and try again
- Clear browser cache
- Try different browser
- Disable VPN if using one
- Check firewall settings

### "Browser won't ask for permissions"
- Clear browser cache and cookies
- Reset site permissions
- Try incognito/private mode
- Try different browser

---

## Tips for Better Video Calls

### Setup Tips
- **Lighting**: Sit with light in front (avoid backlighting)
- **Background**: Choose clean, professional background
- **Camera Height**: Position camera at eye level
- **Distance**: Sit 1-2 feet from camera
- **Clothing**: Wear what you'd wear in-person

### Audio Tips
- **Headphones**: Use to avoid echo
- **Microphone**: Position close but not touching
- **Environment**: Minimize background noise
- **Volume**: Test before call

### Network Tips
- **Close Apps**: Stop downloads, streaming, etc.
- **WiFi**: Move closer to router or use wired
- **Bandwidth**: Don't share network during calls
- **Router Restart**: Improve connection

---

## Privacy & Security

### Data Protection
- ✅ Your video doesn't pass through our servers
- ✅ Direct peer-to-peer connection between you and other party
- ✅ Encrypted media streams (DTLS-SRTP)
- ✅ Only authenticated users can access calls

### Consent
- 📋 Explicit permission required to start call
- 📋 Both parties must be in approved appointment
- 📋 Appointments automatically block unauthorized participants

### Session Data
- 📊 Call duration may be logged (time tracking)
- 🔒 Call content is NOT recorded by default
- 🗑️ Session data auto-cleaned per privacy policy

---

## Mobile Devices

### Supported Devices
- ✅ iPhone/iPad (Safari)
- ✅ Android phones (Chrome)
- ✅ Tablets (both iOS and Android)

### Mobile Tips
- **Use Recent Browser**: Update Safari or Chrome
- **Good WiFi**: Mobile networks may be slower
- **Headphones**: Prevent feedback
- **Landscape Mode**: Better video view
- **Keep Device Plugged**: Long calls drain battery

### Known Limitations
- Mobile cameras usually lower resolution (acceptable)
- Switching apps may pause the call
- Battery drain is higher on mobile
- Cellular data usage: ~500MB per hour video call

---

## Bandwidth Usage

### Typical Usage
- **Video only**: 2-4 Mbps
- **Audio + Video**: 2.5-5 Mbps
- **HD quality**: 3-6 Mbps
- **Low quality**: 0.5-1.5 Mbps

*Note: Actual usage varies by network and encoder*

---

## Best Practices

### Before Your Appointment
1. ✅ Test camera and microphone
2. ✅ Check internet connection
3. ✅ Close unnecessary apps
4. ✅ Choose quiet location
5. ✅ Ensure good lighting

### During Your Appointment
1. ✅ Minimize distractions
2. ✅ Maintain eye contact with camera
3. ✅ Speak clearly and at normal pace
4. ✅ Avoid background noise
5. ✅ Ask doctor to repeat if unclear

### After Your Appointment
1. ✅ End call properly
2. ✅ Document any advice given
3. ✅ Schedule follow-up if needed
4. ✅ Leave appointment feedback if requested

---

## Emergency/Fallback

### If Video Call Fails
1. Doctor will contact you via:
   - Phone call (if number on file)
   - Email notification
   - In-app notification
2. Can reschedule for different time
3. Can request offline appointment instead
4. Contact support if issue persists

---

## Feedback & Support

### Report Issues
- **Browser Console**: Check for errors (F12 → Console)
- **In-App**: Use feedback button if available
- **Email**: Contact support with browser/device info
- **Include**: Browser name, OS, error message if any

### Feature Requests
- Screen sharing
- Call recording with consent
- Group consultations
- Chat during calls

---

## FAQ

**Q: Is my video recorded?**
A: No, video is not recorded. Direct peer-to-peer connection only.

**Q: Can I use this on my phone?**
A: Yes! iOS (Safari) and Android (Chrome) both supported.

**Q: What if the doctor doesn't answer?**
A: Cancel call and contact clinic. Doctor may be unavailable.

**Q: Can I share my screen?**
A: Not yet, but on roadmap for future update.

**Q: Does this work with VPN?**
A: Usually yes, but some restrictive VPNs may block it.

**Q: How much data does it use?**
A: ~500MB per hour for video+audio call.

**Q: Why is video choppy?**
A: Slow internet, many background apps, or network congestion.

**Q: Can multiple people join?**
A: Currently 1-on-1 only. Multi-party consultations coming later.

**Q: What if I lose connection?**
A: Call ends. Reconnect by starting new call.

---

## Technical Details

### Architecture
- **Protocol**: WebRTC (Real-Time Communication)
- **Signaling**: Supabase Realtime Channels
- **Media**: P2P (Peer-to-Peer) direct connection
- **Codec**: VP8/VP9 for video, Opus for audio
- **Transport**: SRTP (Secure Real-time Transport Protocol)

### Servers Used
- **STUN**: Google's STUN servers (for NAT traversal)
- **Signaling**: Supabase Realtime (only for session setup)
- **Media**: Direct P2P (no intermediate server)

### Advantages
- ✅ Lower latency (direct connection)
- ✅ Better privacy (not on server)
- ✅ Reduced server costs
- ✅ Scalable (no server bandwidth)

---

## Performance Metrics to Expect

### Typical Call Quality
- **Video Latency**: 50-500ms (lower is better)
- **Audio Latency**: 20-150ms
- **Packet Loss**: 0-1% (acceptable)
- **Jitter**: <50ms (very good)

### If You Experience Issues
- **Latency >1000ms**: Network congestion
- **High packet loss**: Poor WiFi signal
- **Audio gap**: Codec/network issue
- **Video freeze**: Bandwidth shortage

---

## Keyboard Shortcuts (Future)
Currently, use mouse/touch. Keyboard shortcuts coming in future version.

---

## Accessibility

### For Users with Disabilities
- ✅ High contrast UI available
- ✅ Large buttons and text
- ✅ Screen reader compatible (partial)
- 🔄 Captions (coming soon)
- 🔄 Voice control (coming soon)

---

## Getting Help

### Immediate Help
1. Check browser console for errors (F12)
2. Restart browser
3. Try different browser
4. Clear cache and cookies
5. Restart computer

### Contact Support
- **In-App**: Support button/chat
- **Email**: support@[yourdomain]
- **Phone**: Call main clinic number

**Include in report:**
- Browser name and version
- Operating system
- Error message (if any)
- Steps to reproduce issue

---

## Version History

### Version 1.0 (Current)
- ✅ Basic 1-on-1 video calls
- ✅ Audio/video toggle
- ✅ Peer-to-peer connection
- ✅ Mobile support
- ✅ Appointment integration

### Planned Features (v1.1+)
- 🔄 Screen sharing
- 🔄 Call recording (with consent)
- 🔄 Chat during calls
- 🔄 Call history/analytics
- 🔄 Better quality metrics display
- 🔄 Multi-party (group) calls

---

*Last Updated: December 2025*
*For technical documentation, see: WEBRTC_VIDEO_CHAT_GUIDE.md*
