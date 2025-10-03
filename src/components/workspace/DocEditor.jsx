import { useEffect, useMemo, useState, useRef } from "react";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";

function loadJSON(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } }
function saveJSON(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }

function docsKey(userId) { return `cs:docs:${userId || "anon"}`; }
function sessionDocsKey(userId, roomId) { return `cs:docs:${userId || "anon"}:room:${roomId || "none"}`; }

export function DocEditor({ roomId, user, mySessions = [], onJoinSession, onBackToLauncher }) {
  const userId = user?.id || "anon";
  const [allDocs, setAllDocs] = useState(() => loadJSON(docsKey(userId), []));
  const [sessionDocs, setSessionDocs] = useState(() => loadJSON(sessionDocsKey(userId, roomId), []));
  const [scope, setScope] = useState("session"); // "session" | "all"
  const docs = scope === "session" ? sessionDocs : allDocs;

  const [selectedId, setSelectedId] = useState(docs?.[0]?.id || "");
  const selectedDoc = useMemo(() => docs.find(d => d.id === selectedId), [docs, selectedId]);

  // Yjs collaboration state
  const ydocRef = useRef(null);
  const providerRef = useRef(null);
  const ytextRef = useRef(null);
  const textareaRef = useRef(null);
  const [collaborators, setCollaborators] = useState(new Map());
  const [isCollaborating, setIsCollaborating] = useState(false);

  const displayName = user?.name || user?.email || "Anonymous User";

  useEffect(() => setSessionDocs(loadJSON(sessionDocsKey(userId, roomId), [])), [userId, roomId]);
  useEffect(() => saveJSON(docsKey(userId), allDocs), [allDocs, userId]);
  useEffect(() => saveJSON(sessionDocsKey(userId, roomId), sessionDocs), [sessionDocs, userId, roomId]);

  // Initialize Yjs collaboration when a document is selected
  useEffect(() => {
    if (!selectedDoc || !roomId) {
      // Clean up existing collaboration
      if (providerRef.current) {
        providerRef.current.destroy();
        setIsCollaborating(false);
        setCollaborators(new Map());
      }
      return;
    }

    // Clean up previous collaboration
    if (providerRef.current) {
      providerRef.current.destroy();
    }

    // Create new Yjs document and WebRTC provider for real-time collaboration
    const ydoc = new Y.Doc();
    const provider = new WebrtcProvider(`doc-${roomId}-${selectedDoc.id}`, ydoc, {
      signaling: ["wss://signaling.yjs.dev"],
    });

    const ytext = ydoc.getText('content');
    
    ydocRef.current = ydoc;
    providerRef.current = provider;
    ytextRef.current = ytext;

    // Set up awareness for showing collaborators
    provider.awareness.setLocalStateField('user', {
      name: displayName,
      color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`,
    });

    // Listen for awareness changes (collaborators joining/leaving)
    const updateCollaborators = () => {
      const states = provider.awareness.getStates();
      setCollaborators(new Map(states));
    };

    provider.awareness.on('change', updateCollaborators);
    updateCollaborators();

    // Set initial content if ytext is empty
    if (ytext.length === 0 && selectedDoc.content) {
      ytext.insert(0, selectedDoc.content);
    }

    // Listen for ytext changes and update the textarea
    const updateTextarea = () => {
      if (textareaRef.current && textareaRef.current !== document.activeElement) {
        textareaRef.current.value = ytext.toString();
      }
    };

    ytext.observe(updateTextarea);
    updateTextarea();

    setIsCollaborating(true);

    return () => {
      if (provider) {
        provider.destroy();
      }
      setIsCollaborating(false);
      setCollaborators(new Map());
    };
  }, [selectedDoc, roomId, displayName]);

  const createDoc = () => {
    const id = `doc-${Math.random().toString(36).slice(2, 8)}`;
    const item = { id, title: "Untitled document", content: "", updatedAt: Date.now() };
    if (scope === "session") setSessionDocs(prev => [item, ...prev]); else setAllDocs(prev => [item, ...prev]);
    setSelectedId(id);
  };
  
  const updateDoc = (patch) => {
    const apply = (arr) => arr.map(d => d.id === selectedId ? { ...d, ...patch, updatedAt: Date.now() } : d);
    if (scope === "session") setSessionDocs(apply); else setAllDocs(apply);
  };
  
  const handleTextChange = (e) => {
    const newContent = e.target.value;
    
    // If we're collaborating, update the Yjs text
    if (ytextRef.current && isCollaborating) {
      const ytext = ytextRef.current;
      const oldContent = ytext.toString();
      
      // Simple diff and patch - for production, you'd want a more sophisticated diff algorithm
      if (newContent !== oldContent) {
        ytext.delete(0, ytext.length);
        ytext.insert(0, newContent);
      }
    }
    
    // Update local state
    updateDoc({ content: newContent });
  };
  
  const removeDoc = () => {
    if (!selectedDoc) return;
    if (!confirm("Delete this document?")) return;
    if (scope === "session") setSessionDocs(prev => prev.filter(d => d.id !== selectedId));
    else setAllDocs(prev => prev.filter(d => d.id !== selectedId));
    setSelectedId("");
  };

  return (
    <div className="h-full w-full bg-[#0f1115] rounded-2xl text-white overflow-hidden flex" style={{ minHeight: '600px' }}>
      {/* Left rail */}
      <aside className="hidden md:flex w-72 flex-col border-r border-white/10">
        <div className="h-14 px-4 flex items-center justify-between bg-black/20 backdrop-blur">
          <div className="font-semibold">Documents</div>
          <button className="btn btn-glass py-2" onClick={createDoc}>New</button>
        </div>

        <div className="p-3 flex items-center space-x-2">
          <button
            className={`px-3 py-1 rounded-md text-xs ${scope === "session" ? "bg-blue-600" : "bg-white/10"}`}
            onClick={() => setScope("session")}
          >
            This session
          </button>
          <button
            className={`px-3 py-1 rounded-md text-xs ${scope === "all" ? "bg-blue-600" : "bg-white/10"}`}
            onClick={() => setScope("all")}
          >
            My docs
          </button>
        </div>

        <div className="mt-3 overflow-auto px-2 pb-4 space-y-1">
          {docs.length === 0 && <div className="text-white/60 text-sm px-2">No documents yet.</div>}
          {docs.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedId(d.id)}
              className={`w-full text-left px-3 py-2 rounded-md ${selectedId === d.id ? "bg-blue-600/20 text-blue-200" : "hover:bg-white/10"}`}
            >
              <div className="font-medium truncate">{d.title}</div>
              <div className="text-xs text-white/60">{new Date(d.updatedAt).toLocaleString()}</div>
            </button>
          ))}
        </div>
      </aside>

      {/* Editor area */}
      <main className="flex-1 flex flex-col">
        <div className="h-14 px-4 flex items-center justify-between bg-black/30 backdrop-blur border-b border-white/10">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center font-bold">D</div>
            <div className="text-sm text-white/80">
              Documents
              {isCollaborating && (
                <span className="ml-2 px-2 py-1 bg-green-600 text-xs rounded-full">
                  Live ({collaborators.size} online)
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button className="btn btn-glass py-2" onClick={() => selectedDoc && updateDoc({ title: prompt("Rename:", selectedDoc.title) || selectedDoc.title })}>Rename</button>
            <button className="btn btn-glass py-2" onClick={removeDoc}>Delete</button>
            <button className="btn btn-glass py-2 text-red-400 hover:text-red-300" onClick={onBackToLauncher}>Leave Session</button>
          </div>
        </div>

        <div className="flex-1 p-4">
          {!selectedDoc ? (
            <div className="h-full rounded-xl border border-white/10 flex items-center justify-center text-white/70">
              <div className="text-center">
                <div className="text-6xl mb-4">📝</div>
                <h3 className="text-xl font-semibold mb-2">No document selected</h3>
                <p>Create a new document or select one from the sidebar.</p>
              </div>
            </div>
          ) : (
            <div className="h-full rounded-xl bg-white overflow-hidden">
              {/* Collaborators indicator */}
              {isCollaborating && collaborators.size > 1 && (
                <div className="px-4 py-2 bg-blue-100 border-b">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-600">Collaborating with:</span>
                    <div className="flex space-x-1">
                      {Array.from(collaborators.entries()).slice(0, 5).map(([id, state]) => (
                        state.user && (
                          <div
                            key={id}
                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                            style={{ backgroundColor: state.user.color }}
                            title={state.user.name}
                          >
                            {state.user.name?.[0]?.toUpperCase() || "?"}
                          </div>
                        )
                      ))}
                      {collaborators.size > 5 && (
                        <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-xs text-white">
                          +{collaborators.size - 5}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="px-4 py-3 border-b">
                <input
                  value={selectedDoc.title}
                  onChange={(e) => updateDoc({ title: e.target.value })}
                  className="text-lg font-semibold outline-none w-full bg-white text-gray-900 placeholder-gray-500"
                  placeholder="Document title..."
                />
              </div>
              <textarea
                ref={textareaRef}
                defaultValue={selectedDoc.content}
                onChange={handleTextChange}
                className="w-full h-[calc(100%-96px)] p-4 outline-none resize-none bg-white text-gray-900 placeholder-gray-500"
                placeholder="Start writing... (Real-time collaboration enabled when in a session)"
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
