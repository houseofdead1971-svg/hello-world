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
    <div className="w-full h-full flex flex-col gap-2 sm:gap-4 p-2 sm:p-4 min-h-0 pb-[env(safe-area-inset-bottom)]">
      {/* Video Container - Responsive aspect ratio */}
      <div className="flex-1 relative bg-black rounded-xl overflow-hidden min-h-[180px] sm:min-h-[300px] aspect-video sm:aspect-auto">
        {/* Remote Video */}
        {remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
                <Phone className="w-8 h-8 sm:w-10 sm:h-10 text-primary animate-pulse" />
              </div>
              <p className="text-white font-medium text-sm sm:text-lg">
                {isCalling ? 'Calling...' : isAnswering ? 'Incoming Call' : 'Ready to Connect'}
              </p>
              <p className="text-xs sm:text-sm text-gray-400 truncate max-w-[200px] sm:max-w-xs mx-auto">{doctorName}</p>
            </div>
          </div>
        )}

        {/* Local Video - PIP with better touch target */}
        <div
          className={cn(
            'absolute rounded-xl overflow-hidden border-2 border-primary shadow-lg cursor-pointer transition-all duration-300 active:scale-95',
            expandRemote 
              ? 'bottom-2 right-2 sm:bottom-4 sm:right-4 w-16 h-12 sm:w-28 sm:h-20' 
              : 'bottom-2 right-2 sm:bottom-4 sm:right-4 w-24 h-18 sm:w-40 sm:h-28'
          )}
          onClick={() => setExpandRemote(!expandRemote)}
        >
          {localStream ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-slate-800 flex items-center justify-center">
              <VideoOff className="w-4 h-4 text-gray-500" />
            </div>
          )}
        </div>

        {/* Call Status Badge */}
        {isCallActive && (
          <div className="absolute top-2 left-2 sm:top-4 sm:left-4 bg-green-500 text-white px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            Live
          </div>
        )}
      </div>

      {/* Controls */}
      <Card className="bg-card/95 backdrop-blur-sm border-border/50 flex-shrink-0 rounded-xl shadow-lg">
        <CardContent className="p-3 sm:p-4">
          {!isCallActive && !isCalling && !isAnswering ? (
            // Pre-Call State
            <div className="space-y-3">
              {error && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3">
                  <p className="text-xs font-semibold text-destructive flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                    Connection Error
                  </p>
                  <p className="text-xs text-destructive/80 mt-1">{error}</p>
                </div>
              )}

              {/* Camera Toggle - Larger touch target */}
              <label className="flex items-center gap-3 bg-muted/50 p-3 rounded-xl cursor-pointer active:bg-muted transition-colors">
                <div className={cn(
                  "w-10 h-6 rounded-full relative transition-colors",
                  cameraOffMode ? "bg-muted-foreground/30" : "bg-primary"
                )}>
                  <div className={cn(
                    "absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform",
                    cameraOffMode ? "left-1" : "left-5"
                  )} />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium block">{cameraOffMode ? 'Camera Off' : 'Camera On'}</span>
                  <span className="text-xs text-muted-foreground">{cameraOffMode ? 'Audio only' : 'Video enabled'}</span>
                </div>
                <input
                  type="checkbox"
                  checked={!cameraOffMode}
                  onChange={(e) => setCameraOffMode(!e.target.checked)}
                  className="sr-only"
                />
              </label>

              {/* Start Call Button - Large touch target */}
              <Button
                onClick={() => {
                  if (cameraOffMode) {
                    setVideoEnabled(false);
                  }
                  onStartCall();
                }}
                className="w-full h-12 sm:h-11 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white gap-2 text-base font-semibold rounded-xl shadow-lg"
                disabled={isCalling || !!error}
              >
                <Phone className="h-5 w-5" />
                {userRole === 'doctor' ? 'Start Call' : 'Call Doctor'}
              </Button>

              {/* Quick tips - collapsible on mobile */}
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer font-medium py-1">Need help?</summary>
                <ul className="mt-2 space-y-1 pl-4 list-disc">
                  <li>Allow camera/mic when prompted</li>
                  <li>Close other video apps</li>
                  <li>Use stable WiFi connection</li>
                </ul>
              </details>
            </div>
          ) : isAnswering ? (
            // Incoming Call State
            <div className="space-y-3">
              {/* Incoming call header with animation */}
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 text-center">
                <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                  <Phone className="w-6 h-6 text-primary" />
                </div>
                <p className="font-semibold text-primary text-sm">Incoming Call</p>
                <p className="text-xs text-muted-foreground truncate">{doctorName}</p>
              </div>

              {/* Camera Toggle */}
              <label className="flex items-center gap-3 bg-muted/50 p-3 rounded-xl cursor-pointer active:bg-muted transition-colors">
                <div className={cn(
                  "w-10 h-6 rounded-full relative transition-colors",
                  cameraOffMode ? "bg-muted-foreground/30" : "bg-primary"
                )}>
                  <div className={cn(
                    "absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform",
                    cameraOffMode ? "left-1" : "left-5"
                  )} />
                </div>
                <span className="text-sm font-medium">{cameraOffMode ? 'Camera Off' : 'Camera On'}</span>
                <input
                  type="checkbox"
                  checked={!cameraOffMode}
                  onChange={(e) => setCameraOffMode(!e.target.checked)}
                  className="sr-only"
                />
              </label>

              {/* Answer/Decline - Large touch targets */}
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    if (cameraOffMode) setVideoEnabled(false);
                    onAnswerCall();
                  }}
                  className="flex-1 h-12 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white gap-2 text-base font-semibold rounded-xl shadow-lg"
                >
                  <Phone className="h-5 w-5" />
                  Answer
                </Button>
                <Button
                  onClick={onEndCall}
                  className="flex-1 h-12 bg-destructive hover:bg-destructive/90 active:bg-destructive/80 text-white gap-2 text-base font-semibold rounded-xl shadow-lg"
                >
                  <PhoneOff className="h-5 w-5" />
                  Decline
                </Button>
              </div>
            </div>
          ) : isCalling ? (
            // Calling State
            <div className="space-y-3">
              <div className="text-center py-4">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-primary/20 flex items-center justify-center">
                  <Phone className="w-8 h-8 text-primary animate-bounce" />
                </div>
                <p className="font-semibold text-foreground text-base truncate px-4">{doctorName}</p>
                <p className="text-sm text-muted-foreground mt-1">Ringing...</p>
              </div>

              <Button
                onClick={onEndCall}
                className="w-full h-12 bg-destructive hover:bg-destructive/90 active:bg-destructive/80 text-white gap-2 text-base font-semibold rounded-xl shadow-lg"
              >
                <PhoneOff className="h-5 w-5" />
                Cancel Call
              </Button>
            </div>
          ) : (
            // Active Call State
            <div className="space-y-3">
              {/* Connected status */}
              <p className="text-center text-xs text-muted-foreground truncate">
                Connected with <span className="font-medium text-foreground">{doctorName}</span>
              </p>

              {/* Media Controls - Large circular buttons for easy touch */}
              <div className="flex gap-3 justify-center">
                <Button
                  onClick={handleToggleAudio}
                  variant="outline"
                  className={cn(
                    "w-14 h-14 sm:w-12 sm:h-12 rounded-full p-0 transition-all",
                    !audioEnabled && "bg-destructive/10 border-destructive text-destructive hover:bg-destructive/20"
                  )}
                >
                  {audioEnabled ? (
                    <Mic className="h-5 w-5 sm:h-5 sm:w-5" />
                  ) : (
                    <MicOff className="h-5 w-5 sm:h-5 sm:w-5" />
                  )}
                </Button>

                <Button
                  onClick={onEndCall}
                  className="w-14 h-14 sm:w-12 sm:h-12 rounded-full p-0 bg-destructive hover:bg-destructive/90 active:bg-destructive/80 shadow-lg"
                >
                  <PhoneOff className="h-5 w-5 sm:h-5 sm:w-5 text-white" />
                </Button>

                <Button
                  onClick={handleToggleVideo}
                  variant="outline"
                  className={cn(
                    "w-14 h-14 sm:w-12 sm:h-12 rounded-full p-0 transition-all",
                    !videoEnabled && "bg-destructive/10 border-destructive text-destructive hover:bg-destructive/20"
                  )}
                >
                  {videoEnabled ? (
                    <Video className="h-5 w-5 sm:h-5 sm:w-5" />
                  ) : (
                    <VideoOff className="h-5 w-5 sm:h-5 sm:w-5" />
                  )}
                </Button>
              </div>

              {/* Appointment ID - Compact */}
              <button
                onClick={handleCopyAppointmentId}
                className="w-full flex items-center justify-center gap-2 bg-muted/50 hover:bg-muted rounded-lg py-2 px-3 transition-colors"
              >
                <span className="text-xs text-muted-foreground">ID:</span>
                <span className="font-mono text-xs font-medium truncate">{appointmentId.slice(0, 8)}</span>
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                )}
              </button>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
};
