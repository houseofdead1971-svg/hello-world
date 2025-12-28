udio: (v: boolean) =>
      state.localStream?.getAudioTracks().forEach((t) => (t.enabled = v)),
    toggleVideo: (v: boolean) =>
      state.localStream?.getVideoTracks().forEach((t) => (t.enabled = v)),
  };
};
