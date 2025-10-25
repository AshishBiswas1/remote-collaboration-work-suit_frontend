import { useEffect, useMemo, useRef, useState } from "react";
import { io as ioClient } from 'socket.io-client';
import { useSharedChat } from "../../hooks/useSharedChat";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8000';

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

  const displayName = user?.name || user?.email || 'You';

  const [stream, setStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const socketRef = useRef(null);
  const chatSocketRef = useRef(null); // Separate socket for chat
  const peersRef = useRef(new Map()); // peerId -> { pc, stream, user }
  const [remoteStreams, setRemoteStreams] = useState([]); // [{ peerId, stream, user }]
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true); // Start with default, will be updated when roomId is available
  const [screenOn, setScreenOn] = useState(false);
  const [screenSharingPeers, setScreenSharingPeers] = useState(new Set());
  const [handRaised, setHandRaised] = useState(false);
  const [error, setError] = useState("");
  const [activePanel, setActivePanel] = useState(null); // For side panels: 'people', 'chat', 'activities', 'more'
  const [mediaAccessGranted, setMediaAccessGranted] = useState(false);
  const [useLowQuality, setUseLowQuality] = useState(false);
  const [chatMessage, setChatMessage] = useState("");

  // Chat state - using Socket.IO for real-time sync
  const [chatMessages, setChatMessages] = useState([]);
  const [chatOnlineUsers, setChatOnlineUsers] = useState([]);
  const [chatConnected, setChatConnected] = useState(false);
  
  // Fallback: Shared chat functionality (WebRTC-based)
  const { messages: fallbackMessages, onlineUsers: fallbackOnlineUsers, isConnected: fallbackConnected, sendMessage: fallbackSendMessage } = useSharedChat(roomId, user);
  
  const chatEndRef = useRef(null);
  
  // Use Socket.IO chat if connected, otherwise fallback to WebRTC
  const messages = chatConnected ? chatMessages : fallbackMessages;
  const onlineUsers = chatConnected ? new Set(chatOnlineUsers.map(u => `${u.id}:${u.name}`)) : fallbackOnlineUsers;
  const isConnected = chatConnected || fallbackConnected;

  // Check media permissions and provide guidance
  const checkMediaPermissions = async () => {
    try {
      if (!navigator.permissions) {
        console.warn('Permissions API not supported');
        return { camera: 'unknown', microphone: 'unknown' };
      }

      const [cameraPermission, micPermission] = await Promise.all([
        navigator.permissions.query({ name: 'camera' }).catch(() => ({ state: 'unknown' })),
        navigator.permissions.query({ name: 'microphone' }).catch(() => ({ state: 'unknown' }))
      ]);

      console.log('Media permissions:', { camera: cameraPermission.state, microphone: micPermission.state });
      return {
        camera: cameraPermission.state,
        microphone: micPermission.state
      };
    } catch (e) {
      console.warn('Could not check permissions:', e);
      return { camera: 'unknown', microphone: 'unknown' };
    }
  };

  // Get user media with fallback strategy
  const getUserMediaWithFallback = async (constraints) => {
    console.log('Attempting to get user media with constraints:', constraints);

    try {
      // First try with full constraints
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('✅ Successfully obtained media stream');
      return stream;
    } catch (error) {
      console.error('❌ Initial getUserMedia failed:', error.name, error.message);

      // Fallback strategy: try audio and video separately
      if (constraints.audio && constraints.video) {
        console.log('🔄 Trying fallback: audio and video separately');

        try {
          const [audioStream, videoStream] = await Promise.all([
            navigator.mediaDevices.getUserMedia({ audio: constraints.audio, video: false })
              .catch(e => { console.warn('Audio fallback failed:', e); return null; }),
            navigator.mediaDevices.getUserMedia({ audio: false, video: constraints.video })
              .catch(e => { console.warn('Video fallback failed:', e); return null; })
          ]);

          if (audioStream && videoStream) {
            // Combine streams
            const combined = new MediaStream([
              ...audioStream.getAudioTracks(),
              ...videoStream.getVideoTracks()
            ]);
            console.log('✅ Successfully combined audio and video streams');
            return combined;
          } else if (audioStream) {
            console.log('⚠️ Only audio available');
            return audioStream;
          } else if (videoStream) {
            console.log('⚠️ Only video available');
            return videoStream;
          }
        } catch (fallbackError) {
          console.error('❌ Fallback strategy failed:', fallbackError);
          throw error; // Throw original error
        }
      }

      throw error;
    }
  };



  // Load camera state when roomId becomes available
  useEffect(() => {
    if (roomId) {
      // Reset camera state to true for fresh sessions to avoid black screen issues
      // Only use persisted state if user explicitly toggled during this session
      const savedCameraState = true; // Always start with camera on
      setCamOn(savedCameraState);
      
      // Clear any old persisted state to prevent black screen issues
      localStorage.removeItem(`videoCall_${roomId}_camOn`);
    }
  }, [roomId]);

  // Synchronize mic only (camera uses enabled toggle)
  useEffect(() => {
    if (!stream || !roomId) return;
    
    const audioTrack = stream.getAudioTracks()?.[0];
    if (audioTrack) {
      audioTrack.enabled = micOn;
    }
    
  }, [micOn, stream, roomId]);

  // Ensure local video element displays the current stream
  useEffect(() => {
    if (!localVideoRef.current || !stream) return;
    
    // Only update if srcObject is different to avoid unnecessary updates
    if (localVideoRef.current.srcObject !== stream) {
      localVideoRef.current.srcObject = stream;
      
      // Ensure video plays (especially important after toggling camera)
      localVideoRef.current.play().catch(err => {
        console.error('Failed to play local video:', err);
      });
    }
  }, [stream]);

  // Socket.IO Chat Connection - separate from WebRTC socket
  useEffect(() => {
    if (!roomId || !user) {
      // Cleanup chat socket if no room
      if (chatSocketRef.current) {
        chatSocketRef.current.disconnect();
        chatSocketRef.current = null;
      }
      setChatConnected(false);
      setChatMessages([]);
      setChatOnlineUsers([]);
      return;
    }

    
    // Create separate socket for chat
    const chatSocket = ioClient(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      autoConnect: true,
      upgrade: true,
      rememberUpgrade: true,
      timeout: 10000,
      path: '/socket.io/',
    });

    chatSocketRef.current = chatSocket;

    // Connection events
    chatSocket.on('connect', () => {
      setChatConnected(true);
      
      // Join the chat room
      chatSocket.emit('join-room', {
        roomId: roomId,
        user: {
          id: user?.id || 'anon',
          name: user?.name || user?.email || 'Anonymous',
          email: user?.email
        }
      });
    });

    chatSocket.on('disconnect', () => {
      setChatConnected(false);
      setChatOnlineUsers([]);
    });

    chatSocket.on('connect_error', (error) => {
      console.error('❌ Chat Socket.IO connection error:', error);
      setChatConnected(false);
    });

    // Message events
    chatSocket.on('room-state', (data) => {
      if (data.messages) {
        const formattedMessages = data.messages.map(msg => ({
          id: msg.id || Date.now(),
          user: msg.user?.name || msg.user || 'Unknown',
          body: msg.text || msg.body || msg.message || '',
          ts: msg.timestamp || msg.ts || Date.now()
        }));
        setChatMessages(formattedMessages);
      }
      if (data.onlineUsers) {
        setChatOnlineUsers(data.onlineUsers);
      }
    });

    chatSocket.on('new-message', (messageData) => {
      const newMsg = {
        id: messageData.id || Date.now(),
        user: messageData.user?.name || messageData.user || 'Unknown',
        body: messageData.text || messageData.body || messageData.message || '',
        ts: messageData.timestamp || messageData.ts || Date.now()
      };
      setChatMessages(prev => [...prev, newMsg]);
    });

    chatSocket.on('user-joined', (data) => {
      if (data.onlineUsers) {
        setChatOnlineUsers(data.onlineUsers);
      }
    });

    chatSocket.on('user-left', (data) => {
      if (data.onlineUsers) {
        setChatOnlineUsers(data.onlineUsers);
      }
    });

    // Cleanup
    return () => {
      if (chatSocket.connected) {
        chatSocket.emit('leave-room', { roomId: roomId });
      }
      chatSocket.disconnect();
      chatSocketRef.current = null;
      setChatConnected(false);
      setChatMessages([]);
      setChatOnlineUsers([]);
    };
  }, [roomId, user]);

  // Handle chat message sending
  const handleSendChatMessage = () => {
    if (!chatMessage.trim() || !roomId) return;
    
    // Try Socket.IO first
    if (chatConnected && chatSocketRef.current?.connected) {
      chatSocketRef.current.emit('send-message', {
        roomId: roomId,
        message: chatMessage.trim(),
        user: {
          id: user?.id || 'anon',
          name: user?.name || user?.email || 'Anonymous',
          email: user?.email
        }
      });
      setChatMessage("");
    } else {
      // Fallback to WebRTC-based chat
      fallbackSendMessage(chatMessage.trim());
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

  function updateRemoteStream(peerId, remoteStream, userData = null) {
    setRemoteStreams((prev) => {
      const idx = prev.findIndex((r) => r.peerId === peerId);
      if (idx === -1) {
        return [...prev, { peerId, stream: remoteStream, user: userData }];
      }
      const copy = [...prev];
      copy[idx] = { 
        ...copy[idx],
        stream: remoteStream,
        user: userData || copy[idx].user // Preserve existing user data if not provided
      };
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
    setScreenSharingPeers(prev => {
      const newSet = new Set(prev);
      newSet.delete(peerId);
      return newSet;
    });
  }

  async function createPeerConnection(peerId, isInitiator, userData = null) {
    if (!peerId || peersRef.current.has(peerId)) return;
    
    const pc = new RTCPeerConnection(configuration);
    const remoteStream = new MediaStream();

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('ice-candidate', { to: peerId, candidate: event.candidate });
      }
    };

    pc.ontrack = (ev) => {
      try {
        // Add the track directly to the remote stream
        if (!remoteStream.getTracks().find(t => t.id === ev.track.id)) {
          remoteStream.addTrack(ev.track);
        }
        
        // Update the remote stream for this peer
        updateRemoteStream(peerId, remoteStream, userData);
      } catch (e) {
        console.error('ontrack error', e);
      }
    };

    pc.onconnectionstatechange = () => {
    };

    pc.oniceconnectionstatechange = () => {
    };

    // Add local tracks if available (camera/mic)
    try {
      // Get the current local stream from state
      const currentLocalStream = localStreamRef.current || stream;
      if (currentLocalStream?.getTracks()?.length > 0) {
        currentLocalStream.getTracks().forEach((track) => pc.addTrack(track, currentLocalStream));
      } else {
        console.warn('⚠️ No local stream to add tracks from yet for peer:', peerId);
        // Try to add tracks later when stream becomes available
        const checkForStream = () => {
          const laterStream = localStreamRef.current;
          if (laterStream?.getTracks()?.length > 0) {
            laterStream.getTracks().forEach((track) => pc.addTrack(track, laterStream));
          }
        };
        setTimeout(checkForStream, 100); // Small delay to allow stream to be set
      }
      
      // Add screen share track if currently sharing
      if (screenStream?.getTracks()?.length > 0) {
        screenStream.getTracks().forEach((track) => pc.addTrack(track, screenStream));
      }
    } catch (e) {
      console.warn('Error adding local stream to peer connection:', e);
    }

    peersRef.current.set(peerId, { pc, stream: remoteStream, user: userData });

    if (isInitiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const offerData = { 
          to: peerId, 
          sdp: pc.localDescription, 
          user 
        };
        // Embed screen sharing state if active
        if (screenOn) {
          offerData.screenSharing = true;
        }
        socketRef.current?.emit('offer', offerData);
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
      return;
    }
    
    const socket = ioClient(SOCKET_URL, {
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
      socket.emit('join-call', { roomId, user });
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
      setError('Failed to connect to video call server: ' + error.message);
    });

    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        // the disconnection was initiated by the server, reconnect manually
        socket.connect();
      }
    });

    socket.on('reconnect', (attemptNumber) => {
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
    });

    socket.on('reconnect_error', (error) => {
      console.error('❌ Socket reconnection error:', error);
    });

    socket.on('reconnect_failed', () => {
      console.error('❌ Socket reconnection failed');
      setError('Failed to reconnect to video call server');
    });

    socket.on('existing-peers', async (peers) => {
      for (const p of peers) {
        await createPeerConnection(p.peerId, true, p.user);
      }
    });

    socket.on('new-peer', async ({ peerId, user: newUser }) => {
      await createPeerConnection(peerId, false, newUser);
    });

    socket.on('offer', async ({ from, sdp, user: offerUser, screenSharing }) => {
      if (!peersRef.current.has(from)) {
        await createPeerConnection(from, false, offerUser);
      }
      const pc = peersRef.current.get(from).pc;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        
        // Handle embedded screen sharing flag after remote desc (tracks may start flowing)
        if (screenSharing !== undefined) {
          if (screenSharing) {
            setScreenSharingPeers(prev => new Set([...prev, from]));
          } else {
            setScreenSharingPeers(prev => {
              const newSet = new Set(prev);
              newSet.delete(from);
              return newSet;
            });
          }
        }
        
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', { to: from, sdp: pc.localDescription });
      } catch (e) {
        console.error('Error handling offer', e);
      }
    });

    socket.on('answer', async ({ from, sdp }) => {
      const pcWrap = peersRef.current.get(from);
      if (!pcWrap) return;
      try {
        await pcWrap.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      } catch (e) {
        console.error('Error applying answer', e);
      }
    });

    socket.on('ice-candidate', async ({ from, candidate }) => {
      const pcWrap = peersRef.current.get(from);
      if (!pcWrap || !candidate) return;
      try {
        await pcWrap.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('Error adding remote ICE candidate', e);
      }
    });

    socket.on('peer-left', ({ peerId }) => {
      removePeer(peerId);
    });
  };

  // Separate media stream initialization from room/socket connection
  useEffect(() => {
    let cancelled = false;
    
    const initializeMedia = async () => {
      // Don't initialize media until we have a roomId
      if (!roomId) {
        return;
      }

      // Only initialize media if we don't have a stream yet
      if (stream || localStreamRef.current) {
        return;
      }

      setError("");

      // Check if we're on HTTPS (required for WebRTC)
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        setError("Camera/microphone access requires HTTPS. Please ensure you're accessing the site over a secure connection.");
        return;
      }

      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError("Your browser doesn't support camera/microphone access. Please update to a modern browser.");
        return;
      }

      // Pre-check permissions
      const permissions = await checkMediaPermissions();
      if (permissions.camera === 'denied' || permissions.microphone === 'denied') {
        setError("Camera/microphone access has been blocked. Please check your browser settings and allow access for this site.");
        return;
      }

      console.log('🎥 Initializing media devices...');

      try {
        // Define constraints with fallback options
        const constraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30, max: 60 }
          }
        };

        // Try to get media with fallback strategy
        const media = await getUserMediaWithFallback(constraints);

        if (cancelled) {
          media.getTracks().forEach(stopTrack);
          return;
        }

        // Log successful media access
        const audioTracks = media.getAudioTracks();
        const videoTracks = media.getVideoTracks();
        console.log('📊 Media access successful:', {
          audio: audioTracks.length > 0 ? `${audioTracks[0].label} (${audioTracks[0].getSettings().sampleRate}Hz)` : 'none',
          video: videoTracks.length > 0 ? `${videoTracks[0].label} (${videoTracks[0].getSettings().width}x${videoTracks[0].getSettings().height})` : 'none'
        });

        setStream(media);
        localStreamRef.current = media;
        setMediaAccessGranted(true);

        // Set up video element
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = media;
          await localVideoRef.current.play().catch((playError) => {
            console.error('❌ Failed to play video:', playError);
          });
        }

      } catch (e) {
        if (cancelled) return;

        console.error('❌ Failed to initialize media:', {
          name: e.name,
          message: e.message,
          stack: e.stack
        });

        let errorMessage = "Could not access camera/microphone";
        let helpText = "";
        let canRetry = true;

        if (e.name === 'NotAllowedError') {
          errorMessage = "Camera/microphone access denied";
          helpText = "Please click 'Allow' when your browser asks for camera/microphone permissions, or check your browser settings to enable access for this site.";
        } else if (e.name === 'NotFoundError') {
          errorMessage = "No camera/microphone found";
          helpText = "Please ensure your camera and microphone are connected and not being used by another application.";
        } else if (e.name === 'OverconstrainedError') {
          errorMessage = "Camera/microphone constraints cannot be satisfied";
          helpText = "Your camera/microphone may not support the required resolution. The app will try lower quality settings.";
          canRetry = true; // Allow retry with lower constraints
        } else if (e.name === 'NotReadableError') {
          errorMessage = "Camera/microphone is already in use";
          helpText = "Please close other applications that might be using your camera/microphone and try again.";
        } else if (e.name === 'AbortError') {
          errorMessage = "Camera/microphone access was interrupted";
          helpText = "The request was interrupted. Please try again.";
        } else if (e.name === 'SecurityError') {
          errorMessage = "Camera/microphone access blocked by security settings";
          helpText = "This site must be served over HTTPS for camera/microphone access. Please ensure you're using a secure connection.";
          canRetry = false;
        } else {
          helpText = `Technical details: ${e.name} - ${e.message}`;
        }

        setError(`${errorMessage}. ${helpText}`);
        setMediaAccessGranted(false);
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
      return;
    }
    
    // Use a timer to check for stream availability to avoid dependency issues
    const connectWhenReady = () => {
      const currentStream = localStreamRef.current || stream;
      if (currentStream && !socketRef.current) {
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
        currentStream.getTracks().forEach(track => track.stop());
      }
      
      // Clear camera state for this room
      if (roomId) {
        localStorage.removeItem(`videoCall_${roomId}_camOn`);
      }
      
      // Reset screen sharing peers state
      setScreenSharingPeers(new Set());
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
        sender.replaceTrack(newAudio).catch(e => console.error('Failed to replace track:', e));
      } else {
        pc.addTrack(newAudio, merged);
      }
    });
    
    return { audio: newAudio };
  };

  const ensureVideoOn = async () => {
    let currentVideo = stream?.getVideoTracks?.().find(t => t.readyState === "live");
    if (currentVideo && !currentVideo.enabled) {
      currentVideo.enabled = true;
      return { video: currentVideo };
    }
    
    const videoOnly = await navigator.mediaDevices.getUserMedia({ 
      audio: false, 
      video: { width: 1280, height: 720 } 
    });
    const newVideo = videoOnly.getVideoTracks()[0];
    
    // Merge with existing audio if present
    const audioTrack = stream?.getAudioTracks?.().find(t => t.readyState === "live") || null;
    const merged = buildStream(audioTrack, newVideo);
    
    setStream(merged);
    localStreamRef.current = merged;
    
    // Update local video element
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = merged;
      localVideoRef.current.play().catch(err => {
        console.error('Failed to play video after enable:', err);
      });
    }
    
    // Add/replace in peers (only if needed)
    peersRef.current.forEach(({ pc }) => {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        sender.replaceTrack(newVideo).catch(e => console.error('Failed to replace video track:', e));
      } else {
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
    if (!roomId) {
      return;
    }
    
    try {
      const newCamState = !camOn;
      
      const videoTrack = stream?.getVideoTracks()?.[0];
      
      if (newCamState) {
        // Turning camera ON - acquire fresh video track (like Google Meet)
        
        // Stop old track if exists (cleanup)
        if (videoTrack) {
          videoTrack.stop();
        }
        
        // Get new video track
        const videoOnly = await navigator.mediaDevices.getUserMedia({ 
          audio: false, 
          video: { width: 1280, height: 720 } 
        });
        const newVideo = videoOnly.getVideoTracks()[0];
        newVideo.enabled = true; // Ensure enabled
        
        // Keep existing audio track
        const audioTrack = stream?.getAudioTracks?.().find(t => t.readyState === "live") || null;
        const merged = buildStream(audioTrack, newVideo);
        
        // Update stream state
        setStream(merged);
        localStreamRef.current = merged;
        
        // Update local video element
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = merged;
          await localVideoRef.current.play().catch(err => {
            console.error('Failed to play video:', err);
          });
        }
        
        // Replace video track in all peer connections
        peersRef.current.forEach(({ pc }) => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(newVideo).catch(e => console.error('Failed to replace track:', e));
          } else {
            pc.addTrack(newVideo, merged);
          }
        });
        
        
      } else {
        // Turning camera OFF - stop hardware and send disabled black track
        if (videoTrack) {
          
          // Create a black canvas track to replace the camera
          const canvas = document.createElement('canvas');
          canvas.width = 640;
          canvas.height = 480;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = 'black';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Create a MediaStream from the black canvas
          const blackStream = canvas.captureStream(1); // 1 FPS is enough
          const blackTrack = blackStream.getVideoTracks()[0];
          blackTrack.enabled = false; // Disable it so remote shows avatar
          
          // Stop the actual camera hardware
          videoTrack.stop();
          
          // Keep existing audio track
          const audioTrack = stream?.getAudioTracks()?.[0];
          const newStream = buildStream(audioTrack, blackTrack);
          
          // Update stream state
          setStream(newStream);
          localStreamRef.current = newStream;
          
          // Update local video element
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = newStream;
          }
          
          // Replace video track in peer connections with black track
          peersRef.current.forEach(({ pc }) => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
              sender.replaceTrack(blackTrack).catch(e => console.error('Failed to replace track:', e));
            }
          });
          
        }
      }
      
      setCamOn(newCamState);
      // Update localStorage persistence
      if (roomId) {
        localStorage.setItem(`videoCall_${roomId}_camOn`, JSON.stringify(newCamState));
      }
      
    } catch (e) {
      console.error('❌ Failed to toggle camera:', e);
      setError(e?.message || "Failed to toggle camera");
      setTimeout(() => setError(""), 2000);
    }
  };

  // Shared stop logic (updated for embedded flag)
  const handleScreenStop = async (currentScreenStream, currentScreenTrack) => {
    // Re-enable camera if it was on
    if (camOn) {
      const cameraTrack = stream?.getVideoTracks()?.[0];
      if (cameraTrack) {
        cameraTrack.enabled = true;
      }
    }

    // Remove screen track from all peer connections
    if (currentScreenTrack) {
      for (const [peerId, { pc }] of peersRef.current.entries()) {
        const sender = pc.getSenders().find(s => s.track?.id === currentScreenTrack.id);
        if (sender) {
          pc.removeTrack(sender);
          
          // Trigger renegotiation with embedded stop flag
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socketRef.current?.emit('offer', { 
              to: peerId, 
              sdp: pc.localDescription, 
              user,
              screenSharing: false  // Embed stop flag
            });
          } catch (e) {
            console.error('Failed to renegotiate for screen share removal:', e);
          }
        }
      }
    }

    // Clean up local screen stream
    setScreenOn(false);
    setScreenStream((s) => {
      s?.getTracks()?.forEach(stopTrack);
      return null;
    });
    
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
    }
    
  };

  const toggleScreen = async () => {
    try {
      if (!screenOn) {

        // Get screen capture stream
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
        const screenTrack = scr.getVideoTracks()[0];

        // Disable camera track during screen share (if camera is on)
        if (camOn) {
          const cameraTrack = stream?.getVideoTracks()?.[0];
          if (cameraTrack) {
            cameraTrack.enabled = false;
          }
        }

        // Set up local screen video element
        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = scr;
          screenVideoRef.current.onloadedmetadata = () => {
            screenVideoRef.current.play().catch(err => {
              console.error('Failed to play screen share:', err);
            });
          };
          screenVideoRef.current.onerror = (err) => {
            console.error('Screen share video error:', err);
          };
        }

        // Add screen track to all peers and renegotiate
        for (const [peerId, { pc }] of peersRef.current.entries()) {
          
          // Check if we already have a screen track sender
          const screenSender = pc.getSenders().find(s => s.track?.id === screenTrack.id);
          if (!screenSender) {
            pc.addTrack(screenTrack, scr);
            
            // Trigger renegotiation
            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              socketRef.current?.emit('offer', { 
                to: peerId, 
                sdp: pc.localDescription, 
                user,
                screenSharing: true  // Embed start flag
              });
            } catch (e) {
              console.error('Failed to renegotiate for screen share:', e);
            }
          } else {
          }
        }

        // Send screen start signal to all peers after setup
        peersRef.current.forEach((_, peerId) => {
          socketRef.current?.emit('screen-share-start', { to: peerId, from: socketRef.current.id });
        });
        
        
        // Handle when user stops sharing via browser UI
        screenTrack.onended = async () => {
          await handleScreenStop(scr, screenTrack); // Call shared stop logic
        };
        
        setScreenOn(true);
        
      } else {
        const screenTrack = screenStream?.getVideoTracks()?.[0];
        await handleScreenStop(screenStream, screenTrack);
      }
    } catch (e) {
      console.error('Screen share error:', e);
      // User canceled or error occurred - clean up
      setScreenOn(false);
      setScreenStream((s) => {
        s?.getTracks()?.forEach(stopTrack);
        return null;
      });
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = null;
      }
      // Re-enable camera if it was disabled
      if (camOn) {
        const cameraTrack = stream?.getVideoTracks()?.[0];
        if (cameraTrack) cameraTrack.enabled = true;
      }
    }
  };

  const leaveCall = () => {
    // Stop all tracks before leaving
    stream?.getTracks()?.forEach(stopTrack);
    screenStream?.getTracks()?.forEach(stopTrack);
    
    // Navigate to landing page (remove all hash parameters)
    window.location.hash = '';
    // Alternative: use window.location.href to go to root
    // window.location.href = location.origin;
  };

  // Retry media access with improved logic
  const retryMediaAccess = async () => {
    console.log('🔄 Retrying media access...');

    // Clear current stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(stopTrack);
      localStreamRef.current = null;
    }
    setStream(null);
    setError("");
    setMediaAccessGranted(false);

    // Re-initialize media with improved logic
    const initializeMedia = async () => {
      setError("");

      // Check if we're on HTTPS (required for WebRTC)
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        setError("Camera/microphone access requires HTTPS. Please ensure you're accessing the site over a secure connection.");
        return;
      }

      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError("Your browser doesn't support camera/microphone access. Please update to a modern browser.");
        return;
      }

      // Pre-check permissions
      const permissions = await checkMediaPermissions();
      if (permissions.camera === 'denied' || permissions.microphone === 'denied') {
        setError("Camera/microphone access has been blocked. Please check your browser settings and allow access for this site.");
        return;
      }

      try {
        // Define constraints - use lower quality if previous attempt failed
        const constraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: useLowQuality ? {
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 15, max: 30 }
          } : {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30, max: 60 }
          }
        };

        console.log('🎥 Retrying with constraints:', constraints);

        // Try to get media with fallback strategy
        const media = await getUserMediaWithFallback(constraints);

        // Log successful media access
        const audioTracks = media.getAudioTracks();
        const videoTracks = media.getVideoTracks();
        console.log('📊 Media access successful on retry:', {
          audio: audioTracks.length > 0 ? `${audioTracks[0].label} (${audioTracks[0].getSettings().sampleRate}Hz)` : 'none',
          video: videoTracks.length > 0 ? `${videoTracks[0].label} (${videoTracks[0].getSettings().width}x${videoTracks[0].getSettings().height})` : 'none'
        });

        setStream(media);
        localStreamRef.current = media;
        setMediaAccessGranted(true);
        setUseLowQuality(false); // Reset for future attempts

        // Set up video element
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = media;
          await localVideoRef.current.play().catch((playError) => {
            console.error('❌ Failed to play video on retry:', playError);
          });
        }

      } catch (e) {
        console.error('❌ Retry failed:', {
          name: e.name,
          message: e.message,
          stack: e.stack
        });

        let errorMessage = "Could not access camera/microphone";
        let helpText = "";
        let shouldTryLowQuality = false;

        if (e.name === 'NotAllowedError') {
          errorMessage = "Camera/microphone access denied";
          helpText = "Please click 'Allow' when your browser asks for camera/microphone permissions, or check your browser settings to enable access for this site.";
        } else if (e.name === 'NotFoundError') {
          errorMessage = "No camera/microphone found";
          helpText = "Please ensure your camera and microphone are connected and not being used by another application.";
        } else if (e.name === 'OverconstrainedError') {
          errorMessage = "Camera/microphone constraints cannot be satisfied";
          helpText = "Trying with lower quality settings...";
          shouldTryLowQuality = !useLowQuality; // Try low quality if not already tried
        } else if (e.name === 'NotReadableError') {
          errorMessage = "Camera/microphone is already in use";
          helpText = "Please close other applications that might be using your camera/microphone and try again.";
        } else if (e.name === 'AbortError') {
          errorMessage = "Camera/microphone access was interrupted";
          helpText = "The request was interrupted. Please try again.";
        } else if (e.name === 'SecurityError') {
          errorMessage = "Camera/microphone access blocked by security settings";
          helpText = "This site must be served over HTTPS for camera/microphone access. Please ensure you're using a secure connection.";
        } else {
          helpText = `Technical details: ${e.name} - ${e.message}`;
        }

        if (shouldTryLowQuality) {
          console.log('🔄 Switching to low quality mode and retrying...');
          setUseLowQuality(true);
          // Auto-retry with low quality
          setTimeout(() => retryMediaAccess(), 100);
          return;
        }

        setError(`${errorMessage}. ${helpText}`);
        setMediaAccessGranted(false);
      }
    };

    initializeMedia();
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
                          {chatConnected ? 'Connected (Socket.IO)' : fallbackConnected ? 'Connected (P2P)' : 'Offline'}
                        </span>
                        {onlineUsers.size > 0 && (
                          <span className="text-xs">• {onlineUsers.size} online</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Online users list */}
                    {chatOnlineUsers.length > 0 && (
                      <div className="mb-4 p-2 bg-blue-900/30 border border-blue-600/30 rounded-lg">
                        <div className="text-xs text-blue-300 mb-2">Online now:</div>
                        <div className="flex flex-wrap gap-1">
                          {chatOnlineUsers.map((user, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-green-600/20 text-green-300 text-xs rounded-full"
                            >
                              {user.name || `User ${index + 1}`}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Connection status message */}
                    {!isConnected && roomId && (
                      <div className="mb-4 p-2 bg-yellow-900/30 border border-yellow-600/30 rounded-lg">
                        <div className="text-xs text-yellow-300">
                          🔄 Connecting to chat server...
                        </div>
                      </div>
                    )}
                    
                    {isConnected && chatConnected && chatOnlineUsers.length === 0 && (
                      <div className="mb-4 p-2 bg-green-900/30 border border-green-600/30 rounded-lg">
                        <div className="text-xs text-green-300">
                          ✅ Connected! Waiting for others to join...
                        </div>
                      </div>
                    )}
                    
                    {/* Messages area */}
                    <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
                      {messages.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">
                          <div className="text-2xl mb-2">💬</div>
                          <div className="text-sm">No messages yet</div>
                          <div className="text-xs mt-1">
                            {isConnected ? 'Start a conversation with your team' : 'Connecting to chat...'}
                          </div>
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
                          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendChatMessage()}
                          disabled={!roomId || !isConnected}
                          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        />
                        <button 
                          onClick={handleSendChatMessage}
                          disabled={!chatMessage.trim() || !roomId || !isConnected}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                        >
                          Send
                        </button>
                      </div>
                      {!isConnected && roomId && (
                        <div className="text-xs text-yellow-400 mt-2">
                          ⏳ Connecting to chat server... Messages will sync once connected.
                        </div>
                      )}
                      {isConnected && chatConnected && (
                        <div className="text-xs text-green-400 mt-2">
                          ✅ Chat is live via Socket.IO • Messages sync in real-time
                        </div>
                      )}
                      {isConnected && !chatConnected && fallbackConnected && (
                        <div className="text-xs text-blue-400 mt-2">
                          🔗 Chat connected via P2P • Limited to same network
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
            {/* Always render video element but hide when camera is off */}
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover bg-black ${!camOn ? 'hidden' : ''}`}
              onLoadedMetadata={() => console.log('✅ Local video metadata loaded')}
              onPlay={() => console.log('✅ Local video playing')}
              onError={(e) => console.error('❌ Local video error:', e)}
            />
            {!camOn && (
              <div className="absolute inset-0 w-full h-full bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                  {user?.avatar_url ? (
                    <div className="w-32 h-32 mx-auto mb-4 rounded-full overflow-hidden bg-gray-700">
                      <img 
                        src={user.avatar_url} 
                        alt={displayName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback to initials if image fails to load
                          e.target.style.display = 'none';
                          e.target.nextElementSibling.style.display = 'flex';
                        }}
                      />
                      <div className="w-32 h-32 bg-blue-500 rounded-full hidden items-center justify-center">
                        <span className="text-4xl font-bold text-white">
                          {displayName?.[0]?.toUpperCase() || "Y"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="w-32 h-32 mx-auto mb-4 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-4xl font-bold text-white">
                        {displayName?.[0]?.toUpperCase() || "Y"}
                      </span>
                    </div>
                  )}
                  <div className="text-sm text-gray-300">Camera is off</div>
                </div>
              </div>
            )}
            <div className="absolute bottom-3 left-3 bg-black/60 px-2 py-1 rounded text-sm z-20">
              {displayName || "You"}
            </div>
            {!micOn && (
              <div className="absolute top-3 left-3 bg-red-500 p-1.5 rounded-full z-20">
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
              remoteStreams.map(({ peerId, stream: remoteStream, user: remoteUser }) => {
                const videoTracks = remoteStream?.getVideoTracks?.() || [];
                
                const isScreenSharing = screenSharingPeers.has(peerId);
                const hasScreenShare = isScreenSharing;
                
                // Prioritize track based on signal
                let displayVideoTrack = null;
                if (isScreenSharing && videoTracks.length > 1) {
                  // Screen is the last added track
                  displayVideoTrack = videoTracks[videoTracks.length - 1];
                } else {
                  // Use first track (camera) if enabled
                  displayVideoTrack = videoTracks[0];
                  if (displayVideoTrack && !displayVideoTrack.enabled) {
                    displayVideoTrack = null; // Hide if disabled
                  }
                }
                
                const hasVideo = !!displayVideoTrack;
                
                
                const remoteName = remoteUser?.name || remoteUser?.email || peerId;
                const displayInitial = remoteName?.[0]?.toUpperCase() || 'U';
                const remoteAvatarUrl = remoteUser?.avatar_url;
                
                // If screen sharing, show in full width
                const containerClass = hasScreenShare 
                  ? "w-full bg-gray-800 rounded overflow-hidden relative min-h-[400px]"
                  : "w-full sm:w-1/2 lg:w-1/3 bg-gray-800 rounded overflow-hidden relative h-48";
                
                // Create display stream
                const displayStream = new MediaStream();
                if (displayVideoTrack) {
                  displayStream.addTrack(displayVideoTrack);
                }
                // Add audio tracks from remote stream
                remoteStream?.getAudioTracks?.().forEach(track => displayStream.addTrack(track));
                
                return (
                  <div key={peerId} className={containerClass}>
                    {hasVideo ? (
                      <>
                        <video
                          className="w-full h-full object-contain bg-black"
                          autoPlay
                          playsInline
                          ref={(el) => {
                            if (!el) return;
                            if (el.srcObject !== displayStream) {
                              el.srcObject = displayStream;
                            }
                          }}
                          onLoadedMetadata={() => console.log(`Video loaded for peer ${peerId}`)}
                        />
                        {hasScreenShare && (
                          <div className="absolute top-3 left-3 bg-blue-600/90 px-3 py-1.5 rounded-lg text-sm z-20 flex items-center gap-2">
                            <ScreenIcon on={true} />
                            <span>{remoteName} is presenting</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                        <div className="text-center">
                          {remoteAvatarUrl ? (
                            <div className="w-20 h-20 mx-auto mb-2 rounded-full overflow-hidden bg-gray-700">
                              <img 
                                src={remoteAvatarUrl} 
                                alt={remoteName}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  // Fallback to initials if image fails to load
                                  e.target.style.display = 'none';
                                  e.target.nextElementSibling.style.display = 'flex';
                                }}
                              />
                              <div className="w-20 h-20 bg-blue-500 rounded-full hidden items-center justify-center">
                                <span className="text-2xl font-bold text-white">
                                  {displayInitial}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="w-20 h-20 mx-auto mb-2 bg-blue-500 rounded-full flex items-center justify-center">
                              <span className="text-2xl font-bold text-white">
                                {displayInitial}
                              </span>
                            </div>
                          )}
                          <div className="text-xs text-gray-400">Camera is off</div>
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-sm z-20">
                      {remoteName}
                    </div>
                  </div>
                );
              })
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
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-60 pointer-events-auto max-w-md">
          <div className="bg-red-600 text-white px-6 py-4 rounded-lg shadow-lg border border-red-500">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-red-200" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="none"/>
                  <path d="M13 17H11V15H13V17ZM13 13H11V7H13V13Z"/>
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-1">Media Access Error</h3>
                <p className="text-sm text-red-100 leading-relaxed">{error}</p>
                <div className="mt-3 text-xs text-red-200">
                  <p>💡 <strong>Troubleshooting tips:</strong></p>
                  <ul className="mt-1 space-y-1 list-disc list-inside">
                    <li>Click "Allow" when prompted for camera/microphone access</li>
                    <li>Check browser settings to enable media permissions</li>
                    <li>Ensure no other apps are using your camera/microphone</li>
                    <li>Try refreshing the page</li>
                  </ul>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={retryMediaAccess}
                    className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white text-sm font-medium rounded-md transition-colors"
                  >
                    Retry Access
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
