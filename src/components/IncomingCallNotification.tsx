import { useState, useEffect } from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface IncomingCallNotificationProps {
  isVisible: boolean;
  callerName: string;
  appointmentId: string;
  onAnswer: () => void;
  onDecline: () => void;
}

export const IncomingCallNotification = ({
  isVisible,
  callerName,
  appointmentId,
  onAnswer,
  onDecline,
}: IncomingCallNotificationProps) => {
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShowAnimation(true);
      // Play notification sound
      playNotificationSound();
    } else {
      setShowAnimation(false);
    }
  }, [isVisible]);

  const playNotificationSound = () => {
    try {
      // Create a simple beep sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.log('Could not play notification sound:', error);
    }
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300',
          showAnimation ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      />

      {/* Notification Container */}
      <div
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-out',
          showAnimation ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
        )}
      >
        {/* Notification Card */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-2xl p-3 sm:p-6 mx-2 sm:mx-4 mt-2 sm:mt-4 rounded-lg sm:rounded-2xl">
          <div className="flex items-center justify-between gap-2 sm:gap-4 flex-col sm:flex-row">
            {/* Caller Info */}
            <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                  <Phone className="w-6 h-6 sm:w-8 sm:h-8" />
                </div>
                <div className="absolute inset-0 w-12 h-12 sm:w-16 sm:h-16 border-4 border-white/30 rounded-full animate-pulse" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-lg sm:text-2xl font-bold truncate">{callerName}</p>
                <p className="text-blue-100 text-xs sm:text-sm">Incoming Video Call</p>
                <p className="text-blue-100 text-xs mt-0.5 sm:mt-1 opacity-75 truncate">Appointment: {appointmentId.slice(0, 8)}...</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 sm:gap-3 w-full sm:w-auto flex-shrink-0 mt-3 sm:mt-0 sm:ml-4">
              <Button
                onClick={onAnswer}
                className="flex-1 sm:flex-none bg-green-500 hover:bg-green-600 text-white font-bold px-4 sm:px-8 py-2 sm:py-3 rounded-full flex items-center justify-center sm:justify-start gap-2 transition-all hover:scale-105 shadow-lg text-sm sm:text-base"
              >
                <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Answer</span>
                <span className="sm:hidden">Answer</span>
              </Button>
              <Button
                onClick={onDecline}
                className="flex-1 sm:flex-none bg-red-500 hover:bg-red-600 text-white font-bold px-4 sm:px-8 py-2 sm:py-3 rounded-full flex items-center justify-center sm:justify-start gap-2 transition-all hover:scale-105 shadow-lg text-sm sm:text-base"
              >
                <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Decline</span>
                <span className="sm:hidden">Decline</span>
              </Button>
            </div>
          </div>

          {/* Ringing Indicator */}
          <div className="flex gap-1 justify-center mt-3 sm:mt-4">
            {[0, 1, 2].map((i) => (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any, tailwindcss/no-custom-classname
              <div
                key={i}
                className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white/60 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.1}s` } as any}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
};
