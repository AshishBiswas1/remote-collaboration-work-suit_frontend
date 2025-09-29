import { useState, useRef } from "react";

export function DocEditor({ roomId, user }) {
  const [content, setContent] = useState('Welcome to the collaborative document editor!\n\nStart typing to see real-time collaboration in action.');
  const [isConnected, setIsConnected] = useState(true);
  const [collaborators] = useState([
    { name: user?.name || 'You', color: '#3B82F6', active: true },
    { name: 'John Doe', color: '#10B981', active: true },
    { name: 'Jane Smith', color: '#F59E0B', active: false }
  ]);
  const editorRef = useRef(null);

  const handleContentChange = (e) => {
    setContent(e.target.value);
    // In a real app, this would sync with Yjs or similar
  };

  const formatText = (format) => {
    const textarea = editorRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    
    let formattedText = '';
    switch (format) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        break;
      case 'heading':
        formattedText = `# ${selectedText}`;
        break;
      default:
        formattedText = selectedText;
    }

    const newContent = content.substring(0, start) + formattedText + content.substring(end);
    setContent(newContent);
  };

  const insertList = () => {
    const textarea = editorRef.current;
    const start = textarea.selectionStart;
    const listItem = '\n- ';
    const newContent = content.substring(0, start) + listItem + content.substring(start);
    setContent(newContent);
  };

  const saveDocument = () => {
    // Simulate save
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `document-${roomId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card-modern">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-900">Collaborative Document</h3>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">Room: {roomId}</span>
          </div>
        </div>

        {/* Collaborators */}
        <div className="flex items-center space-x-3">
          <span className="text-sm text-gray-600">Collaborators:</span>
          {collaborators.map((collab, index) => (
            <div key={index} className="flex items-center space-x-1">
              <div 
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white font-medium"
                style={{ backgroundColor: collab.color }}
              >
                {collab.name[0]}
              </div>
              <span className={`text-sm ${collab.active ? 'text-gray-900' : 'text-gray-500'}`}>
                {collab.name}
                {collab.active && <span className="ml-1 text-green-500">●</span>}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b p-4">
        <div className="flex items-center space-x-2 flex-wrap gap-2">
          <button
            onClick={() => formatText('bold')}
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm font-semibold transition-colors"
            title="Bold"
          >
            B
          </button>
          <button
            onClick={() => formatText('italic')}
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm italic transition-colors"
            title="Italic"
          >
            I
          </button>
          <button
            onClick={() => formatText('heading')}
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm font-bold transition-colors"
            title="Heading"
          >
            H1
          </button>
          <div className="w-px h-6 bg-gray-300"></div>
          <button
            onClick={insertList}
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm transition-colors"
            title="Bullet List"
          >
            • List
          </button>
          <div className="w-px h-6 bg-gray-300"></div>
          <button
            onClick={saveDocument}
            className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-sm transition-colors"
            title="Save Document"
          >
            💾 Save
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="p-4">
        <textarea
          ref={editorRef}
          value={content}
          onChange={handleContentChange}
          className="w-full h-96 p-4 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
          placeholder="Start typing your document..."
        />
      </div>

      {/* Status bar */}
      <div className="border-t p-3 text-xs text-gray-500 flex justify-between">
        <span>Characters: {content.length}</span>
        <span>Words: {content.split(/\s+/).filter(word => word.length > 0).length}</span>
        <span>Last saved: Auto-saved 2 mins ago</span>
      </div>
    </div>
  );
}
