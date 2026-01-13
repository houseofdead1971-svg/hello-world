import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { VideoChat } from './VideoChat';
import { IncomingCallNotification } from './IncomingCallNotification';
import { useWebRTCCall } from '@/hooks/use-webrtc-call';
import { toast } from 'sonner';

interface VideoChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  userRole: 'doctor' | 'patient';
  consultationType: string;
}

export const VideoChatDialog = ({
  isOpen,
  onClose,
  appointmentId,
  patientId,
  doctorId,
  doctorName,
  userRole,
  consultationType,
}: VideoChatDialogProps) => {
  const [showChat, setShowChat] = useState(false);
  const currentUserId = userRole === 'doctor' ? doctorId : patientId;
  const remoteUserId = userRole === 'doctor' ? patientId : doctorId;

  const [callState, callActions] = useWebRTCCall(
    appointmentId,
    currentUserId,
    userRole,
    remoteUserId
  );

  // Only show video chat if consultation is online
  useEffect(() => {
    if (isOpen && consultationType !== 'online') {
      toast.error('This is an offline appointment. Video chat is not available.');
      onClose();
    }
  }, [isOpen, consultationType, onClose]);

  const handleClose = () => {
    if (callState.isCallActive || callState.isCalling) {
      if (window.confirm('Are you sure you want to end the call?')) {
        callActions.endCall();
        setShowChat(false);
        onClose();
      }
    } else {
      callActions.dismissIncomingCall();
      setShowChat(false);
      onClose();
    }
  };

  const handleAnswerFromNotification = async () => {
    // Unlock audio playback with user gesture
    document.querySelectorAll('video').forEach(v => {
      v.muted = false;
      v.play().catch(() => {});
    });
    await callActions.answerCall();
  };

  const handleDeclineFromNotification = () => {
    callActions.endCall();
  };

  if (consultationType !== 'online') {
    return null;
  }

  // Show incoming call notification when there's an incoming call and dialog is open
  const showIncomingNotification = isOpen && callState.incomingCall && callState.isAnswering && !callState.isCallActive;

  return (
    <>
      {/* Enhanced Incoming Call Notification */}
      <IncomingCallNotification
        callerName={callState.callerName || doctorName}
        onAnswer={handleAnswerFromNotification}
        onDecline={handleDeclineFromNotification}
        isVisible={showIncomingNotification}
      />

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-5xl w-[95vw] sm:h-[90vh] h-[95vh] flex flex-col p-4 sm:p-6">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center justify-between pr-8">
              <span className="text-lg sm:text-xl lg:text-2xl">Video Appointment with {doctorName}</span>
              {callState.isCallActive && (
                <span className="text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-1.5 bg-green-500/20 text-green-500 rounded-full animate-pulse font-medium">
                  🔴 Live
                </span>
              )}
              {callState.isCalling && !callState.isCallActive && (
                <span className="text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-1.5 bg-yellow-500/20 text-yellow-600 rounded-full animate-pulse font-medium">
                  Calling...
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden min-h-0">
            <VideoChat
              localStream={callState.localStream}
              remoteStream={callState.remoteStream}
              isCallActive={callState.isCallActive}
              isCalling={callState.isCalling}
              isAnswering={callState.isAnswering && !showIncomingNotification}
              onStartCall={callActions.startCall}
              onAnswerCall={callActions.answerCall}
              onEndCall={callActions.endCall}
              onToggleAudio={callActions.toggleAudio}
              onToggleVideo={callActions.toggleVideo}
              onSwitchCamera={callActions.switchCamera}
              doctorName={doctorName}
              appointmentId={appointmentId}
              userRole={userRole}
              error={callState.error}
              connectionStatus={callState.connectionStatus}
              networkQuality={callState.networkQuality}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
