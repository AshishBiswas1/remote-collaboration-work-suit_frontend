import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

function loadJSON(key, fallback) { 
  try { 
    const v = localStorage.getItem(key); 
    return v ? JSON.parse(v) : fallback; 
  } catch { 
    return fallback; 
  } 
}

function saveJSON(key, value) { 
  try { 
    localStorage.setItem(key, JSON.stringify(value)); 
  } catch {} 
}

function chatKey(userId, roomId) { 
  return `cs:chat:${userId || "anon"}:room:${roomId || "none"}`; 
}

export function useSharedChat(roomId, user) {
  const userId = user?.id || "anon";
  const displayName = user?.name || user?.email || "Anonymous User";
  
  const [messages, setMessages] = useState(() => loadJSON(chatKey(userId, roomId), []));
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  // Update messages when room changes
  useEffect(() => {
    setMessages(loadJSON(chatKey(userId, roomId), []));
  }, [userId, roomId]);

  // Save messages to localStorage
  useEffect(() => {
    saveJSON(chatKey(userId, roomId), messages);
  }, [messages, userId, roomId]);

  // Socket.IO connection for real-time chat
  useEffect(() => {
    if (!roomId) {
      // Disconnect if no room
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
        setOnlineUsers(new Set());
      }
      return;
    }

    // Connect to Socket.IO server
    const socket = io("ws://localhost:3001", {
      query: {
        roomId: roomId,
        userId: userId,
        userName: displayName,
      },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("join-room", { roomId: roomId, userId, userName: displayName });
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      setOnlineUsers(new Set());
    });

    socket.on("user-joined", ({ userId: joinedUserId, userName }) => {
      setOnlineUsers(prev => new Set([...prev, `${joinedUserId}:${userName}`]));
    });

    socket.on("user-left", ({ userId: leftUserId }) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        for (const user of newSet) {
          if (user.startsWith(`${leftUserId}:`)) {
            newSet.delete(user);
            break;
          }
        }
        return newSet;
      });
    });

    socket.on("online-users", (users) => {
      setOnlineUsers(new Set(users.map(u => `${u.userId}:${u.userName}`)));
    });

    socket.on("new-message", (message) => {
      setMessages(prev => {
        const newMessages = [...prev, message];
        // Also save to localStorage for persistence
        saveJSON(chatKey(userId, roomId), newMessages);
        return newMessages;
      });
    });

    return () => {
      socket.disconnect();
      setIsConnected(false);
      setOnlineUsers(new Set());
    };
  }, [roomId, userId, displayName]);

  const sendMessage = (messageText) => {
    if (!messageText.trim() || !roomId) return;
    
    const message = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      user: displayName,
      body: messageText.trim(),
      ts: Date.now(),
      userId,
    };

    // If connected to Socket.IO, emit message
    if (socketRef.current && isConnected) {
      socketRef.current.emit("send-message", message);
    } else {
      // Fallback to local storage only
      setMessages(prev => [...prev, message]);
    }
  };

  return {
    messages,
    onlineUsers,
    isConnected,
    sendMessage,
  };
}