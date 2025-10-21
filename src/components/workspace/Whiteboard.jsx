import { useEffect, useRef, useState } from "react";
import { Canvas, Rect, Circle, FabricText, PencilBrush } from "fabric";
import io from "socket.io-client";


export function Whiteboard({ roomId, user, mySessions = [], onJoinSession, onBackToLauncher }) {
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const [viewRoom, setViewRoom] = useState(roomId);
  const socketRef = useRef(null);
  const isLocalChange = useRef(false);
  const canvasListenersAttached = useRef(false);
  
  // Drawing tools state
  const [currentTool, setCurrentTool] = useState('pen');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const [isErasing, setIsErasing] = useState(false);
  const [canvasBounds, setCanvasBounds] = useState({ width: 3000, height: 2000 });
  const [minCanvasSize, setMinCanvasSize] = useState({ width: 3000, height: 2000 });
  const [scrollPosition, setScrollPosition] = useState({ x: 0, y: 0 });
  const scrollContainerRef = useRef(null);
  
  // Text input modal state
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInputValue, setTextInputValue] = useState('');
  const textInputRef = useRef(null);
  
  const displayName = user?.name || user?.email || "Anonymous User";


  // Redirect to launcher if no session is selected
  useEffect(() => {
    if (!viewRoom && onBackToLauncher) {
      onBackToLauncher();
    }
  }, [viewRoom, onBackToLauncher]);


  // Initialize Socket.IO collaboration when room changes
  useEffect(() => {
    if (!viewRoom || !user) return;


    // Connect to Socket.IO server
    const socket = io('http://localhost:8000', {
      path: '/socket.io/',
      transports: ['polling', 'websocket'], // Try polling first, then upgrade to websocket
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 10000
    });

    socketRef.current = socket;

    // Listen for initial whiteboard state
    socket.on('whiteboard-state', (canvasState) => {
      if (fabricCanvasRef.current && canvasState) {
        isLocalChange.current = true;
        
        fabricCanvasRef.current.loadFromJSON(canvasState, () => {
          fabricCanvasRef.current.renderAll();
          
          setTimeout(() => {
            isLocalChange.current = false;
          }, 100);
        });
      } else {
        isLocalChange.current = false;
      }
    });

    // Listen for remote object additions
    socket.on('canvas-object-added', ({ canvasJSON }) => {
      if (fabricCanvasRef.current && !isLocalChange.current) {
        isLocalChange.current = true;
        
        fabricCanvasRef.current.loadFromJSON(canvasJSON, () => {
          fabricCanvasRef.current.renderAll();
          
          setTimeout(() => { isLocalChange.current = false; }, 50);
        });
      }
    });

    // Listen for remote object modifications
    socket.on('canvas-object-modified', ({ canvasJSON }) => {
      if (fabricCanvasRef.current && !isLocalChange.current) {
        isLocalChange.current = true;
        
        fabricCanvasRef.current.loadFromJSON(canvasJSON, () => {
          fabricCanvasRef.current.renderAll();
          
          setTimeout(() => { isLocalChange.current = false; }, 50);
        });
      }
    });

    // Listen for remote object removals
    socket.on('canvas-object-removed', ({ canvasJSON }) => {
      if (fabricCanvasRef.current && !isLocalChange.current) {
        isLocalChange.current = true;
        
        fabricCanvasRef.current.loadFromJSON(canvasJSON, () => {
          fabricCanvasRef.current.renderAll();
          
          setTimeout(() => { isLocalChange.current = false; }, 50);
        });
      }
    });

    // Listen for remote path creation (freehand drawing)
    socket.on('canvas-path-created', ({ canvasJSON }) => {
      if (fabricCanvasRef.current && !isLocalChange.current) {
        isLocalChange.current = true;
        
        fabricCanvasRef.current.loadFromJSON(canvasJSON, () => {
          fabricCanvasRef.current.renderAll();
          
          setTimeout(() => { isLocalChange.current = false; }, 50);
        });
      }
    });

    // Listen for canvas cleared
    socket.on('canvas-cleared', () => {
      if (fabricCanvasRef.current) {
        isLocalChange.current = true;
        fabricCanvasRef.current.clear();
        fabricCanvasRef.current.backgroundColor = '#ffffff';
        fabricCanvasRef.current.renderAll();
        setTimeout(() => { isLocalChange.current = false; }, 50);
      }
    });

    // Listen for full canvas sync
    socket.on('canvas-sync', ({ canvasJSON }) => {
      if (fabricCanvasRef.current) {
        isLocalChange.current = true;
        fabricCanvasRef.current.loadFromJSON(canvasJSON, () => {
          fabricCanvasRef.current.renderAll();
          setTimeout(() => { isLocalChange.current = false; }, 50);
        });
      }
    });

    // Handle connection events
    socket.on('connect', () => {
      // Join room after connection
      socket.emit('join-whiteboard', {
        roomId: viewRoom,
        userId: user.id || user.email,
        userName: user.name || user.email
      });
      
      // Attach canvas listeners if canvas exists and not already attached
      if (fabricCanvasRef.current && !canvasListenersAttached.current) {
        attachCanvasListeners(fabricCanvasRef.current);
      }
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Whiteboard connection error:', error.message);
    });

    socket.on('disconnect', (reason) => {
    });

    socket.on('user-joined-whiteboard', ({ userName }) => {
    });

    socket.on('user-left-whiteboard', ({ userName }) => {
    });

    return () => {
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
        socketRef.current = null;
      }
    };
  }, [viewRoom, user]);


  // Function to attach canvas event listeners
  const attachCanvasListeners = (canvas) => {
    if (canvasListenersAttached.current) {
      return;
    }
    
    
    canvas.on('object:added', (e) => {
      if (!isLocalChange.current && socketRef.current && socketRef.current.connected) {
        const canvasJSON = canvas.toJSON();
        socketRef.current.emit('canvas-object-added', { canvasJSON });
      } else {
      }
    });

    canvas.on('object:modified', (e) => {
      if (!isLocalChange.current && socketRef.current && socketRef.current.connected) {
        const canvasJSON = canvas.toJSON();
        socketRef.current.emit('canvas-object-modified', { canvasJSON });
      } else {
      }
    });

    canvas.on('object:removed', (e) => {
      if (!isLocalChange.current && socketRef.current && socketRef.current.connected) {
        const canvasJSON = canvas.toJSON();
        socketRef.current.emit('canvas-object-removed', { canvasJSON });
      } else {
      }
    });

    canvas.on('path:created', (e) => {
      if (!isLocalChange.current && socketRef.current && socketRef.current.connected) {
        const canvasJSON = canvas.toJSON();
        socketRef.current.emit('canvas-path-created', { canvasJSON });
      }
    });
    
    canvasListenersAttached.current = true;
  };

  // Initialize Fabric.js canvas (only once per room)
  useEffect(() => {
    if (!canvasRef.current) return;


    // Calculate initial canvas size (larger than container to allow scrolling)
    const container = canvasRef.current.parentElement;
    const initialWidth = Math.max(container.clientWidth, canvasBounds.width);
    const initialHeight = Math.max(container.clientHeight, canvasBounds.height);


    const canvas = new Canvas(canvasRef.current, {
      width: initialWidth,
      height: initialHeight,
      backgroundColor: '#ffffff',
      selection: false,
      isDrawingMode: false,
    });


    fabricCanvasRef.current = canvas;

    // Add event listeners for collaboration (will be properly attached when socket connects)
    if (socketRef.current && socketRef.current.connected) {
      attachCanvasListeners(canvas);
    } else {
    }

    canvas.renderAll();


    // Handle container resize (but maintain larger canvas)
    const handleResize = () => {
      if (!canvasRef.current) return;
      const container = canvasRef.current.parentElement;
      const newMinWidth = Math.max(container.clientWidth, minCanvasSize.width);
      const newMinHeight = Math.max(container.clientHeight, minCanvasSize.height);
      
      if (newMinWidth > canvas.width || newMinHeight > canvas.height) {
        canvas.setDimensions({
          width: Math.max(canvas.width, newMinWidth),
          height: Math.max(canvas.height, newMinHeight),
        });
        canvas.renderAll();
      }
    };


    window.addEventListener('resize', handleResize);


    return () => {
      window.removeEventListener('resize', handleResize);
      canvasListenersAttached.current = false;
      canvas.dispose();
    };
  }, [viewRoom]); // Only recreate canvas when room changes


  // Auto-focus text input when modal opens
  useEffect(() => {
    if (showTextInput && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [showTextInput]);


  // Scroll functionality
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;


    const handleScroll = () => {
      setScrollPosition({
        x: container.scrollLeft,
        y: container.scrollTop
      });
    };


    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);


  // Manual canvas expansion function - Minimal approach to prevent repositioning
  const expandCanvasManually = () => {
    if (!fabricCanvasRef.current) return;
    
    const canvas = fabricCanvasRef.current;
    const expandAmount = 500;
    
    // Simple dimension change only - no other operations
    const newWidth = canvas.width + expandAmount;
    const newHeight = canvas.height + expandAmount;
    
    canvas.setWidth(newWidth);
    canvas.setHeight(newHeight);
    
    setCanvasBounds({ width: newWidth, height: newHeight });
  };


  // Handle color change - update selected objects
  const handleColorChange = (newColor) => {
    setCurrentColor(newColor);
    
    if (!fabricCanvasRef.current) return;
    
    const canvas = fabricCanvasRef.current;
    const activeObject = canvas.getActiveObject();
    
    if (activeObject) {
      // Check if it's a group selection (multiple objects)
      if (activeObject.type === 'activeSelection') {
        activeObject.forEachObject((obj) => {
          updateObjectColor(obj, newColor);
        });
      } else {
        // Single object selected
        updateObjectColor(activeObject, newColor);
      }
      
      canvas.renderAll();
    }
  };


  // Helper function to update object color based on type
  const updateObjectColor = (obj, color) => {
    if (obj.type === 'text' || obj.type === 'i-text' || obj.type === 'textbox') {
      // For text objects, change fill color
      obj.set('fill', color);
    } else if (obj.type === 'path') {
      // For drawn paths (freehand drawing), change stroke color
      obj.set('stroke', color);
    } else {
      // For shapes (rectangle, circle), change stroke color
      obj.set('stroke', color);
    }
  };


  // Update canvas tool settings
  useEffect(() => {
    if (!fabricCanvasRef.current) return;


    const canvas = fabricCanvasRef.current;
    
    // Set drawing mode based on tool
    canvas.isDrawingMode = currentTool === 'pen' || currentTool === 'eraser';
    canvas.selection = currentTool === 'select';


    // Configure brush properties when in drawing mode
    if (currentTool === 'pen') {
      const brush = new PencilBrush(canvas);
      brush.width = brushSize;
      brush.color = currentColor;
      canvas.freeDrawingBrush = brush;
    } else if (currentTool === 'eraser') {
      // Eraser uses white color to "erase"
      const eraserBrush = new PencilBrush(canvas);
      eraserBrush.width = brushSize * 2; // Make eraser bigger
      eraserBrush.color = '#ffffff'; // White color to erase
      canvas.freeDrawingBrush = eraserBrush;
    }
    
    // Force canvas update
    canvas.renderAll();
  }, [currentTool, currentColor, brushSize]);


  useEffect(() => {
    setViewRoom(roomId);
  }, [roomId]);


  // Tool functions
  const addRectangle = () => {
    if (!fabricCanvasRef.current) return;
    
    const rect = new Rect({
      left: 100,
      top: 100,
      width: 100,
      height: 100,
      fill: 'transparent',
      stroke: currentColor,
      strokeWidth: 2,
    });
    
    fabricCanvasRef.current.add(rect);
  };


  const addCircle = () => {
    if (!fabricCanvasRef.current) return;
    
    const circle = new Circle({
      left: 100,
      top: 100,
      radius: 50,
      fill: 'transparent',
      stroke: currentColor,
      strokeWidth: 2,
    });
    
    fabricCanvasRef.current.add(circle);
  };


  // Show text input modal
  const addText = () => {
    setTextInputValue('');
    setShowTextInput(true);
  };


  // Handle text submission
  const handleTextSubmit = () => {
    if (!fabricCanvasRef.current || !textInputValue.trim()) {
      setShowTextInput(false);
      return;
    }
    
    const canvas = fabricCanvasRef.current;
    
    const text = new FabricText(textInputValue, {
      left: 100,
      top: 100,
      fontFamily: 'Arial',
      fontSize: 20,
      fill: currentColor,
      editable: true,
    });
    
    canvas.add(text);
    canvas.renderAll();
    
    // Close modal and reset
    setShowTextInput(false);
    setTextInputValue('');
  };


  // Handle Enter key in text input
  const handleTextKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit();
    } else if (e.key === 'Escape') {
      setShowTextInput(false);
      setTextInputValue('');
    }
  };


  const clearCanvas = () => {
    if (!fabricCanvasRef.current) return;
    
    isLocalChange.current = true;
    fabricCanvasRef.current.clear();
    fabricCanvasRef.current.backgroundColor = '#ffffff';
    fabricCanvasRef.current.renderAll();
    isLocalChange.current = false;
    
    // Emit clear event to other users
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('canvas-cleared');
    }
  };


  return (
    <div className="h-full w-full bg-gray-50 rounded-2xl overflow-hidden flex flex-col" style={{ minHeight: '700px' }}>
      {/* Header with instructions and tools */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        {/* Instructions Banner */}
        <div className="px-3 sm:px-4 py-2 sm:py-3 bg-blue-50 border-b border-blue-100">
          <div className="flex items-center space-x-2">
            <div className="text-blue-600 text-sm flex-shrink-0">ℹ️</div>
            <div className="text-xs sm:text-sm text-blue-800">
              <strong>How to use:</strong> 
              <span className="hidden sm:inline"> Select a session below → Click "Join Session" → Choose your drawing tool and start creating! 
              Full collaborative whiteboard with shapes, text, and freehand drawing.</span>
              <span className="sm:hidden"> Join a session and start drawing!</span>
            </div>
          </div>
        </div>
        
        {/* Tools and Session Management */}
        <div className="px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-3 lg:space-y-0">
            {/* Drawing Tools */}
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <h2 className="text-base sm:text-lg font-semibold text-gray-800">Collaborative Whiteboard</h2>
              
              {viewRoom && (
                <div className="flex flex-wrap items-center gap-2 sm:gap-2 border-l-0 sm:border-l border-gray-300 sm:pl-4">
                  {/* Tool Selection */}
                  <button
                    onClick={() => setCurrentTool('pen')}
                    className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                      currentTool === 'pen' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Draw
                  </button>
                  
                  <button
                    onClick={() => setCurrentTool('select')}
                    className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                      currentTool === 'select' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Select
                  </button>
                  
                  <button
                    onClick={() => setCurrentTool('eraser')}
                    className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                      currentTool === 'eraser' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Eraser
                  </button>
                  
                  <button
                    onClick={addRectangle}
                    className="px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                  >
                    <span className="hidden sm:inline">Rectangle</span>
                    <span className="sm:hidden">Rect</span>
                  </button>
                  
                  <button
                    onClick={addCircle}
                    className="px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                  >
                    Circle
                  </button>
                  
                  <button
                    onClick={addText}
                    className="px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                  >
                    Text
                  </button>
                  
                  {/* Color Picker */}
                  <div className="flex items-center space-x-1 sm:space-x-2 border-l-0 sm:border-l border-gray-300 sm:pl-4">
                    <label className="text-xs sm:text-sm text-gray-600 hidden sm:block">Color:</label>
                    <input
                      type="color"
                      value={currentColor}
                      onChange={(e) => handleColorChange(e.target.value)}
                      className="w-6 h-6 sm:w-8 sm:h-8 rounded border border-gray-300 cursor-pointer"
                    />
                  </div>
                  
                  {/* Brush Size */}
                  <div className="flex items-center space-x-1 sm:space-x-2">
                    <label className="text-xs sm:text-sm text-gray-600 hidden sm:block">Size:</label>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={brushSize}
                      onChange={(e) => setBrushSize(parseInt(e.target.value))}
                      className="w-12 sm:w-20"
                    />
                    <span className="text-xs sm:text-sm text-gray-600 w-4 sm:w-6">{brushSize}</span>
                  </div>
                  
                  {/* Expand Canvas Button */}
                  <button
                    onClick={expandCanvasManually}
                    className="px-2 sm:px-3 py-1.5 sm:py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs sm:text-sm font-medium"
                    title="Expand Canvas (+500px)"
                  >
                    Expand
                  </button>
                  
                  {/* Clear Button */}
                  <button
                    onClick={clearCanvas}
                    className="px-2 sm:px-3 py-1.5 sm:py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-xs sm:text-sm font-medium"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
            
            {/* Session Info and Leave Button */}
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
              <div className="text-xs sm:text-sm text-gray-600">
                {viewRoom ? (
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                    ✓ Connected to: {mySessions.find(s => s.id === viewRoom)?.name || viewRoom}
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                    ! No session selected
                  </span>
                )}
              </div>
              
              {viewRoom && (
                <button 
                  className="px-3 sm:px-4 py-1.5 sm:py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg shadow-sm transition-all duration-200 border-2 border-red-600 hover:border-red-700 text-xs sm:text-sm" 
                  onClick={() => onBackToLauncher?.()}
                  title="Leave current session and return to workspace launcher"
                >
                  Leave Session
                </button>
              )}
            </div>
          </div>
        </div>
      </div>


      {/* Text Input Modal */}
      {showTextInput && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowTextInput(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Add Text to Canvas</h3>
            <textarea
              ref={textInputRef}
              value={textInputValue}
              onChange={(e) => setTextInputValue(e.target.value)}
              onKeyDown={handleTextKeyPress}
              placeholder="Type your text here..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows="4"
            />
            <div className="mt-4 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowTextInput(false);
                  setTextInputValue('');
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleTextSubmit}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
              >
                Add Text
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-3">Press Enter to add, Shift+Enter for new line, Esc to cancel</p>
          </div>
        </div>
      )}


      {/* Canvas Area */}
      <div ref={scrollContainerRef} className="flex-1 relative bg-white overflow-auto">
        {viewRoom ? (
          <div className="min-w-full min-h-full relative" style={{ width: canvasBounds.width, height: canvasBounds.height }}>
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0"
              style={{ 
                display: 'block',
                touchAction: 'none'
              }}
            />
            {/* Canvas size indicator */}
            <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-2 rounded-lg text-xs z-10">
              Canvas: {canvasBounds.width} × {canvasBounds.height}px
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center bg-gray-50 p-4">
            <div className="text-center max-w-md mx-auto">
              <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">🎨</div>
              <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 text-gray-800">Ready to Create Together?</h3>
              <div className="space-y-2 sm:space-y-3 text-gray-600">
                <p className="text-sm sm:text-base">Choose a session from the dropdown above to start collaborating on the whiteboard.</p>
                <div className="bg-white border border-gray-200 rounded-lg p-2 sm:p-3 text-xs sm:text-sm">
                  <div className="font-semibold text-gray-800 mb-1 sm:mb-2">Features Available:</div>
                  <ul className="text-left space-y-0.5 sm:space-y-1">
                    <li>• Freehand drawing</li>
                    <li>• Shapes (rectangles, circles)</li>
                    <li>• Text annotations</li>
                    <li>• Color customization</li>
                    <li>• Real-time collaboration</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
