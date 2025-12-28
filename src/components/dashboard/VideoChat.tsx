import { useState, useRef, useEffect } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
}

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
}: VideoChatProps) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [cameraOffMode, setCameraOffMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandRemote, setExpandRemote] = useState(false);

  // Connect local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Connect remote stream to video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

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

  return (
    <div className="w-full h-full flex flex-col gap-4 p-4 min-h-0">
      {/* Video Container */}
      <div className="flex-1 relative bg-black rounded-lg overflow-hidden min-h-[200px] sm:min-h-[300px]">
        {/* Remote Video */}
        {remoteStream && isCallActive ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4">
            <div className="text-center">
              <div className="text-3xl sm:text-4xl mb-2 sm:mb-4">📞</div>
              <p className="text-white mb-1 sm:mb-2 text-sm sm:text-base">
                {isCalling ? 'Calling...' : isAnswering ? 'Ready to answer' : 'Waiting for connection'}
              </p>
              <p className="text-xs sm:text-sm text-gray-400 truncate max-w-xs">{doctorName}</p>
            </div>
          </div>
        )}

        {/* Local Video - Picture in Picture */}
        <div
          className={cn(
            'absolute rounded-lg overflow-hidden border-2 border-primary cursor-pointer transition-all hover:scale-105',
            expandRemote 
              ? 'bottom-2 right-2 sm:bottom-4 sm:right-4 w-20 h-16 sm:w-32 sm:h-24' 
              : 'bottom-2 right-2 sm:bottom-4 sm:right-4 w-24 h-20 sm:w-48 sm:h-36'
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

        {/* Call Status Badge */}
        {isCallActive && (
          <div className="absolute top-2 left-2 sm:top-4 sm:left-4 bg-green-500/80 text-white px-2 py-1 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-semibold animate-pulse">
            Call Active
          </div>
        )}
      </div>

      {/* Controls */}
      <Card className="bg-gradient-to-r from-card to-card/50 border-primary/20 flex-shrink-0 flex flex-col max-h-[40vh] sm:max-h-[35vh] overflow-hidden">
        <CardContent className="pt-4 sm:pt-6 overflow-y-auto flex-1">
          {!isCallActive && !isCalling && !isAnswering ? (
            // Pre-Call State
            <div className="space-y-3 sm:space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 sm:p-3">
                  <p className="text-xs sm:text-sm font-medium text-red-600 mb-1 sm:mb-2">❌ Error:</p>
                  <p className="text-xs sm:text-sm text-red-700">{error}</p>
                  <p className="text-xs text-red-600 mt-1 sm:mt-2 font-medium">
                    💡 Solution: Check if your camera/microphone are enabled and not in use by another app. Refresh and try again.
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
                  <span className="text-xs sm:text-sm font-medium truncate">{cameraOffMode ? '📹 Camera OFF' : '📹 Camera ON'}</span>
                </label>
                <p className="text-xs text-muted-foreground px-1">
                  {cameraOffMode ? 'Turn camera on during call' : 'Share your camera with doctor'}
                </p>
              </div>

              <Button
                onClick={() => {
                  if (cameraOffMode) {
                    setVideoEnabled(false);
                  }
                  onStartCall();
                }}
                className="w-full bg-green-600 hover:bg-green-700 text-white gap-2 text-sm sm:text-base"
                disabled={isCalling || !!error}
              >
                <Phone className="h-4 w-4" />
                {isCalling ? 'Connecting...' : userRole === 'doctor' ? 'Start Call' : 'Call Doctor'}
              </Button>

              {userRole === 'patient' && (
                <div className="text-xs sm:text-sm text-muted-foreground text-center">
                  <p>Click above to initiate the video call</p>
                  <p className="text-xs mt-0.5">Microphone must be enabled</p>
                </div>
              )}

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 sm:p-3 text-xs sm:text-sm">
                <p className="font-medium text-blue-600 mb-1 sm:mb-2">📋 Permission:</p>
                <ul className="text-xs space-y-0.5 text-blue-700">
                  <li>✓ Allow camera/microphone when asked</li>
                  <li>✓ Can join with camera OFF</li>
                  <li>✓ Check browser settings if blocked</li>
                  <li>✓ Close other camera apps</li>
                  <li>✓ Toggle during call</li>
                </ul>
              </div>
            </div>
          ) : isAnswering ? (
            // Incoming Call State - with camera preference setup
            <div className="space-y-3 sm:space-y-4">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 sm:p-4">
                <p className="text-center font-semibold mb-2 sm:mb-4 text-blue-500 text-sm sm:text-base truncate">
                  📞 Incoming call from {doctorName}
                </p>
                <p className="text-center text-xs sm:text-sm text-blue-600">
                  Check notifications above to answer or decline
                </p>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 p-2 sm:p-3 rounded-lg cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition">
                  <input
                    type="checkbox"
                    checked={cameraOffMode}
                    onChange={(e) => setCameraOffMode(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-xs sm:text-sm font-medium truncate">{cameraOffMode ? '📹 Camera OFF' : '📹 Camera ON'}</span>
                </label>
                <p className="text-xs text-muted-foreground px-1">
                  {cameraOffMode ? 'Join without sharing' : 'Share your camera'}
                </p>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 sm:p-3 text-xs sm:text-sm">
                <p className="font-medium text-amber-600 mb-1 sm:mb-2">⏫ Answer Call:</p>
                <p className="text-xs text-amber-700">
                  Use the notification banner above to answer or decline.
                </p>
              </div>
            </div>
          ) : isCalling ? (
            // Calling State
            <div className="space-y-3 sm:space-y-4">
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 sm:p-4">
                <p className="text-center font-semibold text-yellow-600 animate-pulse text-sm sm:text-base truncate">
                  Calling {doctorName}...
                </p>
                <p className="text-center text-xs text-yellow-600 mt-1 sm:mt-2">
                  Waiting for {userRole === 'doctor' ? 'patient' : 'doctor'} to answer...
                </p>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 sm:p-3 text-xs sm:text-sm">
                <p className="font-medium text-blue-600 mb-1 sm:mb-2">⏳ Waiting:</p>
                <ul className="text-xs space-y-0.5 text-blue-700">
                  <li>✓ They need to open the call</li>
                  <li>✓ Click "Answer" to connect</li>
                  <li>✓ Timeout in 30 seconds</li>
                </ul>
              </div>

              <Button
                onClick={onEndCall}
                className="w-full bg-red-600 hover:bg-red-700 text-white gap-2 text-sm sm:text-base"
              >
                <PhoneOff className="h-4 w-4" />
                Cancel
              </Button>
            </div>
          ) : (
            // Active Call State
            <div className="space-y-3 sm:space-y-4">
              {/* Call Duration & Info */}
              <div className="text-center mb-2 sm:mb-4">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Connected with {doctorName}</p>
              </div>

              {/* Media Controls */}
              <div className="flex gap-1 sm:gap-2 justify-center flex-wrap">
                <Button
                  onClick={handleToggleAudio}
                  variant={audioEnabled ? 'default' : 'destructive'}
                  size="sm"
                  className="gap-1 text-xs sm:text-sm sm:size-lg flex-1 min-w-[80px]"
                >
                  {audioEnabled ? (
                    <>
                      <Mic className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Mute</span>
                      <span className="sm:hidden">Mute</span>
                    </>
                  ) : (
                    <>
                      <MicOff className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Unmute</span>
                      <span className="sm:hidden">Unmute</span>
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleToggleVideo}
                  variant={videoEnabled ? 'default' : 'destructive'}
                  size="sm"
                  className="gap-1 text-xs sm:text-sm sm:size-lg flex-1 min-w-[80px]"
                >
                  {videoEnabled ? (
                    <>
                      <Video className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Stop</span>
                      <span className="sm:hidden">Stop</span>
                    </>
                  ) : (
                    <>
                      <VideoOff className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Start</span>
                      <span className="sm:hidden">Start</span>
                    </>
                  )}
                </Button>

                <Button
                  onClick={onEndCall}
                  variant="destructive"
                  size="sm"
                  className="gap-1 text-xs sm:text-sm sm:size-lg flex-1 min-w-[80px]"
                >
                  <PhoneOff className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">End</span>
                  <span className="sm:hidden">End</span>
                </Button>
              </div>

              {/* Appointment ID */}
              <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-2 sm:p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Appointment ID</p>
                  <p className="font-mono text-xs sm:text-sm font-semibold truncate">{appointmentId.slice(0, 10)}...</p>
                </div>
                <Button
                  onClick={handleCopyAppointmentId}
                  size="sm"
                  variant="ghost"
                  className="gap-1 flex-shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
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
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-2 sm:p-3 text-xs sm:text-sm text-blue-900 dark:text-blue-200">
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
