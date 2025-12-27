import { useState, useRef, useEffect } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Copy, Check, Maximize, Minimize, Settings, Wifi, WifiOff, Signal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface VideoChatProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isCallActive: boolean;
  isCalling: boolean;
  isAnswering: boolean;
  onStartCall: () => Promise<void>;
  onAnswerCall: () => Promise<void>;
  onEndCall: () => void;
  onToggleAudio: (enabled: boolean) => void;
  onToggleVideo: (enabled: boolean) => void;
  doctorName: string;
  appointmentId: string;
  userRole: 'doctor' | 'patient';
  error?: string | null;
  callDuration?: number;
  connectionQuality?: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
  availableCameras?: MediaDeviceInfo[];
  selectedCameraId?: string | null;
  onSwitchCamera?: (deviceId: string) => Promise<void>;
}

// Format duration as MM:SS
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Get connection quality color and icon
const getQualityDisplay = (quality: string) => {
  switch (quality) {
    case 'excellent':
      return { color: 'text-green-500', icon: Signal, label: 'Excellent' };
    case 'good':
      return { color: 'text-green-400', icon: Wifi, label: 'Good' };
    case 'fair':
      return { color: 'text-yellow-500', icon: Wifi, label: 'Fair' };
    case 'poor':
      return { color: 'text-red-500', icon: WifiOff, label: 'Poor' };
    default:
      return { color: 'text-gray-400', icon: Wifi, label: 'Unknown' };
  }
};

