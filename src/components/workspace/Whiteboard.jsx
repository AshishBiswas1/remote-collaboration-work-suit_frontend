import { useRef, useEffect, useState } from "react";

export function Whiteboard({ roomId }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState('pen');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentWidth, setCurrentWidth] = useState(2);
  const [isConnected] = useState(true);

  const colors = ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500'];
  const widths = [1, 2, 5, 10, 15, 20];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    const resizeCanvas = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width - 32; // Account for padding
      canvas.height = 400;
      
      // Set drawing styles
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const startDrawing = (e) => {
    if (currentTool !== 'pen') return;
    
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e) => {
    if (!isDrawing || currentTool !== 'pen') return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    ctx.lineWidth = currentWidth;
    ctx.strokeStyle = currentColor;
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const addShape = (shape) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentWidth;
    ctx.fillStyle = 'transparent';
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    if (shape === 'rectangle') {
      ctx.strokeRect(centerX - 50, centerY - 30, 100, 60);
    } else if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(centerX, centerY, 40, 0, 2 * Math.PI);
      ctx.stroke();
    }
  };

  const addText = () => {
    const text = prompt('Enter text:');
    if (!text) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = currentColor;
    ctx.font = `${Math.max(currentWidth * 8, 16)}px Arial`;
    ctx.fillText(text, canvas.width / 2 - 50, canvas.height / 2);
  };

  const exportImage = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = `whiteboard-${roomId}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="card-modern">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-900">Collaborative Whiteboard</h3>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">Room: {roomId}</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b p-4">
        <div className="flex items-center space-x-4 flex-wrap gap-2">
          {/* Tools */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentTool('select')}
              className={`p-2 rounded ${currentTool === 'select' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100'}`}
              title="Select"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={() => setCurrentTool('pen')}
              className={`p-2 rounded ${currentTool === 'pen' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100'}`}
              title="Pen"
            >
              ✏️
            </button>
          </div>

          <div className="w-px h-6 bg-gray-300"></div>

          {/* Shapes */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => addShape('rectangle')}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded"
              title="Rectangle"
            >
              ⬛
            </button>
            <button
              onClick={() => addShape('circle')}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded"
              title="Circle"
            >
              ⭕
            </button>
            <button
              onClick={addText}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded"
              title="Text"
            >
              T
            </button>
          </div>

          <div className="w-px h-6 bg-gray-300"></div>

          {/* Colors */}
          <div className="flex items-center space-x-1">
            {colors.map(color => (
              <button
                key={color}
                onClick={() => setCurrentColor(color)}
                className={`w-6 h-6 rounded border-2 ${currentColor === color ? 'border-gray-800' : 'border-gray-300'}`}
                style={{ backgroundColor: color }}
                title={`Color: ${color}`}
              />
            ))}
          </div>

          <div className="w-px h-6 bg-gray-300"></div>

          {/* Width */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Size:</span>
            <select
              value={currentWidth}
              onChange={(e) => setCurrentWidth(Number(e.target.value))}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              {widths.map(width => (
                <option key={width} value={width}>{width}px</option>
              ))}
            </select>
          </div>

          <div className="w-px h-6 bg-gray-300"></div>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            <button
              onClick={clearCanvas}
              className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm"
            >
              Clear
            </button>
            <button
              onClick={exportImage}
              className="px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded text-sm"
            >
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="p-4">
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <canvas
            ref={canvasRef}
            className="cursor-crosshair"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
          />
        </div>
      </div>
    </div>
  );
}
