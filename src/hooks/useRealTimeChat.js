import { useEffect, useRef, useState, useCallback } from "react"
import { io } from 'socket.io-client'

// Real-time chat using Socket.IO connection
export function useRealTimeChat(roomId, user) {
  const userId = user?.id || "anon"
  const displayName = user?.name || user?.email || "Anonymous User"

  const [messages, setMessages] = useState([])
  const [onlineUsers, setOnlineUsers] = useState(new Set())
  const [isConnected, setIsConnected] = useState(false)
  const [connectionMethod, setConnectionMethod] = useState('socket.io')
  const [connectionStatus, setConnectionStatus] = useState('disconnected')

  const socketRef = useRef(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  // Socket.IO server URL - uses environment variable
  const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8000'

  // Initialize Socket.IO connection
  const initializeSocket = useCallback(() => {
    if (!roomId || !user || socketRef.current?.connected) return

    try {
      setConnectionStatus('connecting')

      // Create Socket.IO connection with optimal settings
      const socket = io(SOCKET_URL, {
        transports: ['polling', 'websocket'],  // Try polling first to avoid frame header errors
        autoConnect: true,
        timeout: 20000,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: 1000,
        upgrade: true,
        rememberUpgrade: true
      })

      socketRef.current = socket

      // Connection event handlers
      socket.on('connect', () => {
        setIsConnected(true)
        setConnectionStatus('connected')
        setConnectionMethod('socket.io')
        reconnectAttempts.current = 0

        // Join the room
        socket.emit('join-room', {
          roomId,
          user: {
            id: userId,
            name: displayName,
            email: user.email
          }
        })
      })

      socket.on('disconnect', (reason) => {
        setIsConnected(false)
        setConnectionStatus('disconnected')
        setOnlineUsers(new Set())
        
        // Attempt reconnection for certain disconnect reasons
        if (reason === 'io server disconnect') {
          // Server initiated disconnect, don't reconnect
          return
        }
        
        // Auto-reconnect for other reasons
        if (reconnectAttempts.current < maxReconnectAttempts) {
          setTimeout(() => {
            reconnectAttempts.current++
            socket.connect()
          }, 2000 * reconnectAttempts.current)
        }
      })

      socket.on('connect_error', (error) => {
        console.error('❌ Socket.IO connection error:', error)
        setIsConnected(false)
        setConnectionStatus('error')
      })

      // Room event handlers
      socket.on('room-state', ({ messages: roomMessages, onlineUsers: roomUsers }) => {
        // Transform backend message format to frontend format
        const transformedMessages = (roomMessages || []).map(msg => ({
          id: msg.id,
          user: msg.user?.name || 'Unknown',
          body: msg.text || msg.body || '',
          ts: new Date(msg.timestamp).getTime()
        }))
        setMessages(transformedMessages)
        setOnlineUsers(new Set(roomUsers.map(u => u.name)))
      })

      socket.on('new-message', (messageData) => {
        // Transform backend message format to frontend format
        const transformedMessage = {
          id: messageData.id,
          user: messageData.user?.name || 'Unknown',
          body: messageData.text || messageData.body || '',
          ts: new Date(messageData.timestamp).getTime()
        }
        setMessages(prev => [...prev, transformedMessage])
      })

      socket.on('user-joined', ({ user: joinedUser, onlineUsers: roomUsers }) => {
        setOnlineUsers(new Set(roomUsers.map(u => u.name)))
      })

      socket.on('user-left', ({ user: leftUser, onlineUsers: roomUsers }) => {
        setOnlineUsers(new Set(roomUsers.map(u => u.name)))
      })

      socket.on('error', ({ message }) => {
        console.error('⚠️ Socket.IO error:', message)
        setConnectionStatus('error')
      })

      socket.on('pong', () => {
        // Heartbeat received
      })

    } catch (error) {
      console.error('❌ Failed to initialize Socket.IO:', error)
      setIsConnected(false)
      setConnectionStatus('error')
    }
  }, [roomId, user, userId, displayName])

  // Send message via Socket.IO
  const sendMessage = useCallback((messageText) => {
    if (!messageText?.trim() || !roomId || !socketRef.current?.connected) {
      return false
    }

    try {
      socketRef.current.emit('send-message', {
        roomId,
        message: messageText.trim(),
        user: {
          id: userId,
          name: displayName,
          email: user?.email
        }
      })

      return true
    } catch (error) {
      return false
    }
  }, [roomId, userId, displayName, user])

  // Send heartbeat
  const sendHeartbeat = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('ping')
    }
  }, [])

  // Disconnect from room
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      
      if (roomId && socketRef.current.connected) {
        socketRef.current.emit('leave-room', { roomId })
      }
      
      socketRef.current.disconnect()
      socketRef.current = null
    }
    
    setIsConnected(false)
    setConnectionStatus('disconnected')
    setMessages([])
    setOnlineUsers(new Set())
  }, [roomId])

  // Initialize connection when component mounts or room changes
  useEffect(() => {
    if (!roomId || !user) {
      return
    }

    initializeSocket()

    return () => {
      disconnect()
    }
  }, [roomId, user, initializeSocket, disconnect])

  // Heartbeat interval
  useEffect(() => {
    if (!isConnected) return

    const heartbeatInterval = setInterval(sendHeartbeat, 30000)
    return () => clearInterval(heartbeatInterval)
  }, [isConnected, sendHeartbeat])

  return {
    messages,
    onlineUsers,
    isConnected,
    connectionMethod,
    connectionStatus,
    sendMessage,
    disconnect
  }
}
