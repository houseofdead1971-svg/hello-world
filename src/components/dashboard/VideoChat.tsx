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
    <div className="w-full h-full flex flex-col gap-4 p-4">
      {/* Video Container */}
      <div className="flex-1 relative bg-black rounded-lg overflow-hidden min-h-[400px]">
        {/* Remote Video */}
        {remoteStream && isCallActive ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
            <div className="text-center">
              <div className="text-4xl mb-4">📞</div>
              <p className="text-white mb-2">
                {isCalling ? 'Calling...' : isAnswering ? 'Ready to answer' : 'Waiting for connection'}
              </p>
              <p className="text-sm text-gray-400">{doctorName}</p>
            </div>
          </div>
        )}

        {/* Local Video - Picture in Picture */}
        <div
          className={cn(
            'absolute bottom-4 right-4 rounded-lg overflow-hidden border-2 border-primary cursor-pointer transition-all hover:scale-105',
            expandRemote ? 'w-32 h-24' : 'w-48 h-36'
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
          <div className="absolute top-4 left-4 bg-green-500/80 text-white px-3 py-1 rounded-full text-sm font-semibold animate-pulse">
            Call Active
          </div>
        )}
      </div>

      {/* Controls */}
      <Card className="bg-gradient-to-r from-card to-card/50 border-primary/20 flex flex-col overflow-hidden">
        <CardContent className="pt-6 overflow-y-auto flex-1">
          {!isCallActive && !isCalling && !isAnswering ? (
            // Pre-Call State
            <div className="space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-sm font-medium text-red-600 mb-2">❌ Error:</p>
                  <p className="text-sm text-red-700">{error}</p>
                  <p className="text-xs text-red-600 mt-2 font-medium">
                    💡 Solution: Check if your camera/microphone are enabled and not in use by another app. Refresh and try again.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 p-3 rounded-lg cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition">
                  <input
                    type="checkbox"
                    checked={cameraOffMode}
                    onChange={(e) => setCameraOffMode(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">{cameraOffMode ? '📹 Camera OFF' : '📹 Camera ON'}</span>
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
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2"
                  disabled={isCalling || !!error}
                >
                  <Phone className="h-4 w-4" />
                  {isCalling ? 'Connecting...' : userRole === 'doctor' ? 'Start Call' : 'Call Doctor'}
                </Button>
              </div>

              {userRole === 'patient' && (
                <div className="text-sm text-muted-foreground text-center">
                  <p>Click the button above to initiate the video call</p>
                  <p className="text-xs mt-1">Your microphone must be enabled</p>
                </div>
              )}

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-sm">
                <p className="font-medium text-blue-600 mb-2">📋 Permission Instructions:</p>
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
            // Incoming Call State - with camera preference setup
            <div className="space-y-4">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <p className="text-center font-semibold mb-4 text-blue-500">
                  📞 Incoming call from {doctorName}
                </p>
                <p className="text-center text-sm text-blue-600">
                  Check your notifications at the top of the screen to answer or decline
                </p>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 p-3 rounded-lg cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition">
                  <input
                    type="checkbox"
                    checked={cameraOffMode}
                    onChange={(e) => setCameraOffMode(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">{cameraOffMode ? '📹 Camera OFF' : '📹 Camera ON'}</span>
                </label>
                <p className="text-xs text-muted-foreground px-1">
                  {cameraOffMode ? 'Join without sharing video' : 'Share your camera with the doctor'}
                </p>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm">
                <p className="font-medium text-amber-600 mb-2">⏫ Answer Call Buttons:</p>
                <p className="text-xs text-amber-700">
                  Use the green and red buttons in the notification banner at the top of your screen to answer or decline this incoming call.
                </p>
              </div>
            </div>
          ) : isCalling ? (
            // Calling State
            <div className="space-y-4">
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                <p className="text-center font-semibold text-yellow-600 animate-pulse">
                  Calling {doctorName}...
                </p>
                <p className="text-center text-xs text-yellow-600 mt-2">
                  Waiting for {userRole === 'doctor' ? 'patient' : 'doctor'} to answer...
                </p>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-sm">
                <p className="font-medium text-blue-600 mb-2">⏳ Waiting for Response:</p>
                <ul className="text-xs space-y-1 text-blue-700">
                  <li>✓ {userRole === 'doctor' ? 'Patient' : 'Doctor'} needs to open the call dialog</li>
                  <li>✓ They will see your incoming call</li>
                  <li>✓ They need to click "Answer Call" to connect</li>
                  <li>✓ Call will timeout in 30 seconds if not answered</li>
                </ul>
              </div>

              <Button
                onClick={onEndCall}
                className="w-full bg-red-600 hover:bg-red-700 text-white gap-2"
              >
                <PhoneOff className="h-4 w-4" />
                Cancel
              </Button>
            </div>
          ) : (
            // Active Call State
            <div className="space-y-4">
              {/* Call Duration & Info */}
              <div className="text-center mb-4">
                <p className="text-sm text-muted-foreground">Connected with {doctorName}</p>
              </div>

              {/* Media Controls */}
              <div className="flex gap-2 justify-center">
                <Button
                  onClick={handleToggleAudio}
                  variant={audioEnabled ? 'default' : 'destructive'}
                  size="lg"
                  className="gap-2"
                >
                  {audioEnabled ? (
                    <>
                      <Mic className="h-4 w-4" />
                      Mute
                    </>
                  ) : (
                    <>
                      <MicOff className="h-4 w-4" />
                      Unmute
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleToggleVideo}
                  variant={videoEnabled ? 'default' : 'destructive'}
                  size="lg"
                  className="gap-2"
                >
                  {videoEnabled ? (
                    <>
                      <Video className="h-4 w-4" />
                      Stop Video
                    </>
                  ) : (
                    <>
                      <VideoOff className="h-4 w-4" />
                      Start Video
                    </>
                  )}
                </Button>

                <Button
                  onClick={onEndCall}
                  variant="destructive"
                  size="lg"
                  className="gap-2"
                >
                  <PhoneOff className="h-4 w-4" />
                  End Call
                </Button>
              </div>

              {/* Appointment ID */}
              <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Appointment ID</p>
                  <p className="font-mono text-sm font-semibold">{appointmentId.slice(0, 12)}...</p>
                </div>
                <Button
                  onClick={handleCopyAppointmentId}
                  size="sm"
                  variant="ghost"
                  className="gap-1"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-green-500" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
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
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-900 dark:text-blue-200">
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
