import { useEffect, useState, useRef } from "react";
import Quill from "quill";
import "quill/dist/quill.snow.css";
import "./DocEditor.css";
import QuillCursors from "quill-cursors";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { QuillBinding } from "y-quill";
import { documentAPI } from "../../services/documentApi";

// Register the cursors module
Quill.register('modules/cursors', QuillCursors);

// Track globally initialized editors to prevent duplicates in StrictMode
const initializedEditors = new Set();

// Global Y.Doc instances per room - shared across all component instances
// This ensures all users in the same room share the same Y.js document
const yDocInstances = new Map();

// Global WebSocket provider instances per room - shared across all component instances
// This ensures all users connect through the same provider instance
const providerInstances = new Map();

// Get or create a shared Y.Doc for a specific room
const getYDoc = (roomId) => {
  if (!yDocInstances.has(roomId)) {
    console.log('📄 Creating new Y.Doc for room:', roomId);
    yDocInstances.set(roomId, new Y.Doc());
  } else {
    console.log('📄 Reusing existing Y.Doc for room:', roomId);
  }
  return yDocInstances.get(roomId);
};

// Get or create a shared WebSocket provider for a specific room
const getProvider = (roomId, yDoc) => {
  const providerKey = `doc-room-${roomId}`;
  
  if (!providerInstances.has(providerKey)) {
    console.log('🌐 Creating new WebSocket provider for room:', providerKey);
    console.log('🔧 Provider configuration:', {
      room: providerKey,
      serverUrl: 'ws://localhost:1234',
      note: 'Connect to local WebSocket server for cross-network collaboration'
    });
    
    // Create provider - let it create its own Awareness instance
    const provider = new WebsocketProvider(
      'ws://localhost:1234',  // Local WebSocket server
      providerKey,
      yDoc
    );
    
    providerInstances.set(providerKey, provider);
    
    // Expose provider for debugging in console
    if (typeof window !== 'undefined') {
      window.__yProvider = provider;
      window.__yDoc = yDoc;
      console.log('💡 Debug: Access provider via window.__yProvider in console');
    }
    
    // Enhanced logging for connection debugging
    provider.on('status', ({ status }) => {
      console.log('🔌 WebSocket Provider status:', status);
    });
    
    provider.on('sync', (isSynced) => {
      console.log('🔄 Document synced with server:', isSynced);
    });
    
    provider.on('connection-close', (event) => {
      console.log('⚠️ WebSocket connection closed:', event);
    });
    
    provider.on('connection-error', (error) => {
      console.error('❌ WebSocket connection error:', error);
    });
    
  } else {
    console.log('🌐 Reusing existing WebSocket provider for room:', providerKey);
  }
  
  return providerInstances.get(providerKey);
};

