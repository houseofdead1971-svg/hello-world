import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { VideoChat } from './VideoChat';
import { useWebRTCCall } from '@/hooks/use-webrtc-call';
import { useCallNotification } from '@/contexts/CallNotificationContext';
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
  const { setIncomingCall } = useCallNotification();

  const [callState, callActions] = useWebRTCCall(
    appointmentId,
    currentUserId,
    userRole,
    remoteUserId
  );

  // Set up incoming call notification when call is incoming
  useEffect(() => {
    if (callState.incomingCall && isOpen) {
      setIncomingCall({
        callerName: callState.callerName || doctorName,
        appointmentId,
        onAnswer: async () => {
          try {
            await callActions.answerCall();
          } catch (error) {
            console.error('Error answering call:', error);
          }
        },
        onDecline: () => {
          callActions.dismissIncomingCall();
        },
      });
    } else if (!callState.incomingCall) {
      setIncomingCall(null);
    }
  }, [callState.incomingCall, isOpen, callState.callerName, doctorName, appointmentId, callActions, setIncomingCall]);

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
      setShowChat(false);
      onClose();
    }
  };

  if (consultationType !== 'online') {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl w-[98vw] sm:w-[95vw] h-[99vh] sm:h-[90vh] max-h-[99dvh] sm:max-h-[90dvh] flex flex-col p-3 sm:p-6 gap-3 sm:gap-4">
        <DialogHeader className="flex-shrink-0 py-2">
          <DialogTitle className="text-base sm:text-xl line-clamp-2">
            <span>Video Appointment with {doctorName}</span>
            {callState.isCallActive && (
              <span className="text-xs px-2 py-1 bg-green-500/20 text-green-500 rounded-full animate-pulse ml-2 inline-block">
                Call Active
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
            isAnswering={callState.isAnswering}
            onStartCall={callActions.startCall}
            onAnswerCall={callActions.answerCall}
            onEndCall={callActions.endCall}
            onToggleAudio={callActions.toggleAudio}
            onToggleVideo={callActions.toggleVideo}
            doctorName={doctorName}
            appointmentId={appointmentId}
            userRole={userRole}
            error={callState.error}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
