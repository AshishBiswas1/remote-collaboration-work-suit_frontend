import { useEffect, useMemo, useRef, useState } from "react";
import { io as ioClient } from 'socket.io-client';
import { useSharedChat } from "../../hooks/useSharedChat";

function formatTime(ts = Date.now()) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(ts);
}

function buildStream(audioTrack, videoTrack) {
  const tracks = [];
  if (audioTrack) tracks.push(audioTrack);
  if (videoTrack) tracks.push(videoTrack);
  return new MediaStream(tracks);
}

function stopTrack(track) {
  try {
    track?.stop();
  } catch {}
}

function MicIcon({ off = false }) {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
      <rect x="9" y="4" width="6" height="10" rx="3"></rect>
      <rect x="11" y="14" width="2" height="4"></rect>
      <path d="M7 12a5 5 0 0010 0" stroke="currentColor" strokeWidth="2" fill="none"></path>
      {off && <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="2"></line>}
    </svg>
  );
}

function CamIcon({ off = false }) {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
      <rect x="3.5" y="6" width="11" height="8" rx="2"></rect>
      <polygon points="16,8 20.5,6 20.5,14 16,12"></polygon>
      {off && <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="2"></line>}
    </svg>
  );
}

function ScreenIcon({ on = false }) {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6">
      <rect x="3" y="5" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="2"></rect>
      <path d="M12 9v6" stroke="currentColor" strokeWidth="2"></path>
      <path d="M9 12l3-3 3 3" stroke="currentColor" strokeWidth="2" fill="none"></path>
      {on && <circle cx="20" cy="6" r="2" fill="currentColor"></circle>}
    </svg>
  );
}

function HandIcon({ up = false }) {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 12V7a2 2 0 1 1 4 0v5" />
      <path d="M12 12V6a2 2 0 1 1 4 0v6" />
      <path d="M16 12v-3a2 2 0 1 1 4 0v5c0 3-2.5 6-7 6s-7-3-7-6v-1" />
      {up && <circle cx="5" cy="11" r="1.5" fill="currentColor" stroke="none" />}
    </svg>
  );
}

function EjectIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor">
      <polygon points="12,7 6,14 18,14"></polygon>
      <rect x="6" y="16" width="12" height="2"></rect>
    </svg>
  );
}