export function DocEditor({ roomId, user, mySessions = [], onJoinSession, onBackToLauncher }) {
  const editorRef = useRef(null);
  const quillRef = useRef(null);
  const providerRef = useRef(null); // Store WebRTC provider
  const isInitializedRef = useRef(false);
  const [yDoc] = useState(() => getYDoc(roomId)); // Use shared Y.Doc
  const [sessionData, setSessionData] = useState(null);
  const [documentSessionId, setDocumentSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Set());

  // Create or join a collaboration session
  useEffect(() => {
    const initializeSession = async () => {
      if (!roomId) return;
      
      setLoading(true);
      try {
        // Check if we already have a session ID stored for this room
        const storedSessionId = localStorage.getItem(`docSession_${roomId}`);
        
        if (storedSessionId) {
          // Try to get existing session using stored session ID
          const response = await documentAPI.getSession(storedSessionId);
          if (response.ok) {
            const result = await response.json();
            setSessionData(result.data || result);
            setDocumentSessionId(storedSessionId);
            return;
          } else {
            // Stored session no longer valid, remove it
            localStorage.removeItem(`docSession_${roomId}`);
          }
        }
        
        // Create new session
        const createResponse = await documentAPI.createSession({
          document_name: `Document - Room ${roomId}`,
          document_type: "text",
          is_public: false
        });
        
        if (createResponse.ok) {
          const result = await createResponse.json();
          const data = result.data || result;
          setSessionData(data);
          
          // Store the session ID for this room
          if (data.sessionId) {
            setDocumentSessionId(data.sessionId);
            localStorage.setItem(`docSession_${roomId}`, data.sessionId);
          }
        }
      } catch (error) {
        console.error("Failed to initialize session:", error);
        // Continue anyway - Y.js will work without backend session
        setSessionData({ documentId: roomId });
      } finally {
        setLoading(false);
      }
    };

    initializeSession();
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !editorRef.current) return;
    
    const editorKey = `editor-${roomId}`;
    
    // CRITICAL FIX: Check if already initialized to prevent duplicate toolbars
    // This check survives StrictMode remounts
    if (initializedEditors.has(editorKey)) {
      console.log('Editor already initialized, skipping duplicate initialization...');
      
      // If we have a ref but Quill is disabled, re-enable it
      if (quillRef.current && !quillRef.current.isEnabled()) {
        console.log('Re-enabling existing Quill instance...');
        quillRef.current.enable();
      }
      
      return;
    }
    
    // Mark as initialized IMMEDIATELY to prevent race conditions
    isInitializedRef.current = true;
    initializedEditors.add(editorKey);
    
    // Clear any existing content in the container
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }
    
    // Extract stable user info to avoid dependency issues
    const userName = user?.name || user?.email || 'Anonymous';
    const userId = user?.id || `anon_${Date.now()}`;
    
    console.log('Initializing Quill editor for room:', roomId);
    
    // Initialize Quill editor only once
    const quill = new Quill(editorRef.current, {
      theme: 'snow',
      modules: {
        cursors: {
          transformOnTextChange: true,
        },
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ list: 'ordered'}, { list: 'bullet' }],
          [{ color: [] }, { background: [] }],
          [{ align: [] }],
          ['link', 'image'],
          ['clean']
        ],
        history: {
          userOnly: true
        }
      },
      placeholder: loading ? "Connecting..." : "Start typing to collaborate..."
    });

    quillRef.current = quill;

    // Get cursors module for showing remote cursors
    const cursors = quill.getModule('cursors');
    
    // Get or create shared WebRTC provider for this room
    // This ensures all tabs/users in the same room connect through the same provider
    const provider = getProvider(roomId, yDoc);
    providerRef.current = provider; // Store provider reference
    
    // Log provider configuration
    console.log('Provider config:', {
      room: `doc-room-${roomId}`,
      maxConns: provider.maxConns,
      filterBcConns: provider.filterBcConns,
      awareness: !!provider.awareness,
      doc: !!provider.doc
    });
    
    const yText = yDoc.getText("quill");
    const awareness = provider.awareness;
    
    // Generate a random color for this user
    const userColor = '#' + Math.floor(Math.random()*16777215).toString(16);
    
    console.log('👤 Setting local user:', userName, 'with color:', userColor);
    
    // Set local user information
    awareness.setLocalStateField('user', {
      name: userName,
      color: userColor,
      id: userId
    });

    console.log('🔗 Binding Y.js to Quill...');
    
    // Bind Y.js to Quill - this handles real-time sync
    const binding = new QuillBinding(yText, quill, awareness);

    // Update collaborators list when awareness changes
    const updateCollaborators = () => {
      const states = Array.from(awareness.getStates().entries());
      console.log('📊 Awareness states:', states.length, 'total clients');
      
      const collabs = states
        .filter(([clientId]) => clientId !== awareness.clientID) // Exclude self
        .map(([clientId, state]) => ({
          id: clientId,
          name: state.user?.name || 'Anonymous',
          color: state.user?.color || '#gray'
        }));
      setCollaborators(collabs);
      
      // Update cursors for each collaborator
      collabs.forEach(collab => {
        const cursorId = collab.id.toString();
        const existingCursor = cursors.cursors().find(c => c.id === cursorId);
        
        if (!existingCursor) {
          console.log('✨ Creating cursor for:', collab.name, 'with color:', collab.color);
          cursors.createCursor(cursorId, collab.name, collab.color);
        }
      });
      
      console.log('👥 Collaborators updated:', collabs.length, 'remote users');
    };

    // Track typing users
    let typingTimeout;
    quill.on('text-change', (delta, oldDelta, source) => {
      if (source === 'user') {
        // User is typing
        awareness.setLocalStateField('typing', true);
        
        // Clear existing timeout
        clearTimeout(typingTimeout);
        
        // Set timeout to mark as not typing after 2 seconds
        typingTimeout = setTimeout(() => {
          awareness.setLocalStateField('typing', false);
        }, 2000);
      }
    });

    // Listen for typing indicators from remote users
    const updateTypingUsers = () => {
      const states = Array.from(awareness.getStates().entries());
      const typing = new Set();
      
      states.forEach(([clientId, state]) => {
        if (clientId !== awareness.clientID && state.typing) {
          typing.add(state.user?.name || 'Anonymous');
        }
      });
      
      setTypingUsers(typing);
    };

    awareness.on('change', () => {
      updateCollaborators();
      updateTypingUsers();
    });
    
    updateCollaborators(); // Initial update
    updateTypingUsers(); // Initial typing check

    // Only attach these event listeners once per component (not per provider)
    // These are component-specific handlers
    const statusHandler = ({ status }) => {
      console.log('🔌 WebSocket connection status:', status);
    };

    const errorHandler = (error) => {
      console.error('❌ WebSocket collaboration connection error:', error);
    };
    
    const syncHandler = (isSynced) => {
      console.log('✅ Document synced with server:', isSynced);
      // Trigger collaborator update when synced
      updateCollaborators();
    };

    // Attach event listeners - WebSocket provider uses different events than WebRTC
    provider.on('status', statusHandler);
    provider.on('connection-error', errorHandler);
    provider.on('sync', syncHandler);  // WebSocket uses 'sync' not 'synced'

    return () => {
      console.log('🧹 Cleaning up editor...');
      const editorKey = `editor-${roomId}`;
      
      clearTimeout(typingTimeout);
      
      // DON'T destroy provider or binding immediately - might be StrictMode remount
      // Just temporarily disable Quill
      if (quill) {
        quill.disable();
      }
      
      // Delay cleanup to see if this is a StrictMode remount or real unmount
      setTimeout(() => {
        // Check if component was re-mounted (isInitializedRef will be true again)
        if (!isInitializedRef.current) {
          console.log('✅ Component truly unmounted, cleaning up completely');
          
          // Remove provider event listeners
          if (provider) {
            provider.off('status', statusHandler);
            provider.off('connection-error', errorHandler);
            provider.off('sync', syncHandler);
          }
          
          // Now safe to clean up awareness listeners
          if (awareness) {
            awareness.off('change', updateCollaborators);
            awareness.off('change', updateTypingUsers);
          }
          
          // Clean up Y.js bindings ONLY (don't destroy shared provider or Y.Doc)
          if (binding) {
            binding.destroy();
          }
          
          // DON'T destroy provider or Y.Doc - they're shared globally!
          // Only remove our references
          
          // Clear initialization flags
          initializedEditors.delete(editorKey);
          quillRef.current = null;
          providerRef.current = null;
        } else {
          console.log('Component remounted (StrictMode), keeping editor reference');
        }
      }, 100); // Delay to handle StrictMode timing
    };
  }, [yDoc, roomId]);

  return (
    <div className="max-w-6xl mx-auto mt-10">
      <div className="mb-4">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold">Collaborative Docs Editor</h1>
            {loading && <p className="text-gray-600">Connecting to session...</p>}
            {sessionData && (
              <p className="text-sm text-gray-600">
                {sessionData.document_name || sessionData.title || `Room ${roomId}`}
              </p>
            )}
          </div>
          
          {/* Collaborators display */}
          <div className="flex-shrink-0">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-gray-700">
                  👥 Collaborators
                </span>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-semibold">
                  {collaborators.length + 1}
                </span>
              </div>
              
              <div className="space-y-1.5">
                {/* Show current user */}
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-xs text-gray-600">
                    {user?.name || user?.email || 'You'} (You)
                  </span>
                </div>
                
                {/* Show other collaborators */}
                {collaborators.length > 0 ? (
                  collaborators.map((collab) => (
                    <div key={collab.id} className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: collab.color }}
                      ></div>
                      <span className="text-xs text-gray-600">
                        {collab.name}
                        {typingUsers.has(collab.name) && (
                          <span className="ml-1 text-blue-600 italic">typing...</span>
                        )}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-400 italic">No other collaborators yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Connection status indicator */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
          <div className={`w-2 h-2 rounded-full ${collaborators.length > 0 ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
          <span>
            {loading 
              ? 'Connecting...' 
              : collaborators.length > 0 
                ? `Connected • ${collaborators.length} peer${collaborators.length > 1 ? 's' : ''} online`
                : 'Ready • Waiting for collaborators...'}
          </span>
        </div>

        {/* Typing indicators */}
        {typingUsers.size > 0 && (
          <div className="flex items-center gap-2 text-xs text-blue-600 mb-2">
            <div className="flex gap-1">
              <span className="animate-bounce">●</span>
              <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>●</span>
              <span className="animate-bounce" style={{ animationDelay: '0.4s' }}>●</span>
            </div>
            <span>
              {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
            </span>
          </div>
        )}
      </div>
      
      {/* Quill Editor Container */}
      <div 
        key={`editor-${roomId}`}
        ref={editorRef} 
        className="bg-white rounded-lg shadow-lg"
        style={{ minHeight: '500px' }}
      />

      {/* Info about real-time collaboration */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-2">
          <div className="text-blue-500 text-lg flex-shrink-0">ℹ️</div>
          <div>
            <h4 className="text-blue-800 font-medium mb-1 text-sm">Real-time Collaboration Active</h4>
            <ul className="text-blue-700 text-xs space-y-1">
              <li>• Your changes are instantly visible to all collaborators</li>
              <li>• Remote cursors show where others are editing</li>
              <li>• Colored highlights indicate each user's selections</li>
              <li>• Typing indicators show who is actively writing</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
