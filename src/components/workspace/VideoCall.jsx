import { useEffect, useMemo, useRef, useState } from "react";
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
  const [stream, setStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
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

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setError("");
      try {
        if (!roomId) return;
        const media = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { width: 1280, height: 720 },
        });
        if (cancelled) {
          media.getTracks().forEach(stopTrack);
          return;
        }
        setStream(media);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = media;
          await localVideoRef.current.play().catch(() => {});
        }
        const a = media.getAudioTracks?.()?.[0];
        const v = media.getVideoTracks?.()?.[0];
        if (a) a.enabled = micOn;
        if (v) v.enabled = camOn;
      } catch (e) {
        setError(e?.message || "Could not access camera/microphone");
      }
    }
    init();
    return () => {
      cancelled = true;
      setStream((s) => {
        s?.getTracks()?.forEach(stopTrack);
        return null;
      });
      setScreenStream((s) => {
        s?.getTracks()?.forEach(stopTrack);
        return null;
      });
    };
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Effect to handle camera cleanup on page visibility change, hash change, or unmount
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        const track = stream?.getVideoTracks?.()?.[0];
        if (track && track.readyState === "live") {
          track.stop();
          setCamOn(false);
        }
      }
    };

    const handleHashChange = () => {
      // If leaving workspace page, stop camera track
      if (!location.hash.includes("#workspace")) {
        const track = stream?.getVideoTracks?.()?.[0];
        if (track && track.readyState === "live") {
          track.stop();
          setCamOn(false);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("hashchange", handleHashChange);

    // Cleanup on unmount
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("hashchange", handleHashChange);

      // Stop camera on component unmount
      const track = stream?.getVideoTracks?.()?.[0];
      if (track && track.readyState === "live") {
        track.stop();
      }
    };
  }, [stream]);

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
    stream?.getTracks()?.forEach(stopTrack);
    setStream(merged);
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = merged;
      await localVideoRef.current.play().catch(() => {});
    }
    return { audio: newAudio };
  };

  const ensureVideoOn = async () => {
    const currentVideo = stream?.getVideoTracks?.().find(t => t.readyState === "live");
    if (currentVideo) {
      currentVideo.enabled = true;
      return { video: currentVideo };
    }
    const videoOnly = await navigator.mediaDevices.getUserMedia({ audio: false, video: { width: 1280, height: 720 } });
    const newVideo = videoOnly.getVideoTracks()[0];
    const audioTrack = stream?.getAudioTracks?.().find(t => t.readyState === "live") || null;
    const merged = buildStream(audioTrack, newVideo);
    stream?.getTracks()?.forEach(stopTrack);
    setStream(merged);
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = merged;
      await localVideoRef.current.play().catch(() => {});
    }
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
    if (!roomId) return;
    try {
      if (camOn) {
        const track = stream?.getVideoTracks?.()?.[0];
        if (track) {
          track.stop(); // Completely stop the camera hardware
        }
        setCamOn(false);
      } else {
        await ensureVideoOn();
        setCamOn(true);
      }
    } catch (e) {
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
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            {!camOn && (
              <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-3 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-xl font-bold text-white">
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
          <div className="relative bg-gray-800 rounded-xl overflow-hidden min-h-[300px] lg:min-h-[400px] flex items-center justify-center">
            <div className="text-center text-gray-400">
              <div className="text-lg mb-2">📹</div>
              <div className="text-sm">Remote participants will appear here.</div>
              <div className="text-xs text-gray-500 mt-1">Share the session link to invite others</div>
            </div>
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
