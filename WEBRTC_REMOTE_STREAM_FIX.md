# 🎬 WebRTC Remote Stream Playback Fix

## 🔥 Critical Issue Fixed

**The Problem**: Remote video/audio were permanently muted because the hook was setting `track.enabled = true` on REMOTE tracks.

- Remote tracks should NEVER be manually muted/unmuted
- Setting `enabled = true` on remote tracks forces the browser to keep them muted
- This caused `track.onmute` to fire immediately and stay muted

**The Solution**: Removed all manual track manipulation. The browser controls remote track mute/unmute automatically.

## ✅ Fix Applied to Hook

✔ Removed `track.enabled = true` manipulation from `ontrack` handler
✔ Simplified ontrack to only add tracks to MediaStream
✔ Let browser handle mute/unmute natively
✔ Return NEW MediaStream object for React re-renders

## 🎯 Required UI Component Changes

Your consuming component MUST do this for video element:

```tsx
const [callState] = useWebRTCCall(...);
const remoteVideoRef = useRef<HTMLVideoElement>(null);

// Force playback of remote stream
useEffect(() => {
  const video = remoteVideoRef.current;
  if (!video || !callState.remoteStream) return;

  video.srcObject = callState.remoteStream;

  // CRITICAL: Force play() to enable audio
  const p = video.play();
  if (p !== undefined) {
    p.catch(err => {
      console.warn('[UI] Autoplay blocked, retrying...', err);
      setTimeout(() => video.play().catch(() => {}), 500);
    });
  }
}, [callState.remoteStream]);

// Video element must be:
return (
  <video
    ref={remoteVideoRef}
    autoPlay
    playsInline
    muted={false}  // MUST be false for audio
    style={{ width: '100%', height: '100%' }}
  />
);
```

## 🔑 Key Points

1. **`muted={false}`** on video element enables BOTH video AND audio playback
2. **`video.play()`** must be called explicitly after attaching srcObject
3. **`remoteStream` changes** trigger effect to re-attach and play
4. **Never manually control remote track mute** - browser does this

## 📊 Expected Log Flow

```
[WebRTC] Remote track received: { kind: 'video', readyState: 'live', muted: false }
[WebRTC] Added remote track: video, Total tracks: 1
[WebRTC] Remote track received: { kind: 'audio', readyState: 'live', muted: false }
[WebRTC] Added remote track: audio, Total tracks: 2
[UI] Video playing successfully
```

You should NEVER see:
- `Video track enabled` (removed)
- `Remote track muted: video` (unless network fails)

## ✔ Testing Checklist

- [ ] Remote video appears on screen
- [ ] Remote audio is audible
- [ ] Works on Chrome/Firefox/Safari
- [ ] Works on mobile
- [ ] Second call after end works
- [ ] Toggle audio/video on local side (mute button)

This is the final piece - hook is now fixed, UI component just needs to attach and play!
