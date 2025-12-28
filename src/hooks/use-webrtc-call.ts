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
  const channelReadyRef = useRef(false);
  const channelReadyPromise = useRef<Promise<void> | null>(null);
  const resolveChannelReady = useRef<(() => void) | null>(null);

  /* ---------------- PEER CONNECTION ---------------- */

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    pc.onicecandidate = (e) => {
      if (e.candidate && signalChannelRef.current) {
        signalChannelRef.current.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: { from: userId, candidate: e.candidate },
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
      if (['failed', 'disconnected'].includes(pc.connectionState)) {
        endCall();
      }
    };

    return pc;
  }, [userId]);

  /* ---------------- START CALL ---------------- */

  const startCall = useCallback(async () => {
    try {
      setState((s) => ({ ...s, isCalling: true }));

      if (!channelReadyRef.current) {
        await channelReadyPromise.current;
      }

      if (!signalChannelRef.current) {
        throw new Error('Signaling channel not ready');
      }

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
    } catch (e: any) {
      toast.error(e.message || 'Call failed');
      setState((s) => ({ ...s, isCalling: false }));
    }
  }, [createPeerConnection, userId]);

  /* ---------------- ANSWER CALL ---------------- */

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

      signalChannelRef.current?.send({
        type: 'broadcast',
        event: 'answer',
        payload: { from: userId, sdp: answer.sdp },
      });

      toast.success('Call connected');
    } catch (e: any) {
      toast.error(e.message);
    }
  }, [userId]);

  /* ---------------- END CALL ---------------- */

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
  }, [state.localStream, userId]);

  /* ---------------- SIGNALING ---------------- */

  useEffect(() => {
    const channel = supabase.channel(`video-call-${appointmentId}`);

    channelReadyPromise.current = new Promise((resolve) => {
      resolveChannelReady.current = resolve;
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
        channelReadyRef.current = true;
        resolveChannelReady.current?.();
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [appointmentId, createPeerConnection]);

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
