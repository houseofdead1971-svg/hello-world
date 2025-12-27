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
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-2xl p-6 mx-4 mt-4 rounded-2xl">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            {/* Caller Info */}
            <div className="flex items-center gap-4 flex-1">
              <div className="relative">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                  <Phone className="w-8 h-8" />
                </div>
                <div className="absolute inset-0 w-16 h-16 border-4 border-white/30 rounded-full animate-pulse" />
              </div>

              <div>
                <p className="text-2xl font-bold">{callerName}</p>
                <p className="text-blue-100 text-sm">Incoming Video Call</p>
                <p className="text-blue-100 text-xs mt-1 opacity-75">Appointment ID: {appointmentId}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 ml-4 flex-shrink-0">
              <Button
                onClick={onAnswer}
                className="bg-green-500 hover:bg-green-600 text-white font-bold px-8 py-3 rounded-full flex items-center gap-2 transition-all hover:scale-105 shadow-lg"
              >
                <Phone className="w-5 h-5" />
                <span className="hidden sm:inline">Answer</span>
              </Button>
              <Button
                onClick={onDecline}
                className="bg-red-500 hover:bg-red-600 text-white font-bold px-8 py-3 rounded-full flex items-center gap-2 transition-all hover:scale-105 shadow-lg"
              >
                <PhoneOff className="w-5 h-5" />
                <span className="hidden sm:inline">Decline</span>
              </Button>
            </div>
          </div>

          {/* Ringing Indicator */}
          <div className="flex gap-1 justify-center mt-4">
            {[0, 1, 2].map((i) => (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <div
                key={i}
                className="w-2 h-2 bg-white/60 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.1}s` } as any}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
};
