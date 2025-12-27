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
  callDuration: number; // in seconds
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
  availableCameras: MediaDeviceInfo[];
  selectedCameraId: string | null;
}

interface WebRTCCallActions {
  startCall: () => Promise<void>;
  answerCall: () => Promise<void>;
  endCall: () => void;
  toggleAudio: (enabled: boolean) => void;
  toggleVideo: (enabled: boolean) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  switchCamera: (deviceId: string) => Promise<void>;
  getAvailableCameras: () => Promise<MediaDeviceInfo[]>;
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
    callDuration: 0,
    connectionQuality: 'unknown',
    availableCameras: [],
    selectedCameraId: null,
  });

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const signalChannelRef = useRef<any>(null);
  const iceCandidatesRef = useRef<RTCIceCandidate[]>([]);
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelReadyRef = useRef<Promise<void>>(Promise.resolve());
  const resolveChannelReadyRef = useRef<(() => void) | null>(null);
  const remoteDescriptionSetRef = useRef<boolean>(false);
  const callStartTimeRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const qualityCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  // Helper function to get user media with fallback support
  const getUserMediaWithFallback = useCallback(async (constraints: MediaStreamConstraints): Promise<MediaStream> => {
    // Check if we're on a secure context (HTTPS, localhost, or local network IP)
    const isHttps = location.protocol === 'https:';
    const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    
    // Check if it's a local network IP (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    const isLocalNetworkIP = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(location.hostname);
    
    // Allow secure context, localhost, or local network IPs for development
    // Note: Browsers may still require HTTPS or localhost for getUserMedia, but we allow the attempt
    const isSecureContext = window.isSecureContext || isHttps || isLocalhost || isLocalNetworkIP;
    
    // Check if navigator.mediaDevices is available (browsers only expose this on secure contexts)
    const hasMediaDevices = typeof navigator !== 'undefined' && typeof navigator.mediaDevices !== 'undefined';
    
    console.log('[WebRTC] Checking media access:', {
      isSecureContext,
      windowIsSecureContext: window.isSecureContext,
      protocol: location.protocol,
      hostname: location.hostname,
      isHttps,
      isLocalhost,
      isLocalNetworkIP,
      hasMediaDevices,
      hasGetUserMedia: hasMediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function',
    });
    
    // Try to use getUserMedia regardless of context - let the browser handle security
    // Browsers will block it if not on secure context, but we'll catch that error
    // This allows the app to work on any URL and show appropriate error messages

    // Check if we're in a browser environment
    if (typeof navigator === 'undefined') {
      throw new Error('This feature requires a browser environment. Navigator API is not available.');
    }

    // Try modern API first
    if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
      console.log('[WebRTC] Using modern getUserMedia API');
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (error: any) {
        console.error('[WebRTC] Modern API failed:', error);
        
        // If it's a security/permission error and we're on HTTP with local network IP,
        // suggest using localhost instead
        if (
          (error.name === 'NotAllowedError' || error.name === 'SecurityError' || error.message?.includes('secure')) &&
          !isHttps &&
          isLocalNetworkIP &&
          !isLocalhost
        ) {
          throw new Error(
            'Browser security requires HTTPS or localhost for camera access. ' +
            'Please access the app via http://localhost:8080 instead of the IP address, ' +
            'or set up HTTPS for your local server.'
          );
        }
        
        // Re-throw the error so it can be handled by the caller
        throw error;
      }
    }

    // Fallback to legacy API
    const legacyGetUserMedia = 
      (typeof (navigator as any).getUserMedia === 'function' ? (navigator as any).getUserMedia : null) ||
      (typeof (navigator as any).webkitGetUserMedia === 'function' ? (navigator as any).webkitGetUserMedia : null) ||
      (typeof (navigator as any).mozGetUserMedia === 'function' ? (navigator as any).mozGetUserMedia : null);

    if (legacyGetUserMedia && typeof legacyGetUserMedia === 'function') {
      console.log('[WebRTC] Using legacy getUserMedia API');
      // Legacy API uses callbacks, so we need to wrap it in a Promise
      return new Promise((resolve, reject) => {
        try {
          legacyGetUserMedia.call(navigator, constraints, resolve, reject);
        } catch (legacyError) {
          console.error('[WebRTC] Legacy API call failed:', legacyError);
          reject(legacyError);
        }
      });
    }

    // If we get here, neither API is available
    const debugInfo = {
      hasNavigator: typeof navigator !== 'undefined',
      hasMediaDevices: typeof navigator !== 'undefined' && typeof navigator.mediaDevices !== 'undefined',
      hasGetUserMedia: typeof navigator !== 'undefined' && 
                       typeof navigator.mediaDevices !== 'undefined' && 
                       typeof navigator.mediaDevices.getUserMedia === 'function',
      hasLegacyGetUserMedia: typeof navigator !== 'undefined' && typeof (navigator as any).getUserMedia === 'function',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
      protocol: location.protocol,
      hostname: location.hostname,
    };
    
    console.error('[WebRTC] No getUserMedia API available', debugInfo);
    
    // Provide more specific error message
    if (!debugInfo.hasNavigator) {
      throw new Error('Navigator API is not available. Please ensure you are running this in a browser.');
    }
    
    if (!debugInfo.hasMediaDevices) {
      throw new Error(
        'MediaDevices API is not available. ' +
        'This usually means you need to use HTTPS or localhost. ' +
        'Current URL: ' + location.href + '. ' +
        'Please try accessing via http://localhost:8080'
      );
    }
    
    throw new Error(
      'Camera/Microphone access is not available. ' +
      'Please ensure you are using a modern browser (Chrome, Firefox, Edge, or Safari) ' +
      'and that you are accessing the site via HTTPS or localhost. ' +
      'Current URL: ' + location.href
    );
  }, []);

  const configuration = {
    iceServers: [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    ],
  };

  // Helper function to stop call timers
  const stopCallTimers = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (qualityCheckIntervalRef.current) {
      clearInterval(qualityCheckIntervalRef.current);
      qualityCheckIntervalRef.current = null;
    }
    callStartTimeRef.current = null;
  }, []);

  // Check connection quality
  const checkConnectionQuality = useCallback(() => {
    const peerConnection = peerConnectionRef.current;
    if (!peerConnection || peerConnection.connectionState !== 'connected') {
      return;
    }

    const stats = peerConnection.getStats();
    stats.then((report) => {
      let quality: 'excellent' | 'good' | 'fair' | 'poor' = 'good';
      
      report.forEach((stat) => {
        if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
          // Check RTT (Round Trip Time)
          if (stat.currentRoundTripTime) {
            const rtt = stat.currentRoundTripTime * 1000; // Convert to ms
            if (rtt < 100) quality = 'excellent';
            else if (rtt < 200) quality = 'good';
            else if (rtt < 400) quality = 'fair';
            else quality = 'poor';
          }
        }
      });

      setState((prev) => ({ ...prev, connectionQuality: quality }));
    }).catch((error) => {
      console.warn('[WebRTC] Error checking connection quality:', error);
    });
  }, []);

  // Get or create peer connection (ensures only ONE instance exists)
  const getOrCreatePeerConnection = useCallback(() => {
    // If we have an existing, non-closed connection, reuse it
    if (peerConnectionRef.current && peerConnectionRef.current.signalingState !== 'closed') {
      console.log('[WebRTC] Reusing existing peer connection, signalingState:', peerConnectionRef.current.signalingState);
      return peerConnectionRef.current;
    }

    // Close any existing connection before creating a new one
    if (peerConnectionRef.current) {
      console.log('[WebRTC] Closing old peer connection before creating new one');
      try {
        peerConnectionRef.current.close();
      } catch (e) {
        console.warn('[WebRTC] Error closing old connection:', e);
      }
      peerConnectionRef.current = null;
    }

    // Create new peer connection
    try {
      console.log('[WebRTC] Creating NEW peer connection');
      const peerConnection = new RTCPeerConnection(configuration);

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('[WebRTC] ICE candidate generated:', event.candidate.candidate.substring(0, 50) + '...');
          // Send ICE candidate through Supabase realtime
          if (signalChannelRef.current) {
            try {
              signalChannelRef.current.send({
                type: 'broadcast',
                event: 'ice-candidate',
                payload: {
                  candidate: event.candidate.candidate,
                  sdpMLineIndex: event.candidate.sdpMLineIndex,
                  sdpMid: event.candidate.sdpMid,
                },
              });
              console.log('[WebRTC] ICE candidate sent successfully');
            } catch (error) {
              console.error('[WebRTC] Error sending ICE candidate:', error);
            }
          } else {
            console.warn('[WebRTC] Signal channel not ready, buffering ICE candidate');
            iceCandidatesRef.current.push(event.candidate);
          }
        } else {
          console.log('[WebRTC] All ICE candidates gathered');
        }
      };

      peerConnection.ontrack = (event) => {
        console.log('[WebRTC] 🔴 Remote track received:', {
          kind: event.track.kind,
          id: event.track.id,
          enabled: event.track.enabled,
          readyState: event.track.readyState,
          streamsCount: event.streams?.length || 0,
          transceiver: event.transceiver?.mid,
        });

        // CRITICAL: Ensure track is enabled
        if (!event.track.enabled) {
          console.warn('[WebRTC] Track is disabled, enabling it');
          event.track.enabled = true;
        }

        // Handle remote stream - tracks can come with or without streams
        setState((prev) => {
          let updatedStream: MediaStream | null = null;

          if (event.streams && event.streams.length > 0) {
            // Track came with a stream - use it
            updatedStream = event.streams[0];
            console.log('[WebRTC] ✅ Using stream from event, tracks:', updatedStream.getTracks().map(t => ({ 
              kind: t.kind, 
              id: t.id, 
              enabled: t.enabled,
              readyState: t.readyState,
            })));
          } else if (prev.remoteStream || remoteStreamRef.current) {
            // We already have a remote stream - add this track to it
            const existingStream = remoteStreamRef.current || prev.remoteStream;
            if (existingStream) {
              const hasTrack = existingStream.getTracks().some(t => t.id === event.track.id);
              if (!hasTrack) {
                existingStream.addTrack(event.track);
                console.log('[WebRTC] ✅ Added track to existing remote stream:', event.track.kind);
                updatedStream = existingStream;
                remoteStreamRef.current = existingStream;
              } else {
                console.log('[WebRTC] Track already in stream, skipping');
                return prev;
              }
            }
          } else {
            // No existing stream and no stream in event - create new one
            updatedStream = new MediaStream([event.track]);
            console.log('[WebRTC] ✅ Created new remote stream from track:', event.track.kind);
          }

          if (updatedStream) {
            // Ensure all tracks are enabled
            updatedStream.getTracks().forEach(track => {
              if (!track.enabled) {
                console.warn('[WebRTC] Enabling disabled track:', track.kind);
                track.enabled = true;
              }
            });

            // Update ref
            remoteStreamRef.current = updatedStream;

            // Create a NEW stream instance to force React re-render
            const newStream = new MediaStream(updatedStream.getTracks());
            
            // Log stream details
            console.log('[WebRTC] 🎥 Remote stream updated:', {
              id: newStream.id,
              active: newStream.active,
              tracks: newStream.getTracks().map(t => ({
                kind: t.kind,
                id: t.id,
                enabled: t.enabled,
                readyState: t.readyState,
              })),
            });

            // Force update to trigger re-render
            return { ...prev, remoteStream: newStream };
          }

          return prev;
        });
      };

      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        console.log('[WebRTC] Connection state changed to:', state);
        
        if (state === 'connected') {
          console.log('[WebRTC] ✅ Connection established successfully!');
          callStartTimeRef.current = Date.now();
          setState((prev) => ({ ...prev, isCallActive: true, error: null }));
          
          // CRITICAL: Check for remote tracks via receivers (fallback if ontrack didn't fire)
          setTimeout(() => {
            const receivers = peerConnection.getReceivers();
            console.log('[WebRTC] 🔍 Checking receivers after connection:', receivers.length);
            receivers.forEach((receiver, index) => {
              const track = receiver.track;
              if (track) {
                console.log(`[WebRTC] Receiver ${index}:`, {
                  kind: track.kind,
                  id: track.id,
                  enabled: track.enabled,
                  readyState: track.readyState,
                });
                
                // If we have a track but no remote stream, create one
                setState((prev) => {
                  if (!prev.remoteStream && track) {
                    const newStream = new MediaStream([track]);
                    remoteStreamRef.current = newStream;
                    console.log('[WebRTC] 🎥 Created remote stream from receiver:', track.kind);
                    return { ...prev, remoteStream: newStream };
                  } else if (prev.remoteStream && track) {
                    // Check if track is already in stream
                    const hasTrack = prev.remoteStream.getTracks().some(t => t.id === track.id);
                    if (!hasTrack) {
                      prev.remoteStream.addTrack(track);
                      remoteStreamRef.current = prev.remoteStream;
                      const updatedStream = new MediaStream(prev.remoteStream.getTracks());
                      console.log('[WebRTC] 🎥 Added track to remote stream from receiver:', track.kind);
                      return { ...prev, remoteStream: updatedStream };
                    }
                  }
                  return prev;
                });
              }
            });
          }, 1000); // Wait 1 second after connection to check receivers
          
          // Start call duration timer
          if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
          }
          durationIntervalRef.current = setInterval(() => {
            if (callStartTimeRef.current) {
              const duration = Math.floor((Date.now() - callStartTimeRef.current!) / 1000);
              setState((prev) => ({ ...prev, callDuration: duration }));
            }
          }, 1000);

          // Start connection quality monitoring
          if (qualityCheckIntervalRef.current) {
            clearInterval(qualityCheckIntervalRef.current);
          }
          qualityCheckIntervalRef.current = setInterval(() => {
            checkConnectionQuality();
          }, 5000);

          if (callTimeoutRef.current) {
            clearTimeout(callTimeoutRef.current);
            callTimeoutRef.current = null;
          }
        } else if (state === 'connecting') {
          console.log('[WebRTC] 🔄 Connecting...');
          setState((prev) => ({ ...prev, connectionQuality: 'unknown' }));
        } else if (state === 'disconnected') {
          console.log('[WebRTC] ⚠️ Connection disconnected');
          setState((prev) => ({ ...prev, isCallActive: false, connectionQuality: 'poor' }));
          stopCallTimers();
        } else if (state === 'failed') {
          console.error('[WebRTC] ❌ Connection failed');
          toast.error('Call connection failed. Please try again.');
          setState((prev) => ({ ...prev, isCallActive: false, error: 'Connection failed', connectionQuality: 'poor' }));
          stopCallTimers();
        } else if (state === 'closed') {
          console.log('[WebRTC] Connection closed');
          setState((prev) => ({ ...prev, isCallActive: false }));
          stopCallTimers();
        }
      };

      peerConnection.onsignalingstatechange = () => {
        const signalingState = peerConnection.signalingState;
        console.log('[WebRTC] Signaling state changed to:', signalingState);
        
        if (signalingState === 'stable') {
          console.log('[WebRTC] Signaling is stable');
        } else if (signalingState === 'have-local-offer') {
          console.log('[WebRTC] Have local offer, waiting for answer');
        } else if (signalingState === 'have-remote-offer') {
          console.log('[WebRTC] Have remote offer, ready to answer');
        } else if (signalingState === 'have-local-pranswer') {
          console.log('[WebRTC] Have local pranswer');
        } else if (signalingState === 'have-remote-pranswer') {
          console.log('[WebRTC] Have remote pranswer');
        } else if (signalingState === 'closed') {
          console.log('[WebRTC] Signaling closed');
        }
      };

      peerConnectionRef.current = peerConnection;
      return peerConnection;
    } catch (error) {
      console.error('[WebRTC] Error creating peer connection:', error);
      peerConnectionRef.current = null;
      setState((prev) => ({ ...prev, error: 'Failed to create peer connection' }));
      throw error;
    }
  }, []);

  // Initialize peer connection (deprecated - use getOrCreatePeerConnection instead)
  const initializePeerConnection = useCallback(() => {
    return getOrCreatePeerConnection();
  }, [getOrCreatePeerConnection]);

  // Start call (initiator)
  const startCall = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isCalling: true, error: null }));

      // Wait for signaling channel to be ready
      console.log('[WebRTC] Waiting for signaling channel to be ready...');
      if (channelReadyRef.current) {
        await channelReadyRef.current;
      }
      
      // Check if signal channel is ready
      if (!signalChannelRef.current) {
        throw new Error('Signaling channel not ready. Please wait a moment and try again.');
      }

      // Clear any previous state
      iceCandidatesRef.current = [];
      remoteDescriptionSetRef.current = false;

      // Get or create peer connection (ensures only ONE instance)
      // This will close any existing connection before creating a new one
      const peerConnection = getOrCreatePeerConnection();

      // Get local media stream with better error handling
      let stream: MediaStream;
      try {
        // Always request video and audio - we can disable tracks later
        stream = await getUserMediaWithFallback({
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
          throw new Error(
            'Camera/Microphone is in use by another application or browser window. ' +
            'If testing on the same device, make sure to: ' +
            '1) Close other browser tabs/windows using the camera, ' +
            '2) Use different browsers (Chrome + Firefox) instead of tabs, ' +
            '3) Or close other apps using the camera (Zoom, Teams, etc.). ' +
            'Then refresh and try again.'
          );
        } else if (mediaError.name === 'SecurityError') {
          throw new Error('Secure connection required for camera access. Please use HTTPS or localhost.');
        } else if (
          mediaError.message && (
            mediaError.message.includes('videoinput') ||
            mediaError.message.includes('Starting videoinput') ||
            mediaError.message.includes('video input') ||
            mediaError.message.includes('TrackStartError') ||
            mediaError.message.includes('Could not start video source')
          )
        ) {
          throw new Error(
            'Camera hardware error: Unable to start video input. ' +
            'This usually means: ' +
            '1) Camera driver needs updating, ' +
            '2) Camera is physically disconnected or damaged, ' +
            '3) Another application has exclusive access to the camera, ' +
            '4) Browser needs to be restarted. ' +
            'Try: Restart your browser, update camera drivers, or use a different camera if available.'
          );
        } else if (mediaError.message && mediaError.message.includes('getUserMedia')) {
          throw new Error('Camera/Microphone access is not available. Please check your browser permissions and ensure you are using HTTPS or localhost.');
        } else {
          throw new Error(`Camera/Microphone access failed: ${mediaError.message || 'Unknown error'}`);
        }
      }

      setState((prev) => ({ ...prev, localStream: stream }));

      // Add tracks to peer connection
      stream.getTracks().forEach((track) => {
        console.log('[WebRTC] Adding track:', track.kind, 'enabled:', track.enabled);
        const sender = peerConnection.addTrack(track, stream);
        console.log('[WebRTC] Track added, sender:', {
          trackId: sender.track?.id,
          trackKind: sender.track?.kind,
        });
      });

      // Ensure transceivers are set up for receiving
      const transceivers = peerConnection.getTransceivers();
      console.log('[WebRTC] Transceivers after adding tracks:', transceivers.length);
      transceivers.forEach((transceiver, index) => {
        console.log(`[WebRTC] Transceiver ${index}:`, {
          mid: transceiver.mid,
          direction: transceiver.direction,
          currentDirection: transceiver.currentDirection,
          receiverTrack: transceiver.receiver.track?.kind,
          senderTrack: transceiver.sender.track?.kind,
        });
        
        // Ensure transceiver can receive
        if (transceiver.direction === 'sendonly') {
          transceiver.direction = 'sendrecv';
          console.log(`[WebRTC] Changed transceiver ${index} direction to sendrecv`);
        }
      });

      // Create and send offer with proper media constraints
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await peerConnection.setLocalDescription(offer);
      
      console.log('[WebRTC] Offer created:', {
        type: offer.type,
        sdp: offer.sdp.substring(0, 200) + '...',
        tracks: peerConnection.getSenders().map(s => ({
          kind: s.track?.kind,
          enabled: s.track?.enabled,
        })),
      });

      console.log('[WebRTC] Sending offer with signalingState:', peerConnection.signalingState);
      
      // Double-check channel is ready before sending
      const channel = signalChannelRef.current;
      if (!channel) {
        // Wait a bit and retry
        await new Promise(resolve => setTimeout(resolve, 500));
        if (!signalChannelRef.current) {
          throw new Error('Signaling channel not ready. Please wait a moment and try again.');
        }
      }

      const finalChannel = signalChannelRef.current;
      if (!finalChannel) {
        throw new Error('Signaling channel disconnected. Please refresh and try again.');
      }

      try {
        finalChannel.send({
          type: 'broadcast',
          event: 'offer',
          payload: {
            sdp: peerConnection.localDescription?.sdp,
            type: 'offer',
          },
        });
        console.log('[WebRTC] Offer sent successfully');
      } catch (sendError) {
        console.error('[WebRTC] Error sending offer:', sendError);
        throw new Error('Failed to send call offer. Please check your connection and try again.');
      }

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
  }, [initializePeerConnection, getUserMediaWithFallback]);

  // Answer call (receiver)
  const answerCall = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isAnswering: true, error: null }));

      // Get or create peer connection (ensures only ONE instance)
      const peerConnection = getOrCreatePeerConnection();

      if (!peerConnection.remoteDescription) {
        throw new Error('No call offer received yet. Please wait for the other person to start the call.');
      }

      // Get local media stream with better error handling
      let stream: MediaStream;
      try {
        // Always request video and audio - we can disable tracks later
        stream = await getUserMediaWithFallback({
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
          throw new Error(
            'Camera/Microphone is in use by another application or browser window. ' +
            'If testing on the same device, make sure to: ' +
            '1) Close other browser tabs/windows using the camera, ' +
            '2) Use different browsers (Chrome + Firefox) instead of tabs, ' +
            '3) Or close other apps using the camera (Zoom, Teams, etc.). ' +
            'Then refresh and try again.'
          );
        } else if (mediaError.name === 'SecurityError') {
          throw new Error('Secure connection required for camera access. Please use HTTPS or localhost.');
        } else if (
          mediaError.message && (
            mediaError.message.includes('videoinput') ||
            mediaError.message.includes('Starting videoinput') ||
            mediaError.message.includes('video input') ||
            mediaError.message.includes('TrackStartError') ||
            mediaError.message.includes('Could not start video source')
          )
        ) {
          throw new Error(
            'Camera hardware error: Unable to start video input. ' +
            'This usually means: ' +
            '1) Camera driver needs updating, ' +
            '2) Camera is physically disconnected or damaged, ' +
            '3) Another application has exclusive access to the camera, ' +
            '4) Browser needs to be restarted. ' +
            'Try: Restart your browser, update camera drivers, or use a different camera if available.'
          );
        } else if (mediaError.message && mediaError.message.includes('getUserMedia')) {
          throw new Error('Camera/Microphone access is not available. Please check your browser permissions and ensure you are using HTTPS or localhost.');
        } else {
          throw new Error(`Camera/Microphone access failed: ${mediaError.message || 'Unknown error'}`);
        }
      }

      setState((prev) => ({ ...prev, localStream: stream }));

      // Add tracks to peer connection BEFORE creating answer
      stream.getTracks().forEach((track) => {
        console.log('[WebRTC] Adding track to answer:', track.kind, 'enabled:', track.enabled);
        const sender = peerConnection.addTrack(track, stream);
        console.log('[WebRTC] Track added for answer, sender:', {
          trackId: sender.track?.id,
          trackKind: sender.track?.kind,
        });
      });

      // Ensure transceivers are set up for receiving
      const transceivers = peerConnection.getTransceivers();
      console.log('[WebRTC] Transceivers after adding tracks for answer:', transceivers.length);
      transceivers.forEach((transceiver, index) => {
        console.log(`[WebRTC] Transceiver ${index} for answer:`, {
          mid: transceiver.mid,
          direction: transceiver.direction,
          currentDirection: transceiver.currentDirection,
          receiverTrack: transceiver.receiver.track?.kind,
          senderTrack: transceiver.sender.track?.kind,
        });
        
        // Ensure transceiver can receive
        if (transceiver.direction === 'sendonly') {
          transceiver.direction = 'sendrecv';
          console.log(`[WebRTC] Changed transceiver ${index} direction to sendrecv for answer`);
        }
      });

      // Create answer AFTER tracks are added with proper media constraints
      const answer = await peerConnection.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await peerConnection.setLocalDescription(answer);
      
      console.log('[WebRTC] Answer created:', {
        type: answer.type,
        sdp: answer.sdp.substring(0, 200) + '...',
        tracks: peerConnection.getSenders().map(s => ({
          kind: s.track?.kind,
          enabled: s.track?.enabled,
        })),
        receivers: peerConnection.getReceivers().map(r => ({
          kind: r.track?.kind,
          enabled: r.track?.enabled,
        })),
      });

      console.log('[WebRTC] Sending answer, signalingState:', peerConnection.signalingState);
      
      // Double-check channel is ready before sending
      if (!signalChannelRef.current) {
        // Wait a bit and retry
        await new Promise(resolve => setTimeout(resolve, 500));
        if (!signalChannelRef.current) {
          throw new Error('Signaling channel not ready. Please wait a moment and try again.');
        }
      }

      const channel = signalChannelRef.current;
      if (!channel) {
        throw new Error('Signaling channel disconnected. Please refresh and try again.');
      }

      try {
        channel.send({
          type: 'broadcast',
          event: 'answer',
          payload: {
            sdp: peerConnection.localDescription?.sdp,
            type: 'answer',
          },
        });
        console.log('[WebRTC] Answer sent successfully');
      } catch (sendError) {
        console.error('[WebRTC] Error sending answer:', sendError);
        throw new Error('Failed to send call answer. Please check your connection and try again.');
      }

      console.log('[WebRTC] Answer sent successfully');

      // Don't set isCallActive here - let connectionState change event handle it
      setState((prev) => ({ ...prev, isAnswering: false }));
      toast.success('Call answered');
    } catch (error) {
      console.error('[WebRTC] Error answering call:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setState((prev) => ({
        ...prev,
        isAnswering: false,
        error: `Failed to answer call: ${errorMsg}`,
      }));
      toast.error(errorMsg);
    }
  }, [getUserMediaWithFallback]);

  // Get available cameras
  const getAvailableCameras = useCallback(async (): Promise<MediaDeviceInfo[]> => {
    try {
      // Request permissions first (required for mobile devices to get labels)
      // This is a no-op if permissions are already granted
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        // Stop the temporary stream immediately
        tempStream.getTracks().forEach(track => track.stop());
      } catch (e) {
        console.warn('[WebRTC] Could not request permissions for camera enumeration:', e);
        // Continue anyway - we might still get device IDs
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      
      console.log('[WebRTC] Available cameras:', cameras.map(c => ({
        deviceId: c.deviceId,
        label: c.label || 'Unnamed Camera',
        groupId: c.groupId,
      })));

      setState((prev) => ({ ...prev, availableCameras: cameras }));
      return cameras;
    } catch (error) {
      console.error('[WebRTC] Error enumerating cameras:', error);
      return [];
    }
  }, []);

  // Switch camera
  const switchCamera = useCallback(async (deviceId: string) => {
    try {
      const peerConnection = peerConnectionRef.current;
      if (!peerConnection || !state.localStream) {
        throw new Error('No active call or stream');
      }

      console.log('[WebRTC] Switching camera to:', deviceId);

      // Detect mobile device
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      // Get new stream with selected camera - use mobile-friendly constraints
      const constraints: MediaStreamConstraints = {
        video: isMobile 
          ? { 
              deviceId: { exact: deviceId },
              facingMode: undefined, // Let device choose
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : { 
              deviceId: { exact: deviceId },
            },
        audio: true,
      };

      console.log('[WebRTC] Camera constraints:', constraints);
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Get the new video track
      const videoTrack = newStream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error('No video track in new stream');
      }

      console.log('[WebRTC] New video track:', {
        id: videoTrack.id,
        label: videoTrack.label,
        enabled: videoTrack.enabled,
        readyState: videoTrack.readyState,
      });

      // Get old video track
      const oldVideoTrack = state.localStream.getVideoTracks()[0];
      
      // Find the video sender in peer connection
      const sender = peerConnection.getSenders().find(s => 
        s.track && s.track.kind === 'video'
      );
      
      if (!sender) {
        throw new Error('No video sender found in peer connection');
      }

      // Replace track in peer connection FIRST (before updating local stream)
      console.log('[WebRTC] Replacing track in peer connection');
      await sender.replaceTrack(videoTrack);

      // Update local stream
      if (oldVideoTrack) {
        state.localStream.removeTrack(oldVideoTrack);
        oldVideoTrack.stop();
        console.log('[WebRTC] Old video track stopped');
      }
      
      state.localStream.addTrack(videoTrack);
      console.log('[WebRTC] New video track added to local stream');

      // Stop other tracks from new stream (we only need the video track)
      newStream.getAudioTracks().forEach(track => track.stop());
      newStream.getVideoTracks().forEach(track => {
        if (track.id !== videoTrack.id) {
          track.stop();
        }
      });

      // Update state with new stream reference to trigger re-render
      setState((prev) => ({ 
        ...prev, 
        localStream: new MediaStream(state.localStream.getTracks()),
        selectedCameraId: deviceId 
      }));

      console.log('[WebRTC] ✅ Camera switched successfully');
      toast.success('Camera switched');
    } catch (error) {
      console.error('[WebRTC] ❌ Error switching camera:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to switch camera: ${errorMessage}`);
      throw error;
    }
  }, [state.localStream]);

  // End call
  const endCall = useCallback(() => {
    console.log('[WebRTC] Ending call');

    // Stop all tracks
    if (state.localStream) {
      state.localStream.getTracks().forEach((track) => track.stop());
    }

    // Stop timers
    stopCallTimers();

    // Clear timeout
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Clear buffered ICE candidates
    iceCandidatesRef.current = [];
    remoteDescriptionSetRef.current = false;
    remoteStreamRef.current = null;

    // Send call end signal
    if (signalChannelRef.current) {
      try {
        signalChannelRef.current.send({
          type: 'broadcast',
          event: 'call-end',
          payload: {},
        });
      } catch (error) {
        console.warn('[WebRTC] Error sending call-end signal:', error);
      }
    }

    setState((prev) => ({
      ...prev,
      localStream: null,
      remoteStream: null,
      isCallActive: false,
      isCalling: false,
      isAnswering: false,
      error: null,
      callDuration: 0,
      connectionQuality: 'unknown',
    }));

    toast.success('Call ended');
  }, [state.localStream, stopCallTimers]);

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
          
          // Get or create peer connection (ensures only ONE instance)
          const peerConnection = getOrCreatePeerConnection();
          
          // If we already have a remote description, we might be processing a duplicate offer
          if (peerConnection.remoteDescription) {
            console.warn('[WebRTC] Received offer but already have remote description. Ignoring duplicate offer.');
            return;
          }

          // Clear any buffered ICE candidates from previous attempts
          iceCandidatesRef.current = [];
          remoteDescriptionSetRef.current = false;

          const offer = new RTCSessionDescription({
            type: 'offer' as RTCSdpType,
            sdp: payload.payload.sdp,
          });

          await peerConnection.setRemoteDescription(offer);
          remoteDescriptionSetRef.current = true;
          console.log('[WebRTC] Set remote description, ready to answer. Signaling state:', peerConnection.signalingState);

          // Process any buffered ICE candidates
          if (iceCandidatesRef.current.length > 0) {
            console.log('[WebRTC] Processing', iceCandidatesRef.current.length, 'buffered ICE candidates');
            for (const candidate of iceCandidatesRef.current) {
              try {
                await peerConnection.addIceCandidate(candidate);
              } catch (err) {
                console.warn('[WebRTC] Error adding buffered ICE candidate:', err);
              }
            }
            iceCandidatesRef.current = [];
          }

          setState((prev) => ({ ...prev, isAnswering: true }));
        } catch (error) {
          console.error('[WebRTC] Error handling offer:', error);
          toast.error('Failed to receive call');
          setState((prev) => ({ ...prev, error: 'Failed to receive call offer' }));
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
          remoteDescriptionSetRef.current = true;
          console.log('[WebRTC] Set remote answer successfully, signalingState is now:', peerConnection.signalingState);

          // Process any buffered ICE candidates
          if (iceCandidatesRef.current.length > 0) {
            console.log('[WebRTC] Processing', iceCandidatesRef.current.length, 'buffered ICE candidates');
            for (const candidate of iceCandidatesRef.current) {
              try {
                await peerConnection.addIceCandidate(candidate);
              } catch (err) {
                console.warn('[WebRTC] Error adding buffered ICE candidate:', err);
              }
            }
            iceCandidatesRef.current = [];
          }
        } catch (error) {
          console.error('[WebRTC] Error handling answer:', error);
          toast.error('Failed to establish connection');
          setState((prev) => ({ ...prev, error: 'Failed to process answer' }));
        }
      });

      channel.on('broadcast', { event: 'ice-candidate' }, async (payload) => {
        try {
          const peerConnection = peerConnectionRef.current;
          if (!peerConnection) {
            console.warn('[WebRTC] Received ICE candidate but no peer connection yet, buffering');
            if (payload.payload.candidate) {
              iceCandidatesRef.current.push(
                new RTCIceCandidate({
                  candidate: payload.payload.candidate,
                  sdpMLineIndex: payload.payload.sdpMLineIndex,
                  sdpMid: payload.payload.sdpMid,
                })
              );
            }
            return;
          }

          if (payload.payload.candidate) {
            const candidate = new RTCIceCandidate({
              candidate: payload.payload.candidate,
              sdpMLineIndex: payload.payload.sdpMLineIndex,
              sdpMid: payload.payload.sdpMid,
            });

            // Only add if remote description is set
            if (peerConnection.remoteDescription) {
              await peerConnection.addIceCandidate(candidate);
              console.log('[WebRTC] ICE candidate added successfully');
            } else {
              console.log('[WebRTC] Buffering ICE candidate until remote description is set');
              iceCandidatesRef.current.push(candidate);
            }
          }
        } catch (error) {
          console.error('[WebRTC] Error adding ICE candidate:', error);
          // If error is because remote description not set, buffer it
          if (error instanceof Error && error.message.includes('remote')) {
            if (payload.payload.candidate) {
              iceCandidatesRef.current.push(
                new RTCIceCandidate({
                  candidate: payload.payload.candidate,
                  sdpMLineIndex: payload.payload.sdpMLineIndex,
                  sdpMid: payload.payload.sdpMid,
                })
              );
            }
          }
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
        // Resolve the promise to indicate channel is ready
        if (resolveChannelReadyRef.current) {
          resolveChannelReadyRef.current();
          resolveChannelReadyRef.current = null;
        }
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[WebRTC] Signaling channel error');
        subscribed = false;
        setState((prev) => ({ ...prev, error: 'Failed to establish signaling channel' }));
        toast.error('Failed to establish signaling channel');
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
  }, [appointmentId, initializePeerConnection, endCall]);

  // Load available cameras on mount
  useEffect(() => {
    getAvailableCameras();
  }, [getAvailableCameras]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      stopCallTimers();
    };
  }, [stopCallTimers]);

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
      switchCamera,
      getAvailableCameras,
    },
  ];
};
