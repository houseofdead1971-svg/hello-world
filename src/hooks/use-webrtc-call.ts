import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WebRTCCallState {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isCallActive: boolean;
  isCalling: boolean;
  isAnswering: boolean;
  error: string | null;
  incomingCall: boolean;
  callerName: string | null;
}

interface WebRTCCallActions {
  startCall: () => Promise<void>;
  answerCall: () => Promise<void>;
  endCall: () => void;
  toggleAudio: (enabled: boolean) => void;
  toggleVideo: (enabled: boolean) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  dismissIncomingCall: () => void;
}

export const useWebRTCCall = (
  appointmentId: string,
  userId: string,
  userRole: 'doctor' | 'patient',
  remoteUserId: string
): [WebRTCCallState, WebRTCCallActions] => {
  const [state, setState] = useState<WebRTCCallState>({
    localStream: null,
    remoteStream: null,
    isCallActive: false,
    isCalling: false,
    isAnswering: false,
    error: null,
    incomingCall: false,
    callerName: null,
  });

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const signalChannelRef = useRef<any>(null);
  const iceCandidatesRef = useRef<RTCIceCandidate[]>([]);
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelReadyRef = useRef<Promise<void>>(Promise.resolve());
  const resolveChannelReadyRef = useRef<(() => void) | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const remoteOfferReadyRef = useRef(false);

  const configuration = {
    iceServers: [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    ],
  };

  // Initialize peer connection
  const initializePeerConnection = useCallback(() => {
    try {
      const peerConnection = new RTCPeerConnection(configuration);

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('[WebRTC] ICE candidate:', event.candidate);
          // Send ICE candidate through Supabase realtime
          if (signalChannelRef.current) {
            signalChannelRef.current.send({
              type: 'broadcast',
              event: 'ice-candidate',
              payload: {
                candidate: event.candidate.candidate,
                sdpMLineIndex: event.candidate.sdpMLineIndex,
                sdpMid: event.candidate.sdpMid,
              },
            });
          }
        }
      };

      peerConnection.ontrack = (event) => {
        console.log('[WebRTC] Remote track received:', event.track.kind);
        if (event.streams && event.streams.length > 0) {
          setState((prev) => ({ ...prev, remoteStream: event.streams[0] }));
        }
      };

      peerConnection.onconnectionstatechange = () => {
        console.log('[WebRTC] Connection state changed to:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'connected') {
          console.log('[WebRTC] Connection established successfully');
          setState((prev) => ({ ...prev, isCallActive: true, error: null }));
        } else if (peerConnection.connectionState === 'failed') {
          console.log('[WebRTC] Connection failed - attempting to diagnose');
          const iceConnectionState = peerConnection.iceConnectionState;
          console.log('[WebRTC] ICE Connection State:', iceConnectionState);
          
          // Show specific error based on ICE state
          let errorMsg = 'Call connection failed. ';
          if (iceConnectionState === 'failed') {
            errorMsg += 'Check your internet connection and firewall settings.';
          } else if (iceConnectionState === 'disconnected') {
            errorMsg += 'Connection was lost. Please try again.';
          } else {
            errorMsg += 'Unable to establish connection with the other party.';
          }
          
          setState((prev) => ({
            ...prev,
            error: errorMsg,
          }));
          toast.error(errorMsg);
          endCall();
        } else if (peerConnection.connectionState === 'disconnected') {
          console.log('[WebRTC] Connection disconnected');
          setState((prev) => ({
            ...prev,
            error: 'Connection lost. Attempting to reconnect...',
          }));
          // Give it a moment to potentially reconnect
          setTimeout(() => {
            if (peerConnection.connectionState === 'disconnected') {
              console.log('[WebRTC] Still disconnected, ending call');
              toast.error('Connection lost');
              endCall();
            }
          }, 3000);
        }
      };

      peerConnection.oniceconnectionstatechange = () => {
        console.log('[WebRTC] ICE Connection state:', peerConnection.iceConnectionState);
        if (peerConnection.iceConnectionState === 'failed') {
          console.log('[WebRTC] ICE failed - checking if we should recover');
          // ICE candidates are still being gathered
          if (peerConnection.iceGatheringState !== 'gathering') {
            console.log('[WebRTC] No more ICE candidates will be gathered, connection is likely blocked');
          }
        }
      };

      peerConnectionRef.current = peerConnection;
      return peerConnection;
    } catch (error) {
      console.error('[WebRTC] Error initializing peer connection:', error);
      setState((prev) => ({ ...prev, error: 'Failed to initialize peer connection' }));
      throw error;
    }
  }, []);

  // Start call (initiator)
  const startCall = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isCalling: true, error: null }));

      // Reset offer ready flag for new call
      remoteOfferReadyRef.current = false;

      // Wait for signaling channel to be ready with retry logic
      console.log('[WebRTC] Waiting for signaling channel to be ready...');
      let retries = 0;
      const maxRetries = 5;
      
      while (retries < maxRetries && !signalChannelRef.current) {
        try {
          if (channelReadyRef.current) {
            await Promise.race([
              channelReadyRef.current,
              new Promise((_, reject) => setTimeout(() => reject(new Error('Channel ready timeout')), 5000))
            ]);
          }
          
          // Check if signal channel is now ready
          if (signalChannelRef.current) {
            break;
          }
        } catch (waitError) {
          console.warn(`[WebRTC] Channel ready wait failed (attempt ${retries + 1}/${maxRetries}):`, waitError);
          retries++;
          if (retries < maxRetries) {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      // Check if signal channel is ready
      if (!signalChannelRef.current) {
        throw new Error('Signaling channel failed to connect. Please check your internet connection and try again.');
      }

      // Initialize peer connection FIRST (before getting media)
      const peerConnection = initializePeerConnection();

      // Get local media stream with better error handling
      let stream: MediaStream;
      try {
        // Always request video and audio - we can disable tracks later
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
      } catch (mediaError: any) {
        console.error('[WebRTC] getUserMedia error:', mediaError);
        
        // Handle specific permission errors
        if (mediaError.name === 'NotAllowedError' || mediaError.name === 'PermissionDeniedError') {
          throw new Error('Camera/Microphone permission denied. Please allow access in your browser settings and try again.');
        } else if (mediaError.name === 'NotFoundError' || mediaError.name === 'DevicesNotFoundError') {
          throw new Error('No camera or microphone found. Please check your device connections.');
        } else if (mediaError.name === 'NotReadableError') {
          throw new Error('Camera/Microphone is in use by another application. Please close other apps and try again.');
        } else if (mediaError.name === 'SecurityError') {
          throw new Error('Secure connection required for camera access. Please use HTTPS.');
        } else {
          throw new Error(`Camera/Microphone access failed: ${mediaError.message}`);
        }
      }

      setState((prev) => ({ ...prev, localStream: stream }));

      // Add tracks to peer connection
      stream.getTracks().forEach((track) => {
        console.log('[WebRTC] Adding track:', track.kind, 'enabled:', track.enabled);
        peerConnection.addTrack(track, stream);
      });

      // Create and send offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      console.log('[WebRTC] Sending offer with signalingState:', peerConnection.signalingState);
      
      const channel = signalChannelRef.current;
      if (!channel) {
        throw new Error('Signaling channel disconnected');
      }

      channel.send({
        type: 'broadcast',
        event: 'offer',
        payload: {
          sdp: peerConnection.localDescription?.sdp,
          type: 'offer',
          callerName: 'Doctor', // Send caller name with offer
        },
      });

      // Set timeout for answer - if no answer received in 30 seconds, timeout
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
      }
      callTimeoutRef.current = setTimeout(() => {
        setState((prev) => {
          if (prev.isCalling && !prev.isCallActive) {
            const timeoutError = 'Call not answered. Make sure the other person has opened the call dialog.';
            toast.error(timeoutError);
            return {
              ...prev,
              isCalling: false,
              error: timeoutError,
            };
          }
          return prev;
        });
      }, 30000);

      setState((prev) => ({ ...prev, isCalling: false }));
      toast.success('Calling...');
    } catch (error) {
      console.error('[WebRTC] Error starting call:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setState((prev) => ({
        ...prev,
        isCalling: false,
        error: `Failed to start call: ${errorMsg}`,
      }));
      toast.error(errorMsg);
    }
  }, [initializePeerConnection]);

  // Answer call (receiver)
  const answerCall = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isAnswering: true, error: null }));

      const pc = peerConnectionRef.current;

      if (!pc) {
        throw new Error('PeerConnection not initialized. Please wait a moment and try again.');
      }

      console.log('[WebRTC] Answer call - signaling state:', pc.signalingState, 'connection state:', pc.connectionState);

      // Safely wait for remote offer to be fully processed
      const waitForOffer = async () => {
        const start = Date.now();
        while (!remoteOfferReadyRef.current) {
          if (Date.now() - start > 5000) {
            throw new Error('Timed out waiting for remote offer. The other party may have disconnected.');
          }
          console.log('[WebRTC] Waiting for remote offer to be ready...');
          await new Promise(res => setTimeout(res, 100));
        }
      };

      await waitForOffer();

      // Verify state is correct before creating answer
      if (pc.signalingState === 'closed') {
        throw new Error('Peer connection was closed unexpectedly.');
      }

      if (pc.signalingState !== 'have-remote-offer') {
        console.warn('[WebRTC] Invalid state for answer:', pc.signalingState);
        throw new Error('Call setup incomplete. Please try again.');
      }

      // Get local media stream
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
      } catch (mediaError: any) {
        console.error('[WebRTC] getUserMedia error:', mediaError);
        
        if (mediaError.name === 'NotAllowedError' || mediaError.name === 'PermissionDeniedError') {
          throw new Error('Camera/Microphone permission denied. Please allow access in your browser settings and try again.');
        } else if (mediaError.name === 'NotFoundError' || mediaError.name === 'DevicesNotFoundError') {
          throw new Error('No camera or microphone found. Please check your device connections.');
        } else if (mediaError.name === 'NotReadableError') {
          throw new Error('Camera/Microphone is in use by another application. Please close other apps and try again.');
        } else if (mediaError.name === 'SecurityError') {
          throw new Error('Secure connection required for camera access. Please use HTTPS.');
        } else {
          throw new Error(`Camera/Microphone access failed: ${mediaError.message}`);
        }
      }

      setState((prev) => ({ ...prev, localStream: stream }));

      // Add tracks to peer connection
      stream.getTracks().forEach((track) => {
        console.log('[WebRTC] Adding track:', track.kind);
        pc.addTrack(track, stream);
      });

      // Create answer - now safe because state is verified
      console.log('[WebRTC] Creating answer...');
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      console.log('[WebRTC] Sending answer, signalingState:', pc.signalingState);

      if (!signalChannelRef.current) {
        throw new Error('Signaling channel disconnected. Please try again.');
      }

      signalChannelRef.current.send({
        type: 'broadcast',
        event: 'answer',
        payload: {
          type: 'answer',
          sdp: answer.sdp,
        },
      });

      setState((prev) => ({ ...prev, isAnswering: false }));
      toast.success('Call answered');
    } catch (error) {
      console.error('[WebRTC] Answer failed:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unable to answer call';
      setState((prev) => ({
        ...prev,
        isAnswering: false,
        error: `Failed to answer call: ${errorMsg}`,
        incomingCall: false,
      }));
      toast.error(errorMsg);
    }
  }, []);

  // End call
  const endCall = useCallback(() => {
    console.log('[WebRTC] Ending call');

    // Reset offer ready flag for next call
    remoteOfferReadyRef.current = false;

    // Stop all tracks and disable camera explicitly
    if (state.localStream) {
      state.localStream.getTracks().forEach((track) => {
        console.log('[WebRTC] Stopping track:', track.kind);
        track.enabled = false;  // Disable track first
        track.stop();           // Then stop it
      });
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Send call end signal
    if (signalChannelRef.current) {
      signalChannelRef.current.send({
        type: 'broadcast',
        event: 'call-end',
        payload: {},
      });
    }

    setState((prev) => ({
      ...prev,
      localStream: null,
      remoteStream: null,
      isCallActive: false,
      isCalling: false,
      error: null,  // Clear any errors when call ends
    }));

    toast.success('Call ended');
  }, [state.localStream]);

  // Toggle audio
  const toggleAudio = useCallback(
    (enabled: boolean) => {
      if (state.localStream) {
        state.localStream.getAudioTracks().forEach((track) => {
          track.enabled = enabled;
        });
      }
    },
    [state.localStream]
  );

  // Toggle video
  const toggleVideo = useCallback(
    (enabled: boolean) => {
      if (state.localStream) {
        state.localStream.getVideoTracks().forEach((track) => {
          track.enabled = enabled;
        });
      }
    },
    [state.localStream]
  );

  // Setup signaling channel
  useEffect(() => {
    const channel = supabase.channel(`video-call-${appointmentId}`);
    let subscribed = false;

    // Create a new promise for this channel setup
    channelReadyRef.current = new Promise<void>((resolve) => {
      resolveChannelReadyRef.current = resolve;
    });

    const setupChannelListeners = () => {
      channel.on('broadcast', { event: 'offer' }, async (payload) => {
        try {
          console.log('[WebRTC] Received offer, current signalingState:', peerConnectionRef.current?.signalingState);
          
          // Ensure peer connection exists - create only once
          if (!peerConnectionRef.current) {
            console.log('[WebRTC] Creating peer connection for incoming call');
            peerConnectionRef.current = initializePeerConnection();
          }

          const pc = peerConnectionRef.current;
          const offer: RTCSessionDescriptionInit = {
            type: 'offer',
            sdp: payload.payload.sdp,
          };

          // Only set remote description if in stable state
          if (pc.signalingState === 'stable') {
            console.log('[WebRTC] Setting remote description from offer');
            await pc.setRemoteDescription(offer);
            pendingOfferRef.current = offer;
            console.log('[WebRTC] Remote description set, signalingState now:', pc.signalingState);
            
            // Mark offer as ready for answer
            remoteOfferReadyRef.current = true;
            console.log('[WebRTC] Remote offer is ready for answer');
            
            // Show incoming call notification
            setState((prev) => ({ 
              ...prev, 
              incomingCall: true,
              callerName: payload.payload.callerName || 'Caller'
            }));
            console.log('[WebRTC] Ready to answer call');
          } else {
            console.warn('[WebRTC] Offer received but signaling state is', pc.signalingState, '- ignoring');
            return;
          }
        } catch (error) {
          console.error('[WebRTC] Error handling offer:', error);
          toast.error('Failed to receive call');
        }
      });

      channel.on('broadcast', { event: 'answer' }, async (payload) => {
        try {
          const peerConnection = peerConnectionRef.current;
          console.log('[WebRTC] Received answer:', {
            connectionState: peerConnection?.connectionState,
            signalingState: peerConnection?.signalingState,
          });
          
          if (!peerConnection) {
            console.error('[WebRTC] No peer connection available for answer');
            return;
          }

          // Only accept answer if we're in 'have-local-offer' state (we initiated the call)
          if (peerConnection.signalingState !== 'have-local-offer') {
            console.warn('[WebRTC] Ignoring answer - unexpected state:', peerConnection.signalingState);
            return;
          }

          const answer = new RTCSessionDescription({
            type: 'answer' as RTCSdpType,
            sdp: payload.payload.sdp,
          });
          
          await peerConnection.setRemoteDescription(answer);
          console.log('[WebRTC] Set remote answer successfully, signalingState is now:', peerConnection.signalingState);
        } catch (error) {
          console.error('[WebRTC] Error handling answer:', error);
          toast.error('Failed to establish connection');
        }
      });

      channel.on('broadcast', { event: 'ice-candidate' }, async (payload) => {
        try {
          const peerConnection = peerConnectionRef.current;
          if (peerConnection && payload.payload.candidate) {
            const candidate = new RTCIceCandidate({
              candidate: payload.payload.candidate,
              sdpMLineIndex: payload.payload.sdpMLineIndex,
              sdpMid: payload.payload.sdpMid,
            });
            await peerConnection.addIceCandidate(candidate);
          }
        } catch (error) {
          console.error('[WebRTC] Error adding ICE candidate:', error);
        }
      });

      channel.on('broadcast', { event: 'call-end' }, () => {
        console.log('[WebRTC] Remote user ended call');
        endCall();
      });
    };

    // Set up listeners first
    setupChannelListeners();

    // Subscribe and wait for confirmation before setting ref
    const subscription = channel.subscribe((status) => {
      console.log('[WebRTC] Channel subscription status:', status, 'on channel: video-call-' + appointmentId);
      if (status === 'SUBSCRIBED') {
        subscribed = true;
        console.log('[WebRTC] Signaling channel subscribed successfully');
        signalChannelRef.current = channel;
        // Resolve the promise to indicate channel is ready - ONLY after setting ref
        setTimeout(() => {
          if (resolveChannelReadyRef.current) {
            console.log('[WebRTC] Channel ready promise resolved');
            resolveChannelReadyRef.current();
            resolveChannelReadyRef.current = null;
          }
        }, 0);
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[WebRTC] Signaling channel error');
        subscribed = false;
        const errorMsg = 'Failed to establish signaling channel. Please check your internet connection and try again.';
        setState((prev) => ({ ...prev, error: errorMsg }));
        toast.error(errorMsg);
        // Also reject the promise
        if (resolveChannelReadyRef.current) {
          resolveChannelReadyRef.current();
          resolveChannelReadyRef.current = null;
        }
      } else if (status === 'CLOSED') {
        console.warn('[WebRTC] Signaling channel closed');
        subscribed = false;
        signalChannelRef.current = null;
      }
    });

    return () => {
      console.log('[WebRTC] Cleaning up signaling channel');
      supabase.removeChannel(channel);
      signalChannelRef.current = null;
    };
  }, [appointmentId]);

  // Dismiss incoming call notification
  const dismissIncomingCall = useCallback(() => {
    setState((prev) => ({
      ...prev,
      incomingCall: false,
      isAnswering: false,
      callerName: null,
    }));
  }, []);

  return [
    state,
    {
      startCall,
      answerCall,
      endCall,
      toggleAudio,
      toggleVideo,
      setLocalStream: (stream) => setState((prev) => ({ ...prev, localStream: stream })),
      setRemoteStream: (stream) => setState((prev) => ({ ...prev, remoteStream: stream })),
      dismissIncomingCall,
    },
  ];
};