export const VideoChat = ({
  localStream,
  remoteStream,
  isCallActive,
  isCalling,
  isAnswering,
  onStartCall,
  onAnswerCall,
  onEndCall,
  onToggleAudio,
  onToggleVideo,
  doctorName,
  appointmentId,
  userRole,
  error,
  callDuration = 0,
  connectionQuality = 'unknown',
  availableCameras = [],
  selectedCameraId = null,
  onSwitchCamera,
}: VideoChatProps) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [cameraOffMode, setCameraOffMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandRemote, setExpandRemote] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Connect local stream to video element
  useEffect(() => {
    const videoElement = localVideoRef.current;
    if (!videoElement) return;

    if (localStream) {
      console.log('[VideoChat] Setting local video stream');
      videoElement.srcObject = localStream;
      videoElement.muted = true; // Mute local video to prevent feedback
      videoElement.play().catch((err) => {
        console.warn('[VideoChat] Local video autoplay blocked:', err);
      });
    } else {
      videoElement.srcObject = null;
    }
  }, [localStream]);

  // Connect remote stream to video element - CRITICAL FIX
  useEffect(() => {
    const videoElement = remoteVideoRef.current;
    if (!videoElement) return;

    // Use remoteStream from props (which comes from state, but we'll ensure srcObject is set)
    if (remoteStream) {
      console.log('[VideoChat] 🎥 Setting remote video stream:', {
        streamId: remoteStream.id,
        active: remoteStream.active,
        tracks: remoteStream.getTracks().map(t => ({
          kind: t.kind,
          enabled: t.enabled,
          readyState: t.readyState,
        })),
      });

      // CRITICAL: Always set srcObject when remoteStream changes
      // React re-renders can break MediaStream references, so we ALWAYS reassign
      console.log('[VideoChat] Setting srcObject, current:', videoElement.srcObject?.id, 'new:', remoteStream.id);
      videoElement.srcObject = remoteStream;
      
      // Verify it was set
      if (videoElement.srcObject !== remoteStream) {
        console.error('[VideoChat] ❌ Failed to set srcObject!');
        // Force set again
        setTimeout(() => {
          if (videoElement && remoteStream) {
            videoElement.srcObject = remoteStream;
            console.log('[VideoChat] Retried setting srcObject');
          }
        }, 100);
      } else {
        console.log('[VideoChat] ✅ srcObject set successfully');
      }

      // Ensure all tracks are enabled
      remoteStream.getTracks().forEach(track => {
        if (!track.enabled) {
          console.warn('[VideoChat] Enabling disabled remote track:', track.kind);
          track.enabled = true;
        }
      });
      
      // CRITICAL: Configure video element for playback
      videoElement.muted = false; // Unmute for remote audio
      videoElement.volume = 1.0;
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      
      // CRITICAL: Force play - browsers require explicit play() call
      const playVideo = async () => {
        try {
          await videoElement.play();
          console.log('[VideoChat] ✅ Remote video playing successfully');
        } catch (error: any) {
          console.error('[VideoChat] ❌ Error playing remote video:', error);
          // If autoplay is blocked, try again after a short delay
          if (error.name === 'NotAllowedError' || error.name === 'NotSupportedError') {
            console.warn('[VideoChat] Autoplay blocked, will retry...');
            setTimeout(() => {
              videoElement.play().catch(err => {
                console.error('[VideoChat] ❌ Retry play failed:', err);
              });
            }, 500);
          }
        }
      };

      // Handle metadata loaded - play when ready
      const handleLoadedMetadata = () => {
        console.log('[VideoChat] ✅ Remote video metadata loaded');
        playVideo();
      };

      // Handle play event
      const handlePlay = () => {
        console.log('[VideoChat] ✅ Remote video started playing');
      };

      // Handle error
      const handleError = (e: Event) => {
        console.error('[VideoChat] ❌ Remote video error:', e);
      };

      // Monitor track events
      const trackHandlers: Array<{ track: MediaStreamTrack }> = [];
      remoteStream.getTracks().forEach((track) => {
        track.onended = () => {
          console.log('[VideoChat] ⚠️ Remote track ended:', track.kind);
        };
        track.onmute = () => {
          console.warn('[VideoChat] ⚠️ Remote track muted:', track.kind);
          if (track.kind === 'audio') {
            track.enabled = true;
          }
        };
        track.onunmute = () => {
          console.log('[VideoChat] ✅ Remote track unmuted:', track.kind);
        };
        trackHandlers.push({ track });
      });

      // Add event listeners
      videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
      videoElement.addEventListener('play', handlePlay);
      videoElement.addEventListener('error', handleError);

      // Try to play immediately
      playVideo();

      // Periodic check to ensure srcObject is still set (handles edge cases)
      const checkInterval = setInterval(() => {
        if (videoElement && remoteStream) {
          if (videoElement.srcObject !== remoteStream) {
            console.warn('[VideoChat] ⚠️ srcObject was lost, reattaching...');
            videoElement.srcObject = remoteStream;
            playVideo();
          }
        }
      }, 2000); // Check every 2 seconds

      // Cleanup function
      return () => {
        clearInterval(checkInterval);
        videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
        videoElement.removeEventListener('play', handlePlay);
        videoElement.removeEventListener('error', handleError);
        trackHandlers.forEach(({ track }) => {
          track.onended = null;
          track.onmute = null;
          track.onunmute = null;
        });
      };
    } else {
      // Clear video when stream is removed
      console.log('[VideoChat] Clearing remote video');
      videoElement.srcObject = null;
    }
  }, [remoteStream]); // Re-run whenever remoteStream changes

  // Handle fullscreen
  const toggleFullscreen = () => {
    if (!videoContainerRef.current) return;

    if (!isFullscreen) {
      if (videoContainerRef.current.requestFullscreen) {
        videoContainerRef.current.requestFullscreen();
      } else if ((videoContainerRef.current as any).webkitRequestFullscreen) {
        (videoContainerRef.current as any).webkitRequestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleToggleAudio = () => {
    const newState = !audioEnabled;
    setAudioEnabled(newState);
    onToggleAudio(newState);
  };

  const handleToggleVideo = () => {
    const newState = !videoEnabled;
    setVideoEnabled(newState);
    onToggleVideo(newState);
  };

  const handleCopyAppointmentId = () => {
    navigator.clipboard.writeText(appointmentId);
    setCopied(true);
    toast.success('Appointment ID copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSwitchCamera = async (deviceId: string) => {
    if (onSwitchCamera) {
      try {
        await onSwitchCamera(deviceId);
        setShowSettings(false);
      } catch (error) {
        console.error('Failed to switch camera:', error);
      }
    }
  };

  const qualityDisplay = getQualityDisplay(connectionQuality);
  const QualityIcon = qualityDisplay.icon;

  return (
    <div className="w-full h-full flex flex-col gap-2 sm:gap-4 p-2 sm:p-4 overflow-y-auto">
      {/* Video Container */}
      <div 
        ref={videoContainerRef}
        className="flex-1 relative bg-black rounded-lg overflow-hidden min-h-[250px] sm:min-h-[400px] flex-shrink-0"
      >
        {/* Remote Video */}
        {remoteStream && isCallActive ? (
          <>
            <video
              key={`remote-${remoteStream.id}-${remoteStream.getTracks().map(t => `${t.kind}-${t.id}`).sort().join('-')}`}
              ref={remoteVideoRef}
              autoPlay
              playsInline
              muted={false}
              className="w-full h-full object-cover"
              onLoadedMetadata={() => {
                console.log('[VideoChat] ✅ Remote video metadata loaded, playing...');
                if (remoteVideoRef.current) {
                  remoteVideoRef.current.play().catch(err => {
                    console.error('[VideoChat] ❌ Error auto-playing remote video:', err);
                  });
                }
              }}
              onPlay={() => {
                console.log('[VideoChat] ✅ Remote video is playing');
              }}
              onError={(e) => {
                console.error('[VideoChat] ❌ Remote video error:', e);
              }}
            />
            {/* Debug: Show track info */}
            {process.env.NODE_ENV === 'development' && (
              <div className="absolute top-2 left-2 bg-black/50 text-white text-xs p-1 rounded z-10">
                Tracks: {remoteStream.getTracks().length} ({remoteStream.getVideoTracks().length} video, {remoteStream.getAudioTracks().length} audio)
                <br />
                Stream ID: {remoteStream.id}
                <br />
                Has srcObject: {remoteVideoRef.current?.srcObject ? 'Yes' : 'No'}
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
            <div className="text-center px-4">
              <div className="text-4xl sm:text-6xl mb-4">📞</div>
              <p className="text-white text-sm sm:text-base mb-2">
                {isCalling ? 'Calling...' : isAnswering ? 'Ready to answer' : 'Waiting for connection'}
              </p>
              <p className="text-xs sm:text-sm text-gray-400">{doctorName}</p>
            </div>
          </div>
        )}

        {/* Local Video - Picture in Picture */}
        <div
          className={cn(
            'absolute bottom-2 right-2 sm:bottom-4 sm:right-4 rounded-lg overflow-hidden border-2 border-primary cursor-pointer transition-all hover:scale-105',
            expandRemote ? 'w-24 h-18 sm:w-32 sm:h-24' : 'w-32 h-24 sm:w-48 sm:h-36'
          )}
          onClick={() => setExpandRemote(!expandRemote)}
        >
          {localStream && (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          )}
          {!localStream && (
            <div className="w-full h-full bg-slate-700 flex items-center justify-center">
              <span className="text-xs text-gray-400">Camera off</span>
            </div>
          )}
        </div>

        {/* Top Status Bar */}
        {isCallActive && (
          <div className="absolute top-2 left-2 sm:top-4 sm:left-4 flex flex-col gap-2">
            <div className="bg-green-500/80 text-white px-2 py-1 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-semibold animate-pulse">
              Call Active
            </div>
            {callDuration > 0 && (
              <div className="bg-black/60 text-white px-2 py-1 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-mono">
                {formatDuration(callDuration)}
              </div>
            )}
            {connectionQuality !== 'unknown' && (
              <div className={cn(
                "bg-black/60 text-white px-2 py-1 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm flex items-center gap-1",
                qualityDisplay.color
              )}>
                <QualityIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">{qualityDisplay.label}</span>
              </div>
            )}
          </div>
        )}

        {/* Fullscreen Button */}
        {isCallActive && (
          <button
            onClick={toggleFullscreen}
            className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full transition-colors z-10"
            aria-label="Toggle fullscreen"
          >
            {isFullscreen ? (
              <Minimize className="h-4 w-4 sm:h-5 sm:w-5" />
            ) : (
              <Maximize className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
          </button>
        )}
      </div>

      {/* Controls */}
      <Card className="bg-gradient-to-r from-card to-card/50 border-primary/20 flex-shrink-0">
        <CardContent className="pt-4 sm:pt-6">
          {!isCallActive && !isCalling && !isAnswering ? (
            // Pre-Call State
            <div className="space-y-3 sm:space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 sm:p-3">
                  <p className="text-xs sm:text-sm font-medium text-red-600 mb-1 sm:mb-2">❌ Error:</p>
                  <p className="text-xs sm:text-sm text-red-700">{error}</p>
                  <p className="text-xs text-red-600 mt-1 sm:mt-2 font-medium">
                    💡 Solution: {
                      error.includes('in use') 
                        ? 'If testing on the same device, use different browsers (Chrome + Firefox) or close other tabs/windows using the camera. Refresh and try again.'
                        : error.includes('videoinput') || error.includes('video input') || error.includes('hardware error')
                        ? 'Camera hardware issue detected. Try: 1) Restart your browser, 2) Update camera drivers, 3) Unplug/replug USB camera, 4) Use a different camera if available, 5) Check Windows Device Manager for camera issues.'
                        : 'Check if your camera/microphone are enabled and not in use by another app. Refresh and try again.'
                    }
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 p-2 sm:p-3 rounded-lg cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition">
                  <input
                    type="checkbox"
                    checked={cameraOffMode}
                    onChange={(e) => setCameraOffMode(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-xs sm:text-sm font-medium">{cameraOffMode ? '📹 Camera OFF' : '📹 Camera ON'}</span>
                </label>
                <p className="text-xs text-muted-foreground px-1">
                  {cameraOffMode ? 'You can turn camera on during the call' : 'Turn camera off if you prefer not to share video'}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    if (cameraOffMode) {
                      setVideoEnabled(false);
                    }
                    onStartCall();
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2 text-sm sm:text-base py-2 sm:py-3"
                  disabled={isCalling || !!error}
                >
                  <Phone className="h-4 w-4 sm:h-5 sm:w-5" />
                  {isCalling ? 'Connecting...' : userRole === 'doctor' ? 'Start Call' : 'Call Doctor'}
                </Button>
              </div>

              {userRole === 'patient' && (
                <div className="text-xs sm:text-sm text-muted-foreground text-center">
                  <p>Click the button above to initiate the video call</p>
                  <p className="text-xs mt-1">Your microphone must be enabled</p>
                </div>
              )}

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 sm:p-3 text-xs sm:text-sm">
                <p className="font-medium text-blue-600 mb-1 sm:mb-2">📋 Permission Instructions:</p>
                <ul className="text-xs space-y-1 text-blue-700">
                  <li>✓ Click "Allow" when your browser asks for camera/microphone access</li>
                  <li>✓ You can join with camera OFF if you prefer</li>
                  <li>✓ Check your browser's permission settings if you see "blocked"</li>
                  <li>✓ Close other apps using your camera</li>
                  <li>✓ You can toggle camera/audio during the call</li>
                </ul>
              </div>
            </div>
          ) : isAnswering ? (
            // Incoming Call State
            <div className="space-y-3 sm:space-y-4">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 sm:p-4">
                <p className="text-center font-semibold mb-2 sm:mb-4 text-blue-500 text-sm sm:text-base">Incoming Call from {doctorName}</p>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 p-2 sm:p-3 rounded-lg cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition">
                  <input
                    type="checkbox"
                    checked={cameraOffMode}
                    onChange={(e) => setCameraOffMode(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-xs sm:text-sm font-medium">{cameraOffMode ? '📹 Camera OFF' : '📹 Camera ON'}</span>
                </label>
                <p className="text-xs text-muted-foreground px-1">
                  {cameraOffMode ? 'Join without sharing video' : 'Share your camera with the doctor'}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    if (cameraOffMode) {
                      setVideoEnabled(false);
                    }
                    onAnswerCall();
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2 text-sm sm:text-base py-2 sm:py-3"
                >
                  <Phone className="h-4 w-4 sm:h-5 sm:w-5" />
                  Answer Call
                </Button>
                <Button
                  onClick={onEndCall}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white gap-2 text-sm sm:text-base py-2 sm:py-3"
                >
                  <PhoneOff className="h-4 w-4 sm:h-5 sm:w-5" />
                  Decline
                </Button>
              </div>
            </div>
          ) : isCalling ? (
            // Calling State
            <div className="space-y-3 sm:space-y-4">
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 sm:p-4">
                <p className="text-center font-semibold text-yellow-600 animate-pulse text-sm sm:text-base">
                  Calling {doctorName}...
                </p>
                <p className="text-center text-xs text-yellow-600 mt-1 sm:mt-2">
                  Waiting for {userRole === 'doctor' ? 'patient' : 'doctor'} to answer...
                </p>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 sm:p-3 text-xs sm:text-sm">
                <p className="font-medium text-blue-600 mb-1 sm:mb-2">⏳ Waiting for Response:</p>
                <ul className="text-xs space-y-1 text-blue-700">
                  <li>✓ {userRole === 'doctor' ? 'Patient' : 'Doctor'} needs to open the call dialog</li>
                  <li>✓ They will see your incoming call</li>
                  <li>✓ They need to click "Answer Call" to connect</li>
                  <li>✓ Call will timeout in 30 seconds if not answered</li>
                </ul>
              </div>

              <Button
                onClick={onEndCall}
                className="w-full bg-red-600 hover:bg-red-700 text-white gap-2 text-sm sm:text-base py-2 sm:py-3"
              >
                <PhoneOff className="h-4 w-4 sm:h-5 sm:w-5" />
                Cancel
              </Button>
            </div>
          ) : (
            // Active Call State
            <div className="space-y-3 sm:space-y-4">
              {/* Call Duration & Info */}
              <div className="text-center mb-2 sm:mb-4">
                <p className="text-xs sm:text-sm text-muted-foreground">Connected with {doctorName}</p>
                {callDuration > 0 && (
                  <p className="text-lg sm:text-xl font-mono font-semibold mt-1">{formatDuration(callDuration)}</p>
                )}
              </div>

              {/* Media Controls */}
              <div className="flex gap-2 justify-center flex-wrap">
                <Button
                  onClick={handleToggleAudio}
                  variant={audioEnabled ? 'default' : 'destructive'}
                  size={isMobile ? 'default' : 'lg'}
                  className="gap-2 flex-1 sm:flex-initial min-w-[100px] sm:min-w-[120px] py-2 sm:py-3"
                >
                  {audioEnabled ? (
                    <>
                      <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
                      <span className="text-xs sm:text-sm">Mute</span>
                    </>
                  ) : (
                    <>
                      <MicOff className="h-4 w-4 sm:h-5 sm:w-5" />
                      <span className="text-xs sm:text-sm">Unmute</span>
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleToggleVideo}
                  variant={videoEnabled ? 'default' : 'destructive'}
                  size={isMobile ? 'default' : 'lg'}
                  className="gap-2 flex-1 sm:flex-initial min-w-[100px] sm:min-w-[120px] py-2 sm:py-3"
                >
                  {videoEnabled ? (
                    <>
                      <Video className="h-4 w-4 sm:h-5 sm:w-5" />
                      <span className="text-xs sm:text-sm">Stop Video</span>
                    </>
                  ) : (
                    <>
                      <VideoOff className="h-4 w-4 sm:h-5 sm:w-5" />
                      <span className="text-xs sm:text-sm">Start Video</span>
                    </>
                  )}
                </Button>

                {availableCameras.length > 1 && (
                  <Button
                    onClick={() => setShowSettings(!showSettings)}
                    variant="outline"
                    size={isMobile ? 'default' : 'lg'}
                    className="gap-2 flex-1 sm:flex-initial min-w-[100px] sm:min-w-[120px] py-2 sm:py-3"
                  >
                    <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="text-xs sm:text-sm">Camera</span>
                  </Button>
                )}

                <Button
                  onClick={onEndCall}
                  variant="destructive"
                  size={isMobile ? 'default' : 'lg'}
                  className="gap-2 flex-1 sm:flex-initial min-w-[100px] sm:min-w-[120px] py-2 sm:py-3"
                >
                  <PhoneOff className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="text-xs sm:text-sm">End Call</span>
                </Button>
              </div>

              {/* Camera Selection Dropdown - Mobile Friendly */}
              {showSettings && availableCameras.length > 1 && (
                <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-3">
                  <p className="text-xs sm:text-sm font-medium mb-2">Switch Camera:</p>
                  <Select
                    value={selectedCameraId || availableCameras[0]?.deviceId}
                    onValueChange={(value) => {
                      console.log('[VideoChat] Camera selection changed:', value);
                      handleSwitchCamera(value);
                    }}
                  >
                    <SelectTrigger className="w-full h-9 sm:h-10 text-xs sm:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px] z-50">
                      {availableCameras.map((camera) => (
                        <SelectItem 
                          key={camera.deviceId} 
                          value={camera.deviceId}
                          className="text-xs sm:text-sm py-2"
                        >
                          {camera.label || `Camera ${camera.deviceId.slice(0, 8)}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Appointment ID */}
              <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-2 sm:p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Appointment ID</p>
                  <p className="font-mono text-xs sm:text-sm font-semibold">{appointmentId.slice(0, 12)}...</p>
                </div>
                <Button
                  onClick={handleCopyAppointmentId}
                  size="sm"
                  variant="ghost"
                  className="gap-1"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                      <span className="text-xs">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="text-xs">Copy</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Message */}
      {!isCallActive && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-2 sm:p-3 text-xs sm:text-sm text-blue-900 dark:text-blue-200 flex-shrink-0">
          <p className="font-semibold mb-1">💡 Video Call Tips:</p>
          <ul className="list-disc list-inside space-y-0.5 text-xs">
            <li>Ensure your camera and microphone are working</li>
            <li>Use a stable internet connection</li>
            <li>Position yourself with good lighting</li>
            <li>The video will start once both parties are connected</li>
          </ul>
        </div>
      )}
    </div>
  );
};