export function VideoCall({ roomId, user }) {
  const localVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const localStreamRef = useRef(null); // Store current local stream
  
  // Persist camera state in localStorage for this room
  const getCameraState = (currentRoomId) => {
    if (!currentRoomId) return true; // Default to true if no room ID
    const saved = localStorage.getItem(`videoCall_${currentRoomId}_camOn`);
    return saved !== null ? JSON.parse(saved) : true; // Default to true if not set
  };
  
  const setCameraState = (state) => {
    if (roomId) {
      localStorage.setItem(`videoCall_${roomId}_camOn`, JSON.stringify(state));
    }
    setCamOn(state);
  };

  const [stream, setStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const socketRef = useRef(null);
  const peersRef = useRef(new Map()); // peerId -> { pc, stream }
  const [remoteStreams, setRemoteStreams] = useState([]); // [{ peerId, stream }]
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true); // Start with default, will be updated when roomId is available
  const [screenOn, setScreenOn] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [error, setError] = useState("");
  const [activePanel, setActivePanel] = useState(null); // For side panels: 'people', 'chat', 'activities', 'more'
  const [chatMessage, setChatMessage] = useState("");

  // Shared chat functionality
  const { messages, onlineUsers, isConnected, sendMessage } = useSharedChat(roomId, user);
  
  const chatEndRef = useRef(null);

  const displayName = useMemo(
    () => user?.name || user?.email || "You",
    [user]
  );

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (activePanel === 'chat' && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activePanel]);

  // Load camera state when roomId becomes available
  useEffect(() => {
    if (roomId) {
      // Reset camera state to true for fresh sessions to avoid black screen issues
      // Only use persisted state if user explicitly toggled during this session
      const savedCameraState = true; // Always start with camera on
      console.log('📹 Resetting camera state for room:', roomId, '-> state:', savedCameraState);
      setCamOn(savedCameraState);
      
      // Clear any old persisted state to prevent black screen issues
      localStorage.removeItem(`videoCall_${roomId}_camOn`);
    }
  }, [roomId]);

  // Synchronize camera state with video track - make resilient to missing/ended tracks
  useEffect(() => {
    if (!stream || !roomId) return;
    
    console.log('🔄 Syncing camera state:', camOn);
    const videoTrack = stream.getVideoTracks()?.[0];
    const audioTrack = stream.getAudioTracks()?.[0];
    
    // Handle video track
    if (!videoTrack && camOn) {
      // No live video track but camera should be on → reacquire
      console.log('📹 No video track found but camera should be on - reacquiring...');
      // Don't call ensureVideoOn here to prevent loops - let user manually toggle
      return;
    }
    
    if (videoTrack) {
      if (videoTrack.readyState === 'ended' && camOn) {
        console.log('📹 Video track ended but camera should be on - user needs to toggle camera');
        // Don't auto-reacquire to prevent loops
        return;
      }
      
      const currentEnabled = videoTrack.enabled;
      console.log('📹 Video track current state:', currentEnabled, '-> desired state:', camOn);
      
      if (currentEnabled !== camOn) {
        videoTrack.enabled = camOn;
        console.log('✅ Video track state updated to:', camOn);
      }
    } else {
      console.log('⚠️ No video track found for state sync');
    }
    
    // Handle audio track
    if (audioTrack) {
      audioTrack.enabled = micOn;
      console.log('🎤 Audio track state updated to:', micOn);
    }
    
  }, [camOn, micOn, stream, roomId]);

  // Handle chat message sending
  const handleSendChatMessage = () => {
    if (chatMessage.trim()) {
      sendMessage(chatMessage);
      setChatMessage("");
    }
  };

  // Handle screen stream changes
  useEffect(() => {
    if (screenStream && screenVideoRef.current) {
      screenVideoRef.current.srcObject = screenStream;
      screenVideoRef.current.play().catch(err => {
        console.error('Failed to play screen stream:', err);
      });
    } else if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
    }
  }, [screenStream]);

  // --- Socket.IO + WebRTC signaling logic helpers ---
  const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

  function updateRemoteStream(peerId, remoteStream) {
    setRemoteStreams((prev) => {
      const idx = prev.findIndex((r) => r.peerId === peerId);
      if (idx === -1) return [...prev, { peerId, stream: remoteStream }];
      const copy = [...prev];
      copy[idx] = { peerId, stream: remoteStream };
      return copy;
    });
  }

  function removePeer(peerId) {
    const wrapper = peersRef.current.get(peerId);
    if (wrapper) {
      try { wrapper.pc.close(); } catch {}
      peersRef.current.delete(peerId);
    }
    setRemoteStreams((prev) => prev.filter((r) => r.peerId !== peerId));
  }

  async function createPeerConnection(peerId, isInitiator) {
    if (!peerId || peersRef.current.has(peerId)) return;
    console.log(`🤝 Creating ${isInitiator ? 'initiator' : 'responder'} peer connection for:`, peerId);
    
    const pc = new RTCPeerConnection(configuration);
    const remoteStream = new MediaStream();

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 Sending ICE candidate to:', peerId);
        socketRef.current?.emit('ice-candidate', { to: peerId, candidate: event.candidate });
      }
    };

    pc.ontrack = (ev) => {
      console.log('📺 Received remote track from:', peerId, ev.track.kind);
      try {
        ev.streams?.[0] && ev.streams[0].getTracks().forEach((t) => remoteStream.addTrack(t));
      } catch (e) {
        console.error('ontrack error', e);
      }
      updateRemoteStream(peerId, remoteStream);
    };

    pc.onconnectionstatechange = () => {
      console.log(`🔗 Peer ${peerId} connection state:`, pc.connectionState);
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`🧊 Peer ${peerId} ICE connection state:`, pc.iceConnectionState);
    };

    // Add local tracks if available
    try {
      // Get the current local stream from state
      const currentLocalStream = localStreamRef.current || stream;
      if (currentLocalStream?.getTracks()?.length > 0) {
        console.log('📤 Adding local tracks to peer connection for:', peerId);
        currentLocalStream.getTracks().forEach((track) => pc.addTrack(track, currentLocalStream));
      } else {
        console.warn('⚠️ No local stream to add tracks from yet for peer:', peerId);
        // Try to add tracks later when stream becomes available
        const checkForStream = () => {
          const laterStream = localStreamRef.current;
          if (laterStream?.getTracks()?.length > 0) {
            console.log('📤 Adding local tracks (delayed) to peer connection for:', peerId);
            laterStream.getTracks().forEach((track) => pc.addTrack(track, laterStream));
          }
        };
        setTimeout(checkForStream, 100); // Small delay to allow stream to be set
      }
    } catch (e) {
      console.warn('Error adding local stream to peer connection:', e);
    }

    peersRef.current.set(peerId, { pc, stream: remoteStream });

    if (isInitiator) {
      try {
        console.log('📤 Creating and sending offer to:', peerId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current?.emit('offer', { to: peerId, sdp: pc.localDescription, user });
      } catch (e) {
        console.error('Error creating offer', e);
      }
    }
  }

  const connectSocket = () => {
    if (!roomId || socketRef.current) return;
    
    // Check if we have a stream before connecting
    const currentStream = localStreamRef.current || stream;
    if (!currentStream) {
      console.log('📡 No stream available yet, delaying socket connection');
      return;
    }
    
    console.log('🔄 Attempting to connect to Socket.IO server...');
    const socket = ioClient('http://localhost:8000', {
      path: '/socket.io/',
      transports: ['polling'], // Start with polling only, let Socket.IO handle upgrade
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      upgrade: true, // Allow upgrade to websocket after connection
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔌 Socket connected for video call', socket.id);
      console.log('📞 Joining call room:', roomId);
      socket.emit('join-call', { roomId, user });
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
      setError('Failed to connect to video call server: ' + error.message);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        // the disconnection was initiated by the server, reconnect manually
        socket.connect();
      }
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('🔄 Socket reconnection attempt', attemptNumber);
    });

    socket.on('reconnect_error', (error) => {
      console.error('❌ Socket reconnection error:', error);
    });

    socket.on('reconnect_failed', () => {
      console.error('❌ Socket reconnection failed');
      setError('Failed to reconnect to video call server');
    });

    socket.on('existing-peers', async (peers) => {
      console.log('👥 Existing peers in room:', peers);
      for (const p of peers) {
        console.log('🤝 Creating peer connection for existing peer:', p.peerId);
        await createPeerConnection(p.peerId, true);
      }
    });

    socket.on('new-peer', async ({ peerId, user: newUser }) => {
      console.log('👋 New peer joined:', peerId, newUser);
      await createPeerConnection(peerId, false);
    });

    socket.on('offer', async ({ from, sdp }) => {
      console.log('📨 Received offer from:', from);
      if (!peersRef.current.has(from)) await createPeerConnection(from, false);
      const pc = peersRef.current.get(from).pc;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log('📤 Sending answer to:', from);
        socket.emit('answer', { to: from, sdp: pc.localDescription });
      } catch (e) {
        console.error('Error handling offer', e);
      }
    });

    socket.on('answer', async ({ from, sdp }) => {
      console.log('📨 Received answer from:', from);
      const pcWrap = peersRef.current.get(from);
      if (!pcWrap) return;
      try {
        await pcWrap.pc.setRemoteDescription(new RTCSessionDescription(sdp));
        console.log('✅ Answer applied for peer:', from);
      } catch (e) {
        console.error('Error applying answer', e);
      }
    });

    socket.on('ice-candidate', async ({ from, candidate }) => {
      console.log('🧊 Received ICE candidate from:', from);
      const pcWrap = peersRef.current.get(from);
      if (!pcWrap || !candidate) return;
      try {
        await pcWrap.pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('✅ ICE candidate added for peer:', from);
      } catch (e) {
        console.error('Error adding remote ICE candidate', e);
      }
    });

    socket.on('peer-left', ({ peerId }) => {
      console.log('👋 Peer left:', peerId);
      removePeer(peerId);
    });
  };

  // Separate media stream initialization from room/socket connection
  useEffect(() => {
    let cancelled = false;
    
    const initializeMedia = async () => {
      // Don't initialize media until we have a roomId
      if (!roomId) {
        console.log('📹 Waiting for roomId before initializing media');
        return;
      }
      
      // Only initialize media if we don't have a stream yet
      if (stream || localStreamRef.current) {
        console.log('📹 Media stream already exists, skipping initialization');
        return;
      }
      
      setError("");
      try {
        console.log('🎬 Initializing media stream for room:', roomId);
        
        // Always request both audio and video initially
        const media = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { width: 1280, height: 720 },
        });
        
        if (cancelled) {
          media.getTracks().forEach(stopTrack);
          return;
        }
        
        setStream(media);
        localStreamRef.current = media;
        
        // Set up video element
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = media;
          await localVideoRef.current.play().catch(() => {});
        }
        
        console.log('✅ Media stream initialized successfully');
        
      } catch (e) {
        if (cancelled) return;
        
        console.error('❌ Failed to initialize media:', e);
        let errorMessage = "Could not access camera/microphone";
        
        if (e.name === 'NotAllowedError') {
          errorMessage = "Camera/microphone access denied. Please allow access and refresh.";
        } else if (e.name === 'NotFoundError') {
          errorMessage = "No camera/microphone found on this device.";
        } else if (e.name === 'OverconstrainedError') {
          errorMessage = "Camera/microphone constraints cannot be satisfied.";
        }
        
        setError(errorMessage);
      }
    };

    // Initialize media stream when roomId is available
    initializeMedia();

    return () => {
      cancelled = true;
    };
  }, [roomId]); // Only depend on roomId, not stream

  // Socket connection when roomId and stream are available
  useEffect(() => {
    if (!roomId) {
      console.log('📡 No roomId available for socket connection');
      return;
    }
    
    // Use a timer to check for stream availability to avoid dependency issues
    const connectWhenReady = () => {
      const currentStream = localStreamRef.current || stream;
      if (currentStream && !socketRef.current) {
        console.log('📡 Connecting to socket for room:', roomId);
        connectSocket();
      } else if (!currentStream) {
        // Check again in a bit if stream isn't ready yet
        setTimeout(connectWhenReady, 100);
      }
    };
    
    connectWhenReady();
    
    // Cleanup socket when roomId changes or component unmounts
    return () => {
      if (socketRef.current) {
        console.log('📡 Cleaning up socket connection');
        socketRef.current.emit('leave-call', { roomId });
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
    
  }, [roomId]); // Only depend on roomId

  // Cleanup streams and connections when component unmounts or roomId changes
  useEffect(() => {
    return () => {
      if (!roomId) {
        // Only cleanup streams when actually leaving (no roomId)
        console.log('🧹 Cleaning up media streams...');
        const currentStream = localStreamRef.current || stream;
        currentStream?.getTracks()?.forEach(stopTrack);
        setStream(null);
        localStreamRef.current = null;
        
        setScreenStream((s) => {
          s?.getTracks()?.forEach(stopTrack);
          return null;
        });
      }
    };
  }, [roomId]); // Only depend on roomId, not stream

  // Cleanup socket and peers on unmount or leaving room
  useEffect(() => {
    return () => {
      socketRef.current?.emit('leave-call', { roomId });
      try { socketRef.current?.disconnect(); } catch {}
      peersRef.current.forEach((w, id) => {
        try { w.pc.close(); } catch {}
      });
      peersRef.current.clear();
      setRemoteStreams([]);
      socketRef.current = null;
    };
  }, [roomId]);

  // Effect to handle camera cleanup on page visibility change, hash change, or unmount
  // Cleanup when leaving workspace entirely
  useEffect(() => {
    const handleHashChange = () => {
      // Only cleanup when actually leaving the workspace entirely
      if (!location.hash.includes("#workspace")) {
        console.log('🚪 Leaving workspace - cleaning up');
        
        // Clear localStorage for this room when leaving workspace completely
        if (roomId) {
          localStorage.removeItem(`videoCall_${roomId}_camOn`);
        }
        
        // Close all peer connections
        peersRef.current.forEach((peer) => {
          try { peer.pc.close(); } catch {}
        });
        peersRef.current.clear();
        
        // Disconnect socket
        socketRef.current?.emit('leave-call', { roomId });
        socketRef.current?.disconnect();
      }
    };

    window.addEventListener("hashchange", handleHashChange);

    // Cleanup on component unmount
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      
      console.log('🧹 VideoCall component unmounting');
      
      // Clean up peer connections
      peersRef.current.forEach((peer) => {
        try { peer.pc.close(); } catch {}
      });
      peersRef.current.clear();
      
      // Disconnect socket
      if (socketRef.current) {
        socketRef.current.emit('leave-call', { roomId });
        socketRef.current.disconnect();
      }
      
      // Only stop media tracks on actual unmount (leaving video call entirely)
      const currentStream = localStreamRef.current || stream;
      if (currentStream) {
        console.log('🛑 Stopping media tracks on unmount');
        currentStream.getTracks().forEach(track => track.stop());
      }
      
      // Clear camera state for this room
      if (roomId) {
        localStorage.removeItem(`videoCall_${roomId}_camOn`);
      }
    };
  }, [roomId]); // Only depend on roomId

  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (k === "m") toggleMic();
      if (k === "c") toggleCam();
      if (k === "s") toggleScreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream, screenStream, micOn, camOn, screenOn]);

  const ensureAudioOn = async () => {
    const currentAudio = stream?.getAudioTracks?.().find(t => t.readyState === "live");
    if (currentAudio) {
      currentAudio.enabled = true;
      return { audio: currentAudio };
    }
    
    console.log('🎤 Acquiring new audio track...');
    const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const newAudio = audioOnly.getAudioTracks()[0];
    const videoTrack = stream?.getVideoTracks?.().find(t => t.readyState === "live") || null;
    const merged = buildStream(newAudio, videoTrack);
    
    // Don't stop old stream tracks - just replace them
    setStream(merged);
    localStreamRef.current = merged;
    
    // Update video element
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = merged;
      await localVideoRef.current.play().catch(() => {});
    }
    
    // Replace audio track in all peer connections instead of stopping
    peersRef.current.forEach(({ pc }) => {
      const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
      if (sender) {
        console.log('📤 Replacing audio track in peer connection');
        sender.replaceTrack(newAudio).catch(e => console.error('Failed to replace track:', e));
      } else {
        console.log('📤 Adding new audio track to peer connection');
        pc.addTrack(newAudio, merged);
      }
    });
    
    return { audio: newAudio };
  };

  const ensureVideoOn = async () => {
    const currentVideo = stream?.getVideoTracks?.().find(t => t.readyState === "live");
    if (currentVideo) {
      currentVideo.enabled = true;
      return { video: currentVideo };
    }
    
    console.log('📹 Acquiring new video track...');
    const videoOnly = await navigator.mediaDevices.getUserMedia({ 
      audio: false, 
      video: { width: 1280, height: 720 } 
    });
    const newVideo = videoOnly.getVideoTracks()[0];
    const audioTrack = stream?.getAudioTracks?.().find(t => t.readyState === "live") || null;
    const merged = buildStream(audioTrack, newVideo);
    
    // Don't stop old stream tracks - just replace them
    setStream(merged);
    localStreamRef.current = merged;
    
    // Update video element
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = merged;
      await localVideoRef.current.play().catch(() => {});
    }
    
    // Replace video track in all peer connections instead of stopping
    peersRef.current.forEach(({ pc }) => {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        console.log('📤 Replacing video track in peer connection');
        sender.replaceTrack(newVideo).catch(e => console.error('Failed to replace track:', e));
      } else {
        console.log('📤 Adding new video track to peer connection');
        pc.addTrack(newVideo, merged);
      }
    });
    
    return { video: newVideo };
  };

  const toggleMic = async () => {
    if (!roomId) return;
    try {
      if (micOn) {
        const track = stream?.getAudioTracks?.()?.[0];
        if (track) track.enabled = false;
        setMicOn(false);
      } else {
        await ensureAudioOn();
        setMicOn(true);
      }
    } catch (e) {
      setError(e?.message || "Failed to toggle microphone");
      setTimeout(() => setError(""), 2000);
    }
  };

  const toggleCam = async () => {
    if (!roomId || !stream) {
      console.log('❌ Cannot toggle camera - no room or stream');
      return;
    }
    
    try {
      const videoTrack = stream.getVideoTracks()?.[0];
      if (!videoTrack) {
        console.log('❌ No video track available');
        setError("No video track available");
        setTimeout(() => setError(""), 2000);
        return;
      }
      
      const newCamState = !camOn;
      console.log('� Toggling camera:', camOn, '->', newCamState);
      
      // Update persistent state (this will trigger the sync useEffect)
      setCameraState(newCamState);
      
    } catch (e) {
      console.error('❌ Failed to toggle camera:', e);
      setError(e?.message || "Failed to toggle camera");
      setTimeout(() => setError(""), 2000);
    }
  };

  const toggleScreen = async () => {
    try {
      if (!screenOn) {
        const scr = await navigator.mediaDevices.getDisplayMedia({ 
          video: { 
            mediaSource: 'screen',
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 },
            frameRate: { ideal: 30, max: 60 }
          }, 
          audio: false 
        });
        
        setScreenStream(scr);
        
        // Ensure video element is ready and set stream
        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = scr;
          
          // Add event listeners for better debugging
          screenVideoRef.current.onloadedmetadata = () => {
            console.log('Screen share metadata loaded');
            screenVideoRef.current.play().catch(err => {
              console.error('Failed to play screen share:', err);
            });
          };
          
          screenVideoRef.current.onerror = (err) => {
            console.error('Screen share video error:', err);
          };
        }
        
        const [track] = scr.getVideoTracks();
        track.onended = () => {
          console.log('Screen share ended by user');
          setScreenOn(false);
          setScreenStream((s) => {
            s?.getTracks()?.forEach(stopTrack);
            return null;
          });
          if (screenVideoRef.current) {
            screenVideoRef.current.srcObject = null;
          }
        };
        
        setScreenOn(true);
      } else {
        setScreenOn(false);
        setScreenStream((s) => {
          s?.getTracks()?.forEach(stopTrack);
          return null;
        });
        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = null;
        }
      }
    } catch {
      // user canceled
    }
  };

  const leaveCall = () => {
    // Stop all tracks before leaving
    stream?.getTracks()?.forEach(stopTrack);
    screenStream?.getTracks()?.forEach(stopTrack);
    
    window.history.replaceState({}, "", `${location.origin}/#workspace?room=${encodeURIComponent(roomId || "")}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  };

  const btnOn = "bg-green-500 text-white hover:bg-green-400 hover:ring-4 hover:ring-green-300/40 hover:shadow-xl";
  const btnOff = "bg-red-600 text-white hover:bg-red-500 hover:ring-4 hover:ring-red-300/40 hover:shadow-xl";
  const btnNeutral = "bg-gray-600 text-white hover:bg-gray-500 hover:ring-4 hover:ring-gray-300/40 hover:shadow-xl";
  const btnActive = "bg-blue-600 text-white hover:bg-blue-500 hover:ring-4 hover:ring-blue-300/40 hover:shadow-xl";

  return (
    <div className="h-full w-full bg-gray-900 text-white overflow-hidden">
      <div className="h-full w-full bg-[#121418] relative flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 h-14 px-4 flex items-center justify-between bg-black/30 backdrop-blur border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 gradient-primary rounded-md flex items-center justify-center">
              <span className="font-bold">C</span>
            </div>
          </div>
          <div className="hidden sm:block text-sm text-white/80">
            {roomId ? `Session: ${roomId}` : "No session"} • {formatTime()}
          </div>
          <div className="flex items-center space-x-2">
            <button 
              type="button" 
              onClick={() => setActivePanel(activePanel === 'people' ? null : 'people')}
              className={`btn-glass px-3 py-2 rounded-xl text-sm hover:ring-2 hover:ring-white/30 transition-all ${activePanel === 'people' ? 'bg-blue-500/20 ring-2 ring-blue-400/50' : ''}`}
            >
              People
            </button>
            <button 
              type="button" 
              onClick={() => setActivePanel(activePanel === 'chat' ? null : 'chat')}
              className={`relative btn-glass px-3 py-2 rounded-xl text-sm hover:ring-2 hover:ring-white/30 transition-all ${activePanel === 'chat' ? 'bg-blue-500/20 ring-2 ring-blue-400/50' : ''}`}
            >
              Chat
              {messages.length > 0 && activePanel !== 'chat' && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-xs text-white">{messages.length > 9 ? '9+' : messages.length}</span>
                </span>
              )}
            </button>
            <button 
              type="button" 
              onClick={() => setActivePanel(activePanel === 'activities' ? null : 'activities')}
              className={`btn-glass px-3 py-2 rounded-xl text-sm hover:ring-2 hover:ring-white/30 transition-all ${activePanel === 'activities' ? 'bg-blue-500/20 ring-2 ring-blue-400/50' : ''}`}
            >
              Activities
            </button>
            <button 
              type="button" 
              onClick={() => setActivePanel(activePanel === 'more' ? null : 'more')}
              className={`btn-glass px-3 py-2 rounded-xl text-sm hover:ring-2 hover:ring-white/30 transition-all ${activePanel === 'more' ? 'bg-blue-500/20 ring-2 ring-blue-400/50' : ''}`}
            >
              More
            </button>
          </div>
        </div>
        
        {/* Side Panel */}
        {activePanel && (
          <div className="absolute top-14 right-0 w-80 h-full bg-gray-900/95 backdrop-blur border-l border-gray-700 z-50">
            <div className="flex flex-col h-full">
              {/* Panel Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-700">
                <h3 className="text-lg font-semibold capitalize">{activePanel}</h3>
                <button 
                  onClick={() => setActivePanel(null)}
                  className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Panel Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {activePanel === 'people' && (
                  <div className="space-y-4">
                    <div className="text-sm text-gray-400 mb-4">Participants ({roomId ? '1' : '0'})</div>
                    {roomId && (
                      <div className="flex items-center space-x-3 p-3 bg-gray-800/50 rounded-lg">
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium">{user?.name?.[0] || user?.email?.[0] || 'Y'}</span>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium">{user?.name || user?.email || 'You'}</div>
                          <div className="text-xs text-gray-400">Host</div>
                        </div>
                        <div className="flex space-x-1">
                          <div className={`w-2 h-2 rounded-full ${micOn ? 'bg-green-400' : 'bg-red-400'}`}></div>
                          <div className={`w-2 h-2 rounded-full ${camOn ? 'bg-green-400' : 'bg-red-400'}`}></div>
                        </div>
                      </div>
                    )}
                    <div className="text-center text-gray-500 py-8">
                      <div className="text-2xl mb-2">👥</div>
                      <div className="text-sm">Invite others to join this session</div>
                      <div className="text-xs mt-1">Share the session link to add participants</div>
                    </div>
                  </div>
                )}
                
                {activePanel === 'chat' && (
                  <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between text-sm text-gray-400 mb-4">
                      <span>Chat</span>
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="text-xs">
                          {isConnected ? 'Connected' : 'Offline'}
                        </span>
                        {onlineUsers.size > 0 && (
                          <span className="text-xs">• {onlineUsers.size} online</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Messages area */}
                    <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
                      {messages.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">
                          <div className="text-2xl mb-2">💬</div>
                          <div className="text-sm">No messages yet</div>
                          <div className="text-xs mt-1">Start a conversation with your team</div>
                        </div>
                      ) : (
                        messages.map((message) => (
                          <div key={message.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                            <div className="text-xs text-gray-400 mb-1">
                              {message.user} • {new Date(message.ts).toLocaleTimeString()}
                              {isConnected && <span className="ml-2 text-green-400">●</span>}
                            </div>
                            <div className="text-sm text-white">{message.body}</div>
                          </div>
                        ))
                      )}
                      <div ref={chatEndRef} />
                    </div>
                    
                    {/* Message input */}
                    <div className="border-t border-gray-700 pt-4">
                      <div className="flex space-x-2">
                        <input 
                          type="text" 
                          placeholder={roomId ? (isConnected ? "Type a message..." : "Connecting...") : "No session active"}
                          value={chatMessage}
                          onChange={(e) => setChatMessage(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSendChatMessage()}
                          disabled={!roomId}
                          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        />
                        <button 
                          onClick={handleSendChatMessage}
                          disabled={!chatMessage.trim() || !roomId}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                        >
                          Send
                        </button>
                      </div>
                      {!isConnected && roomId && (
                        <div className="text-xs text-yellow-400 mt-2">
                          Real-time sync with TeamChat requires connection
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {activePanel === 'activities' && (
                  <div className="space-y-4">
                    <div className="text-sm text-gray-400 mb-4">Activities & Apps</div>
                    <div className="grid grid-cols-2 gap-3">
                      <button className="p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors text-center">
                        <div className="text-2xl mb-2">📝</div>
                        <div className="text-xs">Whiteboard</div>
                      </button>
                      <button className="p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors text-center">
                        <div className="text-2xl mb-2">📋</div>
                        <div className="text-xs">Tasks</div>
                      </button>
                      <button className="p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors text-center">
                        <div className="text-2xl mb-2">📊</div>
                        <div className="text-xs">Poll</div>
                      </button>
                      <button className="p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors text-center">
                        <div className="text-2xl mb-2">🎲</div>
                        <div className="text-xs">Games</div>
                      </button>
                    </div>
                  </div>
                )}
                
                {activePanel === 'more' && (
                  <div className="space-y-4">
                    <div className="text-sm text-gray-400 mb-4">More Options</div>
                    <div className="space-y-2">
                      <button className="w-full flex items-center space-x-3 p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors text-left">
                        <span className="text-lg">⚙️</span>
                        <span className="text-sm">Settings</span>
                      </button>
                      <button className="w-full flex items-center space-x-3 p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors text-left">
                        <span className="text-lg">📊</span>
                        <span className="text-sm">Statistics</span>
                      </button>
                      <button className="w-full flex items-center space-x-3 p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors text-left">
                        <span className="text-lg">🔗</span>
                        <span className="text-sm">Copy Invite Link</span>
                      </button>
                      <button className="w-full flex items-center space-x-3 p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors text-left">
                        <span className="text-lg">📱</span>
                        <span className="text-sm">Mobile App</span>
                      </button>
                      <button className="w-full flex items-center space-x-3 p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors text-left">
                        <span className="text-lg">❓</span>
                        <span className="text-sm">Help & Support</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Main video area - using flexbox layout */}
        <div className={`flex-1 min-h-0 p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 transition-all duration-300 ${activePanel ? 'mr-80' : ''}`}>
          {/* Local video */}
          <div className="relative bg-gray-800 rounded-xl overflow-hidden min-h-[300px] lg:min-h-[400px]">
            {/* Debug info overlay */}
            <div className="absolute top-2 left-2 bg-black/70 text-white text-xs p-2 rounded z-20">
              <div>Room: {roomId || 'none'}</div>
              <div>Stream: {stream ? 'yes' : 'no'}</div>
              <div>CamOn: {camOn ? 'yes' : 'no'}</div>
              <div>Tracks: V:{stream?.getVideoTracks()?.length || 0} A:{stream?.getAudioTracks()?.length || 0}</div>
              <div>VideoEnabled: {stream?.getVideoTracks()?.[0]?.enabled ? 'yes' : 'no'}</div>
            </div>
            
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover transition-opacity duration-300 ${camOn ? 'opacity-100' : 'opacity-0'}`}
            />
            {!camOn && (
              <div className="absolute inset-0 bg-gray-900 flex items-center justify-center z-10">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">
                      {displayName?.[0]?.toUpperCase() || "Y"}
                    </span>
                  </div>
                  <div className="text-sm text-gray-300">Camera is off</div>
                </div>
              </div>
            )}
            <div className="absolute bottom-3 left-3 bg-black/60 px-2 py-1 rounded text-sm">
              {displayName || "You"}
            </div>
            {!micOn && (
              <div className="absolute top-3 left-3 bg-red-500 p-1.5 rounded-full">
                <MicIcon off={true} />
              </div>
            )}
          </div>

          {/* Remote participants area */}
          <div className="relative bg-gray-800 rounded-xl overflow-hidden min-h-[300px] lg:min-h-[400px] flex flex-wrap items-start gap-2 p-2">
            {remoteStreams.length === 0 ? (
              <div className="w-full text-center text-gray-400 py-8">
                <div className="text-lg mb-2">🎥</div>
                <div className="text-sm">Remote participants will appear here.</div>
                <div className="text-xs text-gray-500 mt-1">Share the session link to invite others</div>
              </div>
            ) : (
              remoteStreams.map(({ peerId, stream }) => (
                <div key={peerId} className="w-full sm:w-1/2 lg:w-1/3 bg-black rounded overflow-hidden relative">
                  <video
                    className="w-full h-48 object-cover bg-black"
                    autoPlay
                    playsInline
                    ref={(el) => {
                      if (!el) return;
                      if (el.srcObject !== stream) el.srcObject = stream;
                    }}
                  />
                  <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-sm">
                    {peerId}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Screen share area (when active) */}
          {screenOn && (
            <div className="lg:col-span-2 relative bg-black rounded-xl overflow-hidden min-h-[400px]">
              <video
                ref={screenVideoRef}
                autoPlay
                playsInline
                muted
                controls={false}
                className="w-full h-full object-contain bg-black"
                style={{ minHeight: '400px' }}
                onLoadedData={() => console.log('Screen share video loaded')}
                onError={(e) => console.error('Video element error:', e)}
              />
              <div className="absolute bottom-3 left-3 bg-black/60 px-2 py-1 rounded text-sm text-white">
                Screen Share Active
              </div>
              {!screenStream && (
                <div className="absolute inset-0 flex items-center justify-center text-white">
                  <div className="text-center">
                    <div className="text-lg mb-2">🖥️</div>
                    <div>Loading screen share...</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom controls */}
        <div className="flex-shrink-0 h-20 px-4 flex items-center justify-center bg-gradient-to-t from-black/50 to-transparent border-t border-gray-700">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={toggleMic}
            disabled={!roomId}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition transform hover:scale-105 ${micOn ? btnOn : btnOff}`}
            title="Toggle microphone (M)"
          >
            <MicIcon off={!micOn} />
          </button>
          <button
            type="button"
            onClick={toggleCam}
            disabled={!roomId}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition transform hover:scale-105 ${camOn ? btnOn : btnOff}`}
            title="Toggle camera (C)"
          >
            <CamIcon off={!camOn} />
          </button>
          <button
            type="button"
            onClick={toggleScreen}
            disabled={!roomId}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition transform hover:scale-105 ${screenOn ? btnActive : btnNeutral}`}
            title="Present screen (S)"
          >
            <ScreenIcon on={screenOn} />
          </button>
          <button
            type="button"
            onClick={() => setHandRaised((v) => !v)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition transform hover:scale-105 ${handRaised ? "bg-yellow-400 text-white hover:bg-yellow-300" : "bg-yellow-400 text-white hover:bg-yellow-300"}`}
            title="Raise hand"
          >
            <HandIcon up={handRaised} />
          </button>
          <button
            type="button"
            onClick={leaveCall}
            className="w-14 h-14 rounded-full bg-red-600 text-white hover:bg-red-500 hover:ring-4 hover:ring-red-300/40 transition transform hover:scale-105"
            title="Leave"
          >
            <EjectIcon />
          </button>
        </div>
      </div>

      {error && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-60 pointer-events-none">
          <div className="bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg">
            {error}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
