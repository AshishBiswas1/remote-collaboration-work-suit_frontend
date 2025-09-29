import { useState, useRef, useEffect } from "react";

export function TeamChat({ roomId, user }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      user: 'System',
      message: `Welcome to room ${roomId}!`,
      timestamp: new Date().toISOString(),
      type: 'system'
    },
    {
      id: 2,
      user: 'John Doe',
      message: 'Hey everyone! Ready for our brainstorming session?',
      timestamp: new Date(Date.now() - 300000).toISOString(),
      type: 'user'
    },
    {
      id: 3,
      user: 'Jane Smith',
      message: 'Yes! I have some great ideas to share.',
      timestamp: new Date(Date.now() - 240000).toISOString(),
      type: 'user'
    }
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = () => {
    if (!newMessage.trim()) return;

    const message = {
      id: messages.length + 1,
      user: user?.name || 'You',
      message: newMessage,
      timestamp: new Date().toISOString(),
      type: 'user'
    };

    setMessages(prev => [...prev, message]);
    setNewMessage('');

    // Simulate someone else typing and responding
    setTimeout(() => {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        setMessages(prev => [...prev, {
          id: prev.length + 1,
          user: 'AI Assistant',
          message: 'That\'s a great point! Let me add that to our whiteboard.',
          timestamp: new Date().toISOString(),
          type: 'user'
        }]);
      }, 2000);
    }, 1000);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getAvatarColor = (name) => {
    const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div className="card-modern h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <h3 className="text-xl font-bold text-gray-900">Team Chat</h3>
        <p className="text-sm text-gray-600">Room: {roomId} • 3 participants online</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.user === (user?.name || 'You') ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex space-x-2 max-w-xs lg:max-w-md ${msg.user === (user?.name || 'You') ? 'flex-row-reverse space-x-reverse' : ''}`}>
              {msg.type === 'user' && (
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium ${getAvatarColor(msg.user)}`}>
                  {getInitials(msg.user)}
                </div>
              )}
              <div className={`${msg.type === 'system' ? 'w-full text-center' : ''}`}>
                {msg.type === 'system' ? (
                  <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full inline-block">
                    {msg.message}
                  </div>
                ) : (
                  <>
                    <div className={`px-4 py-2 rounded-2xl ${
                      msg.user === (user?.name || 'You')
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}>
                      <p className="text-sm">{msg.message}</p>
                    </div>
                    <div className={`text-xs text-gray-500 mt-1 ${msg.user === (user?.name || 'You') ? 'text-right' : 'text-left'}`}>
                      {msg.user !== (user?.name || 'You') && `${msg.user} • `}{formatTime(msg.timestamp)}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="flex space-x-2">
              <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center text-white text-xs font-medium">
                AI
              </div>
              <div className="bg-gray-100 px-4 py-2 rounded-2xl">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
        
        {/* Quick actions */}
        <div className="flex space-x-2 mt-2">
          <button
            onClick={() => setNewMessage('👍')}
            className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-full"
          >
            👍
          </button>
          <button
            onClick={() => setNewMessage('Great idea!')}
            className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-full"
          >
            Great idea!
          </button>
          <button
            onClick={() => setNewMessage('Let me check that...')}
            className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-full"
          >
            Let me check...
          </button>
        </div>
      </div>
    </div>
  );
}
