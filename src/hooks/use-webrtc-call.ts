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
  connectionStatus: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed';
  networkQuality: 'good' | 'poor' | 'unknown';
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
  switchCamera: () => Promise<void>;
}

// Detect browser for Safari-specific handling
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

// Get optimal media constraints for the browser
const getMediaConstraints = (videoEnabled: boolean = true) => {
  const baseConstraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: videoEnabled ? {
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      frameRate: { ideal: 30, max: 60 },
      facingMode: 'user',
    } : false,
  };

  // Safari/iOS specific constraints
  if (isSafari || isIOS) {
    return {
      audio: true,
      video: videoEnabled ? {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
      } : false,
    };
  }

  return baseConstraints;
};

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
    connectionStatus: 'idle',
    networkQuality: 'unknown',
  });

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const signalChannelRef = useRef<any>(null);
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelReadyRef = useRef<Promise<void>>(Promise.resolve());
  const resolveChannelReadyRef = useRef<(() => void) | null>(null);
  const isEndingCallRef = useRef<boolean>(false);
  const pendingIceCandidatesRef = useRef<RTCIceCandidate[]>([]);
  const isInitiatorRef = useRef<boolean>(false);
  const reconnectAttemptRef = useRef<number>(0);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentFacingModeRef = useRef<'user' | 'environment'>('user');

  // ICE servers configuration with multiple STUN/TURN options
  const configuration: RTCConfiguration = {
    iceServers: [
      // Google STUN servers
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      // Additional public STUN servers
      { urls: 'stun:stun.stunprotocol.org:3478' },
      // OpenRelay TURN servers (free, no auth required)
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  };

  // Monitor network quality using WebRTC stats
  const startStatsMonitoring = useCallback((pc: RTCPeerConnection) => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
    }

    statsIntervalRef.current = setInterval(async () => {
      try {
        const stats = await pc.getStats();
        let packetsLost = 0;
        let packetsReceived = 0;

        stats.forEach((report) => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            packetsLost += report.packetsLost || 0;
            packetsReceived += report.packetsReceived || 0;
          }
        });

        const lossRate = packetsReceived > 0 ? packetsLost / (packetsLost + packetsReceived) : 0;
        const quality = lossRate > 0.1 ? 'poor' : 'good';

        setState((prev) => {
          if (prev.networkQuality !== quality) {
            if (quality === 'poor') {
              toast.warning('Network quality is poor. Video may be affected.');
            }
            return { ...prev, networkQuality: quality };
          }
          return prev;
        });
      } catch (e) {
        // Stats not available
      }
    }, 5000);
  }, []);

  // Initialize peer connection
  const initializePeerConnection = useCallback(() => {
    try {
      console.log('[WebRTC] Creating peer connection with config:', configuration);
      const peerConnection = new RTCPeerConnection(configuration);

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('[WebRTC] ICE candidate generated:', event.candidate.type);
          if (signalChannelRef.current) {
            signalChannelRef.current.send({
              type: 'broadcast',
              event: 'ice-candidate',
              payload: {
                candidate: event.candidate.candidate,
                sdpMLineIndex: event.candidate.sdpMLineIndex,
                sdpMid: event.candidate.sdpMid,
                usernameFragment: event.candidate.usernameFragment,
              },
            });
          }
        } else {
          console.log('[WebRTC] ICE gathering complete');
        }
      };

      peerConnection.ontrack = (event) => {
        console.log('[WebRTC] Remote track received:', event.track.kind, 'readyState:', event.track.readyState);
        
        if (event.streams && event.streams.length > 0) {
          const remoteStream = event.streams[0];
          console.log('[WebRTC] Setting remote stream with tracks:', remoteStream.getTracks().map(t => `${t.kind}:${t.readyState}`));
          
          setState((prev) => ({ ...prev, remoteStream }));
          
          // Handle track ended
          event.track.onended = () => {
            console.log('[WebRTC] Remote track ended:', event.track.kind);
          };
          
          event.track.onmute = () => {
            console.log('[WebRTC] Remote track muted:', event.track.kind);
          };
          
          event.track.onunmute = () => {
            console.log('[WebRTC] Remote track unmuted:', event.track.kind);
          };
        }
      };

      peerConnection.onconnectionstatechange = () => {
        const connectionState = peerConnection.connectionState;
        console.log('[WebRTC] Connection state:', connectionState);

        switch (connectionState) {
          case 'connecting':
            setState((prev) => ({ ...prev, connectionStatus: 'connecting' }));
            break;
          case 'connected':
            console.log('[WebRTC] ✅ Connection established successfully');
            setState((prev) => ({
              ...prev,
              isCallActive: true,
              connectionStatus: 'connected',
              error: null,
              isCalling: false,
              isAnswering: false,
            }));
            reconnectAttemptRef.current = 0;
            startStatsMonitoring(peerConnection);
            break;
          case 'disconnected':
            console.log('[WebRTC] Connection disconnected, attempting recovery...');
            setState((prev) => ({
              ...prev,
              connectionStatus: 'reconnecting',
              error: 'Connection interrupted. Reconnecting...',
            }));
            // Attempt ICE restart after short delay
            setTimeout(() => {
              if (peerConnection.connectionState === 'disconnected' && reconnectAttemptRef.current < 3) {
                reconnectAttemptRef.current++;
                attemptIceRestart(peerConnection);
              }
            }, 2000);
            break;
          case 'failed':
            console.log('[WebRTC] ❌ Connection failed');
            if (reconnectAttemptRef.current < 3) {
              reconnectAttemptRef.current++;
              console.log('[WebRTC] Attempting reconnection', reconnectAttemptRef.current);
              attemptIceRestart(peerConnection);
            } else {
              const errorMsg = 'Connection failed. Please check your network and try again.';
              setState((prev) => ({
                ...prev,
                connectionStatus: 'failed',
                error: errorMsg,
              }));
              toast.error(errorMsg);
              endCall();
            }
            break;
          case 'closed':
            console.log('[WebRTC] Connection closed');
            break;
        }
      };

      peerConnection.oniceconnectionstatechange = () => {
        console.log('[WebRTC] ICE connection state:', peerConnection.iceConnectionState);
        
        if (peerConnection.iceConnectionState === 'failed') {
          console.log('[WebRTC] ICE failed, attempting restart');
          attemptIceRestart(peerConnection);
        }
      };

      peerConnection.onicegatheringstatechange = () => {
        console.log('[WebRTC] ICE gathering state:', peerConnection.iceGatheringState);
      };

      peerConnection.onnegotiationneeded = async () => {
        console.log('[WebRTC] Negotiation needed, isInitiator:', isInitiatorRef.current);
        // Only create offer if we're the initiator to prevent glare
        if (isInitiatorRef.current && peerConnection.signalingState === 'stable') {
          try {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            signalChannelRef.current?.send({
              type: 'broadcast',
              event: 'offer',
              payload: {
                sdp: peerConnection.localDescription?.sdp,
                type: 'offer',
                callerName: userRole === 'doctor' ? 'Doctor' : 'Patient',
              },
            });
          } catch (err) {
            console.error('[WebRTC] Error during renegotiation:', err);
          }
        }
      };

      peerConnectionRef.current = peerConnection;
      return peerConnection;
    } catch (error) {
      console.error('[WebRTC] Error initializing peer connection:', error);
      setState((prev) => ({ ...prev, error: 'Failed to initialize connection' }));
      throw error;
    }
  }, [startStatsMonitoring, userRole]);

  // Attempt ICE restart for connection recovery
  const attemptIceRestart = useCallback(async (peerConnection: RTCPeerConnection) => {
    if (!isInitiatorRef.current) return;
    
    try {
      console.log('[WebRTC] Attempting ICE restart...');
      setState((prev) => ({ ...prev, connectionStatus: 'reconnecting' }));
      
      const offer = await peerConnection.createOffer({ iceRestart: true });
      await peerConnection.setLocalDescription(offer);
      
      signalChannelRef.current?.send({
        type: 'broadcast',
        event: 'offer',
        payload: {
          sdp: peerConnection.localDescription?.sdp,
          type: 'offer',
          callerName: userRole === 'doctor' ? 'Doctor' : 'Patient',
          iceRestart: true,
        },
      });
    } catch (error) {
      console.error('[WebRTC] ICE restart failed:', error);
    }
  }, [userRole]);

  // Get media stream with fallback
  const getMediaStream = useCallback(async (videoEnabled: boolean = true): Promise<MediaStream> => {
    try {
      const constraints = getMediaConstraints(videoEnabled);
      console.log('[WebRTC] Requesting media with constraints:', constraints);
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('[WebRTC] Got media stream:', stream.getTracks().map(t => `${t.kind}:${t.enabled}`));
      return stream;
    } catch (error: any) {
      console.error('[WebRTC] getUserMedia error:', error.name, error.message);
      
      // Try audio-only fallback
      if (videoEnabled && (error.name === 'NotFoundError' || error.name === 'NotReadableError')) {
        console.log('[WebRTC] Falling back to audio-only');
        toast.warning('Camera not available. Starting audio-only call.');
        try {
          return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } catch (audioError) {
          throw new Error('No camera or microphone available. Please check your device permissions.');
        }
      }

      // Handle specific errors
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        throw new Error('Camera/Microphone permission denied. Please allow access in your browser settings.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        throw new Error('No camera or microphone found. Please connect a device.');
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        throw new Error('Camera/Microphone is in use by another app. Please close other apps and try again.');
      } else if (error.name === 'OverconstrainedError') {
        // Try with less strict constraints
        console.log('[WebRTC] Retrying with basic constraints');
        return await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      } else if (error.name === 'SecurityError') {
        throw new Error('Secure connection (HTTPS) required for camera access.');
      }
      
      throw new Error(`Media access failed: ${error.message}`);
    }
  }, []);

  // Start call (initiator)
  const startCall = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isCalling: true, error: null, connectionStatus: 'connecting' }));
      isInitiatorRef.current = true;

      // Wait for signaling channel
      console.log('[WebRTC] Waiting for signaling channel...');
      let retries = 0;
      const maxRetries = 5;

      while (retries < maxRetries && !signalChannelRef.current) {
        try {
          await Promise.race([
            channelReadyRef.current,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000)),
          ]);
          if (signalChannelRef.current) break;
        } catch {
          retries++;
          if (retries < maxRetries) await new Promise((r) => setTimeout(r, 1000));
        }
      }

      if (!signalChannelRef.current) {
        throw new Error('Could not connect to signaling server. Check your internet connection.');
      }

      // Initialize peer connection first
      const peerConnection = initializePeerConnection();

      // Get media stream
      const stream = await getMediaStream(true);
      setState((prev) => ({ ...prev, localStream: stream }));

      // Add tracks to peer connection
      stream.getTracks().forEach((track) => {
        console.log('[WebRTC] Adding local track:', track.kind);
        peerConnection.addTrack(track, stream);
      });

      // Create and send offer
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await peerConnection.setLocalDescription(offer);

      console.log('[WebRTC] Sending offer');
      signalChannelRef.current.send({
        type: 'broadcast',
        event: 'offer',
        payload: {
          sdp: peerConnection.localDescription?.sdp,
          type: 'offer',
          callerName: userRole === 'doctor' ? 'Doctor' : 'Patient',
          senderId: userId,
        },
      });

      // Set timeout for answer
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = setTimeout(() => {
        setState((prev) => {
          if (prev.isCalling && !prev.isCallActive) {
            toast.error('Call not answered. The other person may not have the call dialog open.');
            return { ...prev, isCalling: false, error: 'Call not answered', connectionStatus: 'idle' };
          }
          return prev;
        });
      }, 45000);

      toast.success('Calling...');
    } catch (error) {
      console.error('[WebRTC] Error starting call:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setState((prev) => ({
        ...prev,
        isCalling: false,
        error: errorMsg,
        connectionStatus: 'failed',
      }));
      toast.error(errorMsg);
    }
  }, [initializePeerConnection, getMediaStream, userRole, userId]);

  // Answer call (receiver)
  const answerCall = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isAnswering: true, error: null, connectionStatus: 'connecting' }));
      isInitiatorRef.current = false;

      const peerConnection = peerConnectionRef.current;
      if (!peerConnection) {
        throw new Error('No incoming call to answer. Please wait for the call.');
      }

      // Get media stream
      const stream = await getMediaStream(true);
      setState((prev) => ({ ...prev, localStream: stream }));

      // Add tracks
      stream.getTracks().forEach((track) => {
        console.log('[WebRTC] Adding track for answer:', track.kind);
        peerConnection.addTrack(track, stream);
      });

      // Create and send answer
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      console.log('[WebRTC] Sending answer');
      signalChannelRef.current?.send({
        type: 'broadcast',
        event: 'answer',
        payload: {
          sdp: peerConnection.localDescription?.sdp,
          type: 'answer',
          senderId: userId,
        },
      });

      setState((prev) => ({ ...prev, isAnswering: false, incomingCall: false }));
      toast.success('Call connected');
    } catch (error) {
      console.error('[WebRTC] Error answering call:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setState((prev) => ({
        ...prev,
        isAnswering: false,
        error: errorMsg,
        connectionStatus: 'failed',
      }));
      toast.error(errorMsg);
    }
  }, [getMediaStream, userId]);

  // End call
  const endCall = useCallback((fromRemote: boolean = false) => {
    if (isEndingCallRef.current) return;
    isEndingCallRef.current = true;

    console.log('[WebRTC] Ending call', fromRemote ? '(remote)' : '(local)');

    // Stop stats monitoring
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }

    // Stop all tracks
    if (state.localStream) {
      state.localStream.getTracks().forEach((track) => {
        track.stop();
        console.log('[WebRTC] Stopped track:', track.kind);
      });
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Send end signal if local
    if (!fromRemote && signalChannelRef.current) {
      signalChannelRef.current.send({
        type: 'broadcast',
        event: 'call-end',
        payload: { senderId: userId },
      });
    }

    // Clear timeout
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    setState({
      localStream: null,
      remoteStream: null,
      isCallActive: false,
      isCalling: false,
      isAnswering: false,
      incomingCall: false,
      callerName: null,
      error: null,
      connectionStatus: 'idle',
      networkQuality: 'unknown',
    });

    isInitiatorRef.current = false;
    reconnectAttemptRef.current = 0;
    toast.success('Call ended');

    setTimeout(() => {
      isEndingCallRef.current = false;
    }, 500);
  }, [state.localStream, userId]);

  // Toggle audio
  const toggleAudio = useCallback((enabled: boolean) => {
    if (state.localStream) {
      state.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
        console.log('[WebRTC] Audio track enabled:', enabled);
      });
    }
  }, [state.localStream]);

  // Toggle video
  const toggleVideo = useCallback((enabled: boolean) => {
    if (state.localStream) {
      state.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
        console.log('[WebRTC] Video track enabled:', enabled);
      });
    }
  }, [state.localStream]);

  // Switch camera (mobile)
  const switchCamera = useCallback(async () => {
    if (!state.localStream) return;

    try {
      const newFacingMode = currentFacingModeRef.current === 'user' ? 'environment' : 'user';
      currentFacingModeRef.current = newFacingMode;

      // Stop current video track
      state.localStream.getVideoTracks().forEach((track) => track.stop());

      // Get new stream with different camera
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode },
        audio: false,
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      
      // Replace track in peer connection
      const pc = peerConnectionRef.current;
      if (pc) {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
        }
      }

      // Update local stream
      const currentAudioTrack = state.localStream.getAudioTracks()[0];
      const updatedStream = new MediaStream();
      if (currentAudioTrack) updatedStream.addTrack(currentAudioTrack);
      updatedStream.addTrack(newVideoTrack);

      setState((prev) => ({ ...prev, localStream: updatedStream }));
      toast.success(`Switched to ${newFacingMode === 'user' ? 'front' : 'back'} camera`);
    } catch (error) {
      console.error('[WebRTC] Error switching camera:', error);
      toast.error('Could not switch camera');
    }
  }, [state.localStream]);

  // Dismiss incoming call
  const dismissIncomingCall = useCallback(() => {
    setState((prev) => ({
      ...prev,
      incomingCall: false,
      isAnswering: false,
      callerName: null,
    }));
  }, []);

  // Setup signaling channel
  useEffect(() => {
    const channel = supabase.channel(`video-call-${appointmentId}`);

    channelReadyRef.current = new Promise<void>((resolve) => {
      resolveChannelReadyRef.current = resolve;
    });

    const handleOffer = async (payload: any) => {
      const offerPayload = payload.payload;
      
      // Ignore our own messages
      if (offerPayload.senderId === userId) {
        console.log('[WebRTC] Ignoring own offer');
        return;
      }

      console.log('[WebRTC] Received offer');

      try {
        // Handle glare: if we already have a local offer, use tie-breaking
        let peerConnection = peerConnectionRef.current;
        
        if (peerConnection && peerConnection.signalingState === 'have-local-offer') {
          // Glare condition: both sides sent offers
          // Use polite peer logic: higher userId yields (rolls back)
          const shouldYield = userId > offerPayload.senderId;
          
          if (shouldYield) {
            console.log('[WebRTC] Glare detected, yielding (rolling back)');
            await peerConnection.setLocalDescription({ type: 'rollback' });
            isInitiatorRef.current = false;
          } else {
            console.log('[WebRTC] Glare detected, ignoring remote offer (we take priority)');
            return;
          }
        }

        // Create new peer connection if needed
        if (!peerConnection || peerConnection.signalingState === 'closed') {
          peerConnection = initializePeerConnection();
        }

        const offer = new RTCSessionDescription({
          type: 'offer',
          sdp: offerPayload.sdp,
        });

        await peerConnection.setRemoteDescription(offer);
        console.log('[WebRTC] Set remote offer');

        // Process buffered ICE candidates
        for (const candidate of pendingIceCandidatesRef.current) {
          try {
            await peerConnection.addIceCandidate(candidate);
          } catch (err) {
            console.error('[WebRTC] Error adding buffered ICE:', err);
          }
        }
        pendingIceCandidatesRef.current = [];

        // Show incoming call notification
        setState((prev) => ({
          ...prev,
          isAnswering: true,
          incomingCall: true,
          callerName: offerPayload.callerName || 'Caller',
          connectionStatus: 'connecting',
        }));
      } catch (error) {
        console.error('[WebRTC] Error handling offer:', error);
        toast.error('Failed to receive call');
      }
    };

    const handleAnswer = async (payload: any) => {
      const answerPayload = payload.payload;
      
      // Ignore our own messages
      if (answerPayload.senderId === userId) {
        console.log('[WebRTC] Ignoring own answer');
        return;
      }

      try {
        const peerConnection = peerConnectionRef.current;
        if (!peerConnection) {
          console.error('[WebRTC] No peer connection for answer');
          return;
        }

        if (peerConnection.signalingState !== 'have-local-offer') {
          console.warn('[WebRTC] Ignoring answer in state:', peerConnection.signalingState);
          return;
        }

        const answer = new RTCSessionDescription({
          type: 'answer',
          sdp: answerPayload.sdp,
        });

        await peerConnection.setRemoteDescription(answer);
        console.log('[WebRTC] Set remote answer');

        // Process buffered ICE candidates
        for (const candidate of pendingIceCandidatesRef.current) {
          try {
            await peerConnection.addIceCandidate(candidate);
          } catch (err) {
            console.error('[WebRTC] Error adding buffered ICE:', err);
          }
        }
        pendingIceCandidatesRef.current = [];
      } catch (error) {
        console.error('[WebRTC] Error handling answer:', error);
        toast.error('Failed to establish connection');
      }
    };

    const handleIceCandidate = async (payload: any) => {
      try {
        const candidatePayload = payload.payload;
        if (!candidatePayload.candidate) return;

        const candidate = new RTCIceCandidate({
          candidate: candidatePayload.candidate,
          sdpMLineIndex: candidatePayload.sdpMLineIndex,
          sdpMid: candidatePayload.sdpMid,
        });

        const peerConnection = peerConnectionRef.current;
        if (peerConnection?.remoteDescription) {
          await peerConnection.addIceCandidate(candidate);
        } else {
          console.log('[WebRTC] Buffering ICE candidate');
          pendingIceCandidatesRef.current.push(candidate);
        }
      } catch (error) {
        console.error('[WebRTC] Error adding ICE candidate:', error);
      }
    };

    const handleCallEnd = (payload: any) => {
      if (payload.payload?.senderId === userId) return;
      console.log('[WebRTC] Remote ended call');
      endCall(true);
    };

    channel
      .on('broadcast', { event: 'offer' }, handleOffer)
      .on('broadcast', { event: 'answer' }, handleAnswer)
      .on('broadcast', { event: 'ice-candidate' }, handleIceCandidate)
      .on('broadcast', { event: 'call-end' }, handleCallEnd)
      .subscribe((status) => {
        console.log('[WebRTC] Channel status:', status);
        if (status === 'SUBSCRIBED') {
          signalChannelRef.current = channel;
          setTimeout(() => {
            resolveChannelReadyRef.current?.();
            resolveChannelReadyRef.current = null;
          }, 0);
        } else if (status === 'CHANNEL_ERROR') {
          setState((prev) => ({ ...prev, error: 'Signaling connection failed' }));
          resolveChannelReadyRef.current?.();
        } else if (status === 'CLOSED') {
          signalChannelRef.current = null;
        }
      });

    return () => {
      console.log('[WebRTC] Cleaning up channel');
      supabase.removeChannel(channel);
      signalChannelRef.current = null;
    };
  }, [appointmentId, userId, initializePeerConnection, endCall]);

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
      switchCamera,
    },
  ];
};
