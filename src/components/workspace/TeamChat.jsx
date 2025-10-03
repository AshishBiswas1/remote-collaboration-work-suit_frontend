import { useEffect, useMemo, useRef, useState } from "react";
import { useSharedChat } from "../../hooks/useSharedChat";

export function TeamChat({ roomId, user, mySessions = [], onJoinSession, onBackToLauncher }) {
  const userId = user?.id || "anon";
  const [viewRoom, setViewRoom] = useState(roomId);
  const [text, setText] = useState("");
  const endRef = useRef(null);

  // Use shared chat hook
  const { messages, onlineUsers, isConnected, sendMessage } = useSharedChat(viewRoom, user);
  
  const displayName = user?.name || user?.email || "Anonymous User";

  useEffect(() => setViewRoom(roomId), [roomId]);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages]);

  const canSend = useMemo(() => text.trim().length > 0, [text]);

  const send = () => {
    if (!canSend || !viewRoom) return;
    sendMessage(text);
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
                {isConnected ? 'Connected' : 'Offline'}
              </span>
              {onlineUsers.size > 0 && (
                <span className="text-xs text-white/70">
                  • {onlineUsers.size} online
                </span>
              )}
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
      {viewRoom && onlineUsers.size > 0 && (
        <div className="px-4 py-2 bg-blue-900/30 border-b border-white/10">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-white/70">Online:</span>
            <div className="flex space-x-1 flex-wrap">
              {Array.from(onlineUsers).map((user, index) => {
                const [, userName] = user.split(':');
                return (
                  <span
                    key={index}
                    className="px-2 py-1 bg-green-600/20 text-green-300 text-xs rounded-full"
                  >
                    {userName}
                  </span>
                );
              })}
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
            No messages yet. {isConnected ? "Start the conversation!" : "Connecting..."}
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
            placeholder={viewRoom ? (isConnected ? "Send a message to everyone in this session" : "Connecting...") : "Select a session first"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            disabled={!viewRoom}
          />
          <button 
            onClick={send} 
            disabled={!canSend || !viewRoom} 
            className="btn btn-primary py-2"
          >
            Send
          </button>
        </div>
        {!isConnected && viewRoom && (
          <div className="text-xs text-yellow-400 mt-2">
            Note: Real-time messaging requires a Socket.IO server. Messages will be stored locally.
          </div>
        )}
      </div>
    </div>
  );
}
