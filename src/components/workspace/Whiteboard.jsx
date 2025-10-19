import { useEffect, useRef, useState } from "react";
import { Canvas, Rect, Circle, FabricText, PencilBrush } from "fabric";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";

export function Whiteboard({ roomId, user, mySessions = [], onJoinSession, onBackToLauncher }) {
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const [viewRoom, setViewRoom] = useState(roomId);
  const [collaborationProvider, setCollaborationProvider] = useState(null);
  const ydocRef = useRef(null);
  const providerRef = useRef(null);
  
  // Drawing tools state
  const [currentTool, setCurrentTool] = useState('pen');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const [canvasBounds, setCanvasBounds] = useState({ width: 3000, height: 2000 });
  const [minCanvasSize, setMinCanvasSize] = useState({ width: 3000, height: 2000 });
  const [scrollPosition, setScrollPosition] = useState({ x: 0, y: 0 });
  const scrollContainerRef = useRef(null);
  
  const displayName = user?.name || user?.email || "Anonymous User";

  // Redirect to launcher if no session is selected
  useEffect(() => {
    if (!viewRoom && onBackToLauncher) {
      onBackToLauncher();
    }
  }, [viewRoom, onBackToLauncher]);

  // Initialize Yjs collaboration when room changes
  useEffect(() => {
    if (!viewRoom) return;

    // Clean up previous collaboration
    if (providerRef.current) {
      providerRef.current.destroy();
    }

    // Create new Yjs document and WebRTC provider for real-time collaboration
    const ydoc = new Y.Doc();
    
    // Y-WebRTC provider with local network discovery (no external signaling)
    const provider = new WebrtcProvider(`whiteboard-${viewRoom}`, ydoc, {
      // Disable signaling servers - use local broadcast and WebRTC only
      signaling: [],
      // Add connection options
      maxConns: 20 + Math.floor(Math.random() * 15),
      filterBcConns: false,
      // Add STUN servers for WebRTC NAT traversal
      peerOpts: {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      }
    });

    // Handle connection status
    provider.on('status', ({ status }) => {
      console.log('Whiteboard collaboration status:', status);
    });

    // Handle connection errors
    provider.on('connection-error', (error) => {
      console.error('Whiteboard collaboration connection error:', error);
    });

    ydocRef.current = ydoc;
    providerRef.current = provider;
    setCollaborationProvider(provider);

    return () => {
      if (provider) {
        provider.destroy();
      }
    };
  }, [viewRoom]);

  // Initialize Fabric.js canvas
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
      selection: currentTool === 'select',
      isDrawingMode: currentTool === 'pen',
    });

    fabricCanvasRef.current = canvas;

    // Configure drawing brush
    canvas.isDrawingMode = currentTool === 'pen';
    
    const brush = new PencilBrush(canvas);
    brush.width = brushSize;
    brush.color = currentColor;
    canvas.freeDrawingBrush = brush;

    // Function to expand canvas - DISABLED to prevent repositioning
    const expandCanvasIfNeeded = () => {
      // Expansion disabled to prevent object repositioning
      return;
    };

    // Event listeners for expansion - DISABLED to prevent repositioning
    // canvas.on('path:created', expandCanvasIfNeeded);
    // canvas.on('object:added', expandCanvasIfNeeded);
    // canvas.on('object:modified', expandCanvasIfNeeded);

    canvas.renderAll();

    // Handle container resize (but maintain larger canvas)
    const handleResize = () => {
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
      canvas.dispose();
    };
  }, [viewRoom, canvasBounds.width, canvasBounds.height, minCanvasSize]);

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

  // Removed canvas panning functions to prevent repositioning
  
  // Smooth scroll functions (keeping for container scrolling compatibility)
  const scrollToCenter = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const centerX = (canvasBounds.width - container.clientWidth) / 2;
    const centerY = (canvasBounds.height - container.clientHeight) / 2;

    container.scrollTo({
      left: Math.max(0, centerX),
      top: Math.max(0, centerY),
      behavior: 'smooth'
    });
  };

  const scrollToFitContent = () => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    const objects = canvas.getObjects();
    
    if (objects.length === 0) {
      // No objects to fit - do nothing to preserve current position
      return;
    }

    // Calculate bounding box of all objects
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    objects.forEach(obj => {
      const bounds = obj.getBoundingRect();
      minX = Math.min(minX, bounds.left);
      minY = Math.min(minY, bounds.top);
      maxX = Math.max(maxX, bounds.left + bounds.width);
      maxY = Math.max(maxY, bounds.top + bounds.height);
    });

    const container = scrollContainerRef.current;
    if (!container) return;

    // Center the content with some padding
    const padding = 50;
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    
    const scrollX = Math.max(0, minX - padding - (container.clientWidth - contentWidth) / 2);
    const scrollY = Math.max(0, minY - padding - (container.clientHeight - contentHeight) / 2);

    container.scrollTo({
      left: scrollX,
      top: scrollY,
      behavior: 'smooth'
    });
  };

  const scrollByAmount = (deltaX, deltaY) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.scrollBy({
      left: deltaX,
      top: deltaY,
      behavior: 'smooth'
    });
  };

  // Update canvas tool settings
  useEffect(() => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    
    // Set drawing mode first
    canvas.isDrawingMode = currentTool === 'pen';
    canvas.selection = currentTool === 'select';

    // Configure brush properties when in drawing mode
    if (currentTool === 'pen') {
      // Explicitly recreate the brush with current settings
      const brush = new PencilBrush(canvas);
      brush.width = brushSize;
      brush.color = currentColor;
      canvas.freeDrawingBrush = brush;
    }
    
    // Force canvas update
    canvas.renderAll();
  }, [currentTool, currentColor, brushSize]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (providerRef.current) {
        providerRef.current.destroy();
      }
    };
  }, []);

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

  const addText = () => {
    if (!fabricCanvasRef.current) return;
    
    const text = new FabricText('Click to edit', {
      left: 100,
      top: 100,
      fontFamily: 'Arial',
      fontSize: 20,
      fill: currentColor,
      editable: true,
    });
    
    fabricCanvasRef.current.add(text);
  };

  const clearCanvas = () => {
    if (!fabricCanvasRef.current) return;
    fabricCanvasRef.current.clear();
    fabricCanvasRef.current.backgroundColor = '#ffffff';
    fabricCanvasRef.current.renderAll();
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
                      onChange={(e) => setCurrentColor(e.target.value)}
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
                  
                  {/* Canvas Pan Controls - Disabled to prevent repositioning */}
                  <div className="flex items-center space-x-1 border-l border-gray-300 pl-2">
                    <button
                      onClick={() => {}} // Function removed to prevent repositioning
                      className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
                      title="Reset View"
                    >
                      �
                    </button>
                    <button
                      onClick={() => {}} // Function removed to prevent repositioning
                      className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 transition-colors"
                      title="Center Content"
                    >
                      🎯
                    </button>
                    <div className="flex flex-col space-y-0.5">
                      <button
                        onClick={() => {}} // Panning disabled to prevent repositioning
                        className="px-1.5 py-0.5 bg-gray-500 text-white rounded text-xs hover:bg-gray-600 transition-colors"
                        title="Pan Up"
                      >
                        ⬆️
                      </button>
                      <div className="flex space-x-0.5">
                        <button
                          onClick={() => {}} // Panning disabled to prevent repositioning
                          className="px-1.5 py-0.5 bg-gray-500 text-white rounded text-xs hover:bg-gray-600 transition-colors"
                          title="Pan Left"
                        >
                          ⬅️
                        </button>
                        <button
                          onClick={() => {}} // Panning disabled to prevent repositioning
                          className="px-1.5 py-0.5 bg-gray-500 text-white rounded text-xs hover:bg-gray-600 transition-colors"
                          title="Pan Right"
                        >
                          ➡️
                        </button>
                      </div>
                      <button
                        onClick={() => {}} // Panning disabled to prevent repositioning
                        className="px-1.5 py-0.5 bg-gray-500 text-white rounded text-xs hover:bg-gray-600 transition-colors"
                        title="Pan Down"
                      >
                        ⬇️
                      </button>
                    </div>
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

      {/* Canvas Area */}
      <div className="flex-1 relative bg-white overflow-auto">
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
