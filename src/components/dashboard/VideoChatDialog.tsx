import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { VideoChat } from './VideoChat';
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
      setShowChat(false);
      onClose();
    }
  };

  if (consultationType !== 'online') {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl w-[98vw] sm:w-[95vw] h-[100dvh] sm:h-[90vh] flex flex-col p-0 sm:p-4 gap-0 rounded-none sm:rounded-xl border-0 sm:border">
        <DialogHeader className="flex-shrink-0 px-4 pt-4 sm:px-0 sm:pt-0 pb-2">
          <DialogTitle className="flex items-center justify-between pr-8 gap-2">
            <span className="text-base sm:text-xl font-semibold truncate flex-1">{doctorName}</span>
            {callState.isCallActive && (
              <span className="text-[10px] px-2 py-0.5 bg-green-500/20 text-green-600 rounded-full flex items-center gap-1 flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Live
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
