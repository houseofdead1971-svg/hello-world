import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface CallNotificationContextType {
  incomingCall: {
    isActive: boolean;
    callerName: string;
    appointmentId: string;
    onAnswer: () => void;
    onDecline: () => void;
  };
  setIncomingCall: (call: Omit<CallNotificationContextType['incomingCall'], 'isActive'> | null) => void;
}

const CallNotificationContext = createContext<CallNotificationContextType | undefined>(undefined);

export const CallNotificationProvider = ({ children }: { children: ReactNode }) => {
  const [incomingCall, setIncomingCallState] = useState<{
    callerName: string;
    appointmentId: string;
    onAnswer: () => void;
    onDecline: () => void;
  } | null>(null);

  const setIncomingCall = useCallback((call: typeof incomingCall) => {
    setIncomingCallState(call);
  }, []);

  const value: CallNotificationContextType = {
    incomingCall: {
      isActive: incomingCall !== null,
      callerName: incomingCall?.callerName || '',
      appointmentId: incomingCall?.appointmentId || '',
      onAnswer: incomingCall?.onAnswer || (() => {}),
      onDecline: incomingCall?.onDecline || (() => {}),
    },
    setIncomingCall,
  };

  return (
    <CallNotificationContext.Provider value={value}>
      {children}
    </CallNotificationContext.Provider>
  );
};

export const useCallNotification = () => {
  const context = useContext(CallNotificationContext);
  if (context === undefined) {
    throw new Error('useCallNotification must be used within CallNotificationProvider');
  }
  return context;
};
