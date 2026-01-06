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
      <DialogContent className="max-w-4xl w-[95vw] sm:h-[90vh] h-[95vh] flex flex-col p-4 sm:p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between pr-8">
            <span className="text-lg sm:text-xl">Video Appointment with {doctorName}</span>
            {callState.isCallActive && (
              <span className="text-xs px-2 py-1 bg-green-500/20 text-green-500 rounded-full animate-pulse">
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
  );
};
