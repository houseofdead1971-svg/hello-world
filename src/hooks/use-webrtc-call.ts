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
}

export const useWebRTCCall = (
  appointmentId: string,
  userId: string,
  userRole: 'doctor' | 'patient'
) => {
  const [state, setState] = useState<WebRTCCallState>({
    localStream: null,
    remoteStream: null,
    isCallActive: false,
    isCalling: false,
    isAnswering: false,
    error: null,
  });

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const signalChannelRef = useRef<any>(null);
  const isChannelReadyRef = useRef(false);
  const channelReadyPromiseRef = useRef<Promise<void> | null>(null);
  const resolveChannelReadyRef = useRef<(() => void) | null>(null);

  const iceConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  };

  /* ------------------ PEER CONNECTION ------------------ */
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(iceConfig);

    pc.onicecandidate = (e) => {
      if (e.candidate && signalChannelRef.current) {
        signalChannelRef.current.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: {
            from: userId,
            candidate: e.candidate,
          },
        });
      }
    };

    pc.ontrack = (e) => {
      setState((s) => ({ ...s, remoteStream: e.streams[0] }));
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setState((s) => ({ ...s, isCallActive: true }));
      }
      if (['disconnected', 'failed'].includes(pc.connectionState)) {
        endCall();
      }
    };

    return pc;
  }, [userId]);

  /* ------------------ START CALL ------------------ */
  const startCall = useCallback(async () => {
    try {
      setState((s) => ({ ...s, isCalling: true }));

      if (!isChannelReadyRef.current) {
        await channelReadyPromiseRef.current;
      }

      if (!signalChannelRef.current)
        throw new Error('Signaling channel not ready');

      const pc = createPeerConnection();
      peerConnectionRef.current = pc;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      setState((s) => ({ ...s, localStream: stream }));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      signalChannelRef.current.send({
        type: 'broadcast',
        event: 'offer',
        payload: { from: userId, sdp: offer.sdp },
      });

      toast.success('Calling...');
    } catch (err: any) {
      toast.error(err.message);
      setState((s) => ({ ...s, isCalling: false }));
    }
  }, []);

  /* ------------------ ANSWER CALL ------------------ */
  const answerCall = useCallback(async () => {
    try {
      const pc = peerConnectionRef.current;
      if (!pc) throw new Error('Peer connection missing');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      setState((s) => ({ ...s, localStream: stream }));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      signalChannelRef.current.send({
        type: 'broadcast',
        event: 'answer',
        payload: { from: userId, sdp: answer.sdp },
      });

      toast.success('Call connected');
    } catch (err: any) {
      toast.error(err.message);
    }
  }, [userId]);

  /* ------------------ END CALL ------------------ */
  const endCall = useCallback(() => {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    state.localStream?.getTracks().forEach((t) => t.stop());

    setState({
      localStream: null,
      remoteStream: null,
      isCallActive: false,
      isCalling: false,
      isAnswering: false,
      error: null,
    });

    signalChannelRef.current?.send({
      type: 'broadcast',
      event: 'call-end',
      payload: { from: userId },
    });
  }, [state.localStream]);

  /* ------------------ SIGNALING SETUP ------------------ */
  useEffect(() => {
    const channel = supabase.channel(`video-call-${appointmentId}`);

    channelReadyPromiseRef.current = new Promise((resolve) => {
      resolveChannelReadyRef.current = resolve;
    });

    channel
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (payload.from === userId) return;

        const pc = createPeerConnection();
        peerConnectionRef.current = pc;

        await pc.setRemoteDescription(
          new RTCSessionDescription({ type: 'offer', sdp: payload.sdp })
        );

        setState((s) => ({ ...s, isAnswering: true }));
      })

      .on('broadcast', { event: 'answer' }, async ({ payload }) => {
        if (payload.from === userId) return;
        await peerConnectionRef.current?.setRemoteDescription(
          new RTCSessionDescription({ type: 'answer', sdp: payload.sdp })
        );
      })

      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (payload.from === userId) return;
        await peerConnectionRef.current?.addIceCandidate(payload.candidate);
      });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        signalChannelRef.current = channel;
        isChannelReadyRef.current = true;
        resolveChannelReadyRef.current?.();
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [appointmentId]);

  return {
    state,
    startCall,
    answerCall,
    endCall,
    toggleAudio: (v: boolean) =>
      state.localStream?.getAudioTracks().forEach((t) => (t.enabled = v)),
    toggleVideo: (v: boolean) =>
      state.localStream?.getVideoTracks().forEach((t) => (t.enabled = v)),
  };
};
