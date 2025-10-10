// src/components/workspace/TeamChat.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export function TeamChat({ roomId, user, mySessions = [], onJoinSession, onBackToLauncher }) {
  const userId = user?.id || "anon";
  const displayName = user?.name || user?.email || "Anonymous User";
  
  const [viewRoom, setViewRoom] = useState(roomId);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  
  const socketRef = useRef(null);
  const endRef = useRef(null);

  // Socket.IO Connection
  useEffect(() => {
    if (!viewRoom || !user) return;

    console.log('🔌 Connecting to Socket.IO:', SOCKET_URL);
    
    // Create socket connection - start with polling to avoid WebSocket frame header errors
    const socket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],  // Try polling first, then upgrade to websocket
      autoConnect: true,
      upgrade: true,  // Allow upgrading to websocket after initial connection
      rememberUpgrade: true,
      timeout: 10000,
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('✅ Socket.IO connected:', socket.id);
      setIsConnected(true);
      
      // Join the room
      socket.emit('join-room', {
        roomId: viewRoom,
        user: {
          id: userId,
          name: displayName,
          email: user.email
        }
      });
    });

    socket.on('disconnect', () => {
      console.log('❌ Socket.IO disconnected');
      setIsConnected(false);
      setOnlineUsers([]);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket.IO connection error:', error);
      setIsConnected(false);
    });

    // Message events
    socket.on('room-state', (data) => {
      console.log('📦 Received room state:', data);
      if (data.messages) {
        const formattedMessages = data.messages.map(msg => ({
          id: msg.id || Date.now(),
          user: msg.user?.name || msg.user || 'Unknown',
          body: msg.text || msg.body || msg.message || '',
          ts: msg.timestamp || msg.ts || Date.now()
        }));
        setMessages(formattedMessages);
      }
      if (data.onlineUsers) {
        setOnlineUsers(data.onlineUsers);
      }
    });

    socket.on('new-message', (messageData) => {
      console.log('💬 New message received:', messageData);
      const newMsg = {
        id: messageData.id || Date.now(),
        user: messageData.user?.name || messageData.user || 'Unknown',
        body: messageData.text || messageData.body || messageData.message || '',
        ts: messageData.timestamp || messageData.ts || Date.now()
      };
      setMessages(prev => [...prev, newMsg]);
    });

    socket.on('user-joined', (data) => {
      console.log('👋 User joined:', data);
      if (data.onlineUsers) {
        setOnlineUsers(data.onlineUsers);
      }
    });

    socket.on('user-left', (data) => {
      console.log('👋 User left:', data);
      if (data.onlineUsers) {
        setOnlineUsers(data.onlineUsers);
      }
    });

    // Cleanup
    return () => {
      if (socket.connected) {
        socket.emit('leave-room', { roomId: viewRoom });
      }
      socket.disconnect();
    };
  }, [viewRoom, user, userId, displayName]);

  useEffect(() => setViewRoom(roomId), [roomId]);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages]);

  const canSend = useMemo(() => text.trim().length > 0, [text]);

  const send = () => {
    if (!canSend || !viewRoom || !socketRef.current?.connected) return;
    
    // Send message via Socket.IO
    socketRef.current.emit('send-message', {
      roomId: viewRoom,
      message: text.trim(),
      user: {
        id: userId,
        name: displayName,
        email: user?.email
      }
    });
    
    setText("");
  };

  return (
    <div className="h-full w-full bg-[#0f1115] text-white rounded-2xl overflow-hidden flex flex-col" style={{ minHeight: '600px' }}>
      <div className="h-14 px-4 flex items-center justify-between bg-black/30 backdrop-blur border-b border-white/10">
        <div className="flex items-center space-x-2">
          <div className="font-semibold">Team Chat</div>
          {viewRoom && (
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-xs text-white/70">
                {isConnected ? 'Connected (socket.io)' : 'Connecting...'}
              </span>
              {onlineUsers.length > 0 && (
                <span className="text-xs text-white/70">
                  • {onlineUsers.length} online
                </span>
              )}
              <span className="text-xs text-white/50">
                Room: {viewRoom.slice(0, 8)}...
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button 
            className="btn btn-glass py-2 text-red-400 hover:text-red-300" 
            onClick={onBackToLauncher}
          >
            Leave Session
          </button>
        </div>
      </div>

      {/* Online users indicator */}
      {viewRoom && onlineUsers.length > 0 && (
        <div className="px-4 py-2 bg-blue-900/30 border-b border-white/10">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-white/70">Online:</span>
            <div className="flex space-x-1 flex-wrap">
              {onlineUsers.map((user, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-green-600/20 text-green-300 text-xs rounded-full"
                >
                  {user.name || user}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {!viewRoom ? (
          <div className="h-full flex items-center justify-center text-white/60">
            <div className="text-center">
              <div className="text-6xl mb-4">💬</div>
              <h3 className="text-xl font-semibold mb-2">Select a session to start chatting</h3>
              <p>Choose an active session from the dropdown above to join the team chat.</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-white/60 text-sm">
            <div className="bg-green-900/30 border border-green-600/30 rounded-lg p-3 mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="font-medium text-green-300">Connected!</span>
              </div>
              <p className="text-green-200 text-xs mt-1">
                You're connected to the chat. Start the conversation!
              </p>
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="bg-white/5 border border-white/10 rounded-xl p-3">
              <div className="text-xs text-white/70">
                {m.user} • {new Date(m.ts).toLocaleTimeString()}
                {isConnected && <span className="ml-2 text-green-400">●</span>}
              </div>
              <div className="mt-1">{m.body}</div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <div className="p-3 border-t border-white/10 bg-black/20 backdrop-blur">
        <div className="flex items-center space-x-2">
          <input
            className="input-modern flex-1 bg-white text-gray-900 placeholder-gray-500 border border-gray-300"
            placeholder={viewRoom 
              ? (isConnected ? "Send a message to everyone in this session" : "Connecting to chat...") 
              : "Select a session first"
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            disabled={!viewRoom || !isConnected}
          />
          <button 
            onClick={send} 
            disabled={!canSend || !viewRoom || !isConnected} 
            className="btn btn-primary py-2"
          >
            Send
          </button>
        </div>
        {!isConnected && viewRoom && (
          <div className="text-xs text-yellow-400 mt-2">
            Establishing secure connection... Messages will sync once connected.
          </div>
        )}
      </div>
    </div>
  );
}
