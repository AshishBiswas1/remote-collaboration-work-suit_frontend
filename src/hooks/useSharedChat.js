// src/hooks/useSharedChat.js
import { useEffect, useRef, useState } from "react"
import * as Y from "yjs"
import { WebrtcProvider } from "y-webrtc"

// keep these helpers if already present in the file
function loadJSON(key, fallback) {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : fallback
  } catch {
    return fallback
  }
}
function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}
function chatKey(userId, roomId) {
  return `cs:chat:${userId || "anon"}:room:${roomId || "none"}`
}

export function useSharedChat(roomId, user) {
  const userId = user?.id || "anon"
  const displayName = user?.name || user?.email || "Anonymous User"

  const [messages, setMessages] = useState(() => loadJSON(chatKey(userId, roomId), []))
  const [onlineUsers, setOnlineUsers] = useState(new Set())
  const [isConnected, setIsConnected] = useState(false)
  const [connectionMethod, setConnectionMethod] = useState('none')

  const refs = useRef({
    ydoc: null,
    provider: null,
    yMessages: null,
    subMessages: null,
    onAwareness: null,
    connectionCheckInterval: null,
    fallbackInterval: null
  })

  // load cached messages when switching room/user (optional local cache)
  useEffect(() => {
    setMessages(loadJSON(chatKey(userId, roomId), []))
  }, [userId, roomId])

  // persist to localStorage (optional)
  useEffect(() => {
    saveJSON(chatKey(userId, roomId), messages)
  }, [messages, userId, roomId])

  // Fallback localStorage-based sync for development/testing
  useEffect(() => {
    if (!roomId) return

    const fallbackKey = `cs:fallback:${roomId}`
    
    const checkFallbackMessages = () => {
      try {
        const fallbackData = loadJSON(fallbackKey, { messages: [], users: {} })
        const fallbackMessages = fallbackData.messages || []
        
        // Always update our presence first
        fallbackData.users = fallbackData.users || {}
        fallbackData.users[userId] = {
          name: displayName,
          lastSeen: Date.now()
        }
        
        // Clean old users (older than 30 seconds)
        const now = Date.now()
        Object.keys(fallbackData.users).forEach(uid => {
          if (now - fallbackData.users[uid].lastSeen > 30000) {
            delete fallbackData.users[uid]
          }
        })
        
        // Save updated data immediately (including our presence)
        saveJSON(fallbackKey, {
          messages: messages.length > fallbackMessages.length ? messages : fallbackMessages,
          users: fallbackData.users
        })
        
        // Update online users from fallback (exclude ourselves)
        const fallbackUsers = new Set()
        let connectedPeers = 0
        
        Object.entries(fallbackData.users).forEach(([uid, data]) => {
          if (uid !== userId) {
            fallbackUsers.add(`${uid}:${data.name}`)
            connectedPeers++
          }
        })
        
        // If we have new messages from fallback, merge them
        if (fallbackMessages.length > messages.length) {
          setMessages(fallbackMessages)
        }
        
        // Update connection status based on fallback users or messages
        const hasOtherUsers = connectedPeers > 0
        const hasMessages = fallbackMessages.length > 0
        const shouldBeConnected = hasOtherUsers || hasMessages
        
        if (shouldBeConnected && (!isConnected || connectionMethod !== 'fallback')) {
          setIsConnected(true)
          setConnectionMethod('fallback')
        }
        
        setOnlineUsers(fallbackUsers)
        
      } catch (error) {
        console.error('Fallback sync error:', error)
      }
    }

    // Initial check immediately
    checkFallbackMessages()
    
    // Check every 2 seconds for fallback sync
    const fallbackInterval = setInterval(checkFallbackMessages, 2000)
    refs.current.fallbackInterval = fallbackInterval

    return () => {
      if (fallbackInterval) {
        clearInterval(fallbackInterval)
      }
    }
  }, [roomId, userId, displayName, messages, isConnected, connectionMethod])

  // y-webrtc connection
  useEffect(() => {
    // cleanup if no room
    if (!roomId) {
      if (refs.current.provider) {
        try { refs.current.provider.destroy() } catch {}
      }
      if (refs.current.ydoc) {
        try { refs.current.ydoc.destroy() } catch {}
      }
      refs.current = { ydoc: null, provider: null, yMessages: null, subMessages: null, onAwareness: null }
      setIsConnected(false)
      setOnlineUsers(new Set())
      return
    }

    console.log(`🔗 WebRTC: Connecting to room "${roomId}"`)

    // Clean up any existing provider/ydoc completely before creating new ones
    const cleanup = () => {
      if (refs.current.provider) {
        try {
          // Remove awareness listeners first
          if (refs.current.onAwareness) {
            refs.current.provider.awareness.off("change", refs.current.onAwareness)
          }
          // Destroy provider (this should clean up the room registry)
          refs.current.provider.destroy()
        } catch (e) {
          console.warn('Error destroying provider:', e)
        }
      }
      if (refs.current.ydoc) {
        try {
          // Unobserve any existing observers
          if (refs.current.yMessages && refs.current.subMessages) {
            refs.current.yMessages.unobserve(refs.current.subMessages)
          }
          // Destroy ydoc
          refs.current.ydoc.destroy()
        } catch (e) {
          console.warn('Error destroying ydoc:', e)
        }
      }
    }

    // Clean up existing instances
    cleanup()
    
    // Reset refs
    refs.current = { 
      ydoc: null, 
      provider: null, 
      yMessages: null, 
      subMessages: null, 
      onAwareness: null,
      connectionCheckInterval: null,
      fallbackInterval: refs.current.fallbackInterval 
    }

    // Small delay to ensure cleanup is complete before creating new instances
    const timeoutId = setTimeout(() => {
      try {
        const ydoc = new Y.Doc()
        const yMessages = ydoc.getArray("messages")

        // Configure signaling servers and ICE as needed
        const provider = new WebrtcProvider(roomId, ydoc, {
          // Use backend signaling server for WebRTC coordination
          signaling: [
            'ws://localhost:8000/yjs-ws',  // Your backend WebRTC signaling server
          ],
          // Enable broadcast channel for same-origin communication
          enableBroadcastChannel: true,
          // Optional: use room ID as password for security
          password: roomId.slice(0, 16), // Use first 16 chars of room ID as password
          peerOpts: {
            config: {
              iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" },
                { urls: "stun:stun2.l.google.com:19302" }
              ]
            }
          }
        })

        // Connection event handlers
        provider.on('peers', (peers) => {
          const hasWebRTC = peers.webrtcPeers && peers.webrtcPeers.size > 0
          const hasBroadcast = peers.bcPeers && peers.bcPeers.size > 0
          const connected = hasWebRTC || hasBroadcast
          if (connected) {
            console.log(`✅ WebRTC connected: ${peers.webrtcPeers?.size || 0} peers`)
          }
          setIsConnected(connected)
        })

        // Presence via Awareness
        provider.awareness.setLocalState({
          id: userId,
          name: displayName,
          room: roomId,
          timestamp: Date.now()
        })

        // Sync messages to React state
        const updateMessages = () => {
          const raw = yMessages.toJSON()
          const normalized = raw.map((m) => ({
            id: m.id ?? `${ydoc.clientID}:${m.ts ?? Date.now()}`,
            user: m.user ?? m.author ?? "Unknown",
            body: m.body ?? m.text ?? "",
            ts: m.ts ?? Date.now(),
            userId: m.userId ?? userId
          }))
          setMessages(normalized)
        }

        // Presence roster and connection flag
        const onAwareness = () => {
          const states = provider.awareness.getStates()
          const roster = new Set()
          let connectedPeers = 0
          
          states.forEach((st, clientId) => {
            if (clientId !== ydoc.clientID && st) {
              const name = st?.name || `User-${clientId}`
              const room = st?.room
              
              // Only count users in the same room
              if (room === roomId) {
                roster.add(`${clientId}:${name}`)
                connectedPeers++
              }
            }
          })
          
          setOnlineUsers(roster)
          
          // More reliable connection detection
          const hasWebRTCPeers = provider.room?.webrtcConns?.size > 0
          const hasBroadcastPeers = provider.room?.bcConns?.size > 0
          const hasAwarenessUsers = connectedPeers > 0
          
          // Consider connected if we have any type of connection OR if there are awareness users
          const connected = hasWebRTCPeers || hasBroadcastPeers || hasAwarenessUsers
          
          // Update connection status
          if (connected !== isConnected) {
            setIsConnected(connected)
          }
        }

        // initial and subscriptions
        updateMessages()
        // register observer - store the callback so we can unobserve it later
        yMessages.observe(updateMessages)
        const subCallback = updateMessages
        provider.awareness.on("change", onAwareness)
        
        // Initial awareness check
        setTimeout(onAwareness, 1000) // Give time for initial connection
        
        // Periodic connection check
        const connectionCheckInterval = setInterval(onAwareness, 5000)

        // keep refs for sendMessage and cleanup
        refs.current = {
          ydoc,
          provider,
          yMessages,
          subMessages: subCallback,
          onAwareness,
          connectionCheckInterval
        }
      } catch (error) {
        console.error('Error creating Y.Doc/WebrtcProvider:', error)
        setIsConnected(false)
        setOnlineUsers(new Set())
      }
    }, 100) // Small delay to ensure cleanup

    return () => {
      clearTimeout(timeoutId)
      if (refs.current.connectionCheckInterval) {
        clearInterval(refs.current.connectionCheckInterval)
      }
      if (refs.current.fallbackInterval) {
        clearInterval(refs.current.fallbackInterval)
      }
      try {
        // Unobserve using the stored callback reference if available
        const cb = refs.current?.subMessages
        if (refs.current.yMessages && cb) {
          refs.current.yMessages.unobserve(cb)
        }
      } catch {}
      try { 
        if (refs.current.provider && refs.current.onAwareness) {
          refs.current.provider.awareness.off("change", refs.current.onAwareness)
        }
      } catch {}
      try { 
        if (refs.current.provider) {
          refs.current.provider.destroy()
        }
      } catch {}
      try { 
        if (refs.current.ydoc) {
          refs.current.ydoc.destroy()
        }
      } catch {}
      refs.current = { ydoc: null, provider: null, yMessages: null, subMessages: null, onAwareness: null, connectionCheckInterval: null, fallbackInterval: null }
      setIsConnected(false)
      setOnlineUsers(new Set())
      setConnectionMethod('none')
    }
  }, [roomId, userId, displayName])

  const sendMessage = (messageText) => {
    if (!messageText?.trim() || !roomId) return
    const now = Date.now()
    const id = `${refs.current.ydoc?.clientID ?? userId}:${now}`
    const msg = { id, user: displayName, body: messageText.trim(), ts: now, userId }
    
    // Try to send via Yjs first
    if (refs.current.yMessages) {
      refs.current.yMessages.push([msg])
    } else {
      // Fallback to localStorage for development/testing
      const fallbackKey = `cs:fallback:${roomId}`
      const fallbackData = loadJSON(fallbackKey, { messages: [], users: {} })
      fallbackData.messages = fallbackData.messages || []
      fallbackData.messages.push(msg)
      saveJSON(fallbackKey, fallbackData)
      
      // Update local messages immediately
      setMessages(prev => [...prev, msg])
    }
  }

  return { messages, onlineUsers, isConnected, sendMessage, connectionMethod }
}
