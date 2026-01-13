import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, User, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface IncomingCallNotificationProps {
  callerName: string;
  onAnswer: () => void;
  onDecline: () => void;
  isVisible: boolean;
}

export const IncomingCallNotification = ({
  callerName,
  onAnswer,
  onDecline,
  isVisible,
}: IncomingCallNotificationProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [ringCount, setRingCount] = useState(0);

  // Play ringtone and vibrate
  useEffect(() => {
    if (!isVisible) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setRingCount(0);
      return;
    }

    // Create ringtone using Web Audio API (no external file needed)
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const playRingtone = () => {
      // Create a pleasant ringtone pattern
      const playTone = (frequency: number, startTime: number, duration: number) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + duration - 0.05);
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };

      const now = audioContext.currentTime;
      // Ring pattern: two tones repeated
      playTone(523.25, now, 0.15); // C5
      playTone(659.25, now + 0.15, 0.15); // E5
      playTone(783.99, now + 0.3, 0.2); // G5
      playTone(659.25, now + 0.5, 0.15); // E5
      playTone(523.25, now + 0.65, 0.15); // C5
    };

    // Play immediately and repeat
    playRingtone();
    const ringInterval = setInterval(() => {
      playRingtone();
      setRingCount(prev => prev + 1);
      
      // Vibrate on mobile if supported
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
      }
    }, 2000);

    // Initial vibration
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200, 100, 200]);
    }

    return () => {
      clearInterval(ringInterval);
      audioContext.close();
      if ('vibrate' in navigator) {
        navigator.vibrate(0);
      }
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-[90vw] max-w-sm mx-auto">
        {/* Pulsing ring effect */}
        <div className="absolute inset-0 -m-4 rounded-3xl bg-primary/20 animate-ping" style={{ animationDuration: '1.5s' }} />
        <div className="absolute inset-0 -m-2 rounded-3xl bg-primary/30 animate-pulse" />
        
        {/* Main card */}
        <div className="relative bg-gradient-to-br from-card via-card to-card/90 border-2 border-primary/50 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-primary/20">
          {/* Caller avatar */}
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
                <User className="w-10 h-10 sm:w-12 sm:h-12 text-primary-foreground" />
              </div>
              {/* Animated ring around avatar */}
              <div className="absolute inset-0 rounded-full border-4 border-primary animate-ping opacity-50" />
              <div className="absolute -inset-2 rounded-full border-2 border-primary/50 animate-pulse" />
              
              {/* Video icon badge */}
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shadow-lg animate-bounce">
                <Video className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>

          {/* Caller info */}
          <div className="text-center mb-6">
            <p className="text-muted-foreground text-sm mb-1">Incoming Video Call</p>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground truncate px-2">
              {callerName}
            </h2>
            <div className="flex items-center justify-center gap-1 mt-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-muted-foreground">
                Ringing{'.'.repeat((ringCount % 3) + 1)}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-4 justify-center">
            {/* Decline button */}
            <Button
              onClick={onDecline}
              size="lg"
              className={cn(
                "w-16 h-16 sm:w-20 sm:h-20 rounded-full p-0 shadow-lg transition-all duration-200",
                "bg-red-500 hover:bg-red-600 hover:scale-110 active:scale-95",
                "border-2 border-red-400"
              )}
            >
              <PhoneOff className="w-7 h-7 sm:w-8 sm:h-8 text-white rotate-[135deg]" />
            </Button>

            {/* Answer button */}
            <Button
              onClick={onAnswer}
              size="lg"
              className={cn(
                "w-16 h-16 sm:w-20 sm:h-20 rounded-full p-0 shadow-lg transition-all duration-200",
                "bg-green-500 hover:bg-green-600 hover:scale-110 active:scale-95",
                "border-2 border-green-400 animate-pulse"
              )}
              style={{ animationDuration: '1s' }}
            >
              <Phone className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </Button>
          </div>

          {/* Labels */}
          <div className="flex justify-center gap-12 mt-3">
            <span className="text-xs text-red-400 font-medium">Decline</span>
            <span className="text-xs text-green-400 font-medium">Answer</span>
          </div>
        </div>
      </div>
    </div>
  );
};
