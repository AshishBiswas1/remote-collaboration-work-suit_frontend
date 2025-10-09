import { useEffect, useState } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { documentAPI } from "../../services/documentApi";

export function DocEditor({ roomId, user, mySessions = [], onJoinSession, onBackToLauncher }) {
  const [editorContent, setEditorContent] = useState("");
  const [yDoc] = useState(() => new Y.Doc());
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Create or join a collaboration session
  useEffect(() => {
    const initializeSession = async () => {
      if (!roomId) return;
      
      setLoading(true);
      try {
        // Try to get existing session first
        const response = await documentAPI.getSession(roomId);
        if (response.ok) {
          const session = await response.json();
          setSessionData(session);
        } else {
          // Create new session if it doesn't exist
          const createResponse = await documentAPI.createSession({
            roomId: roomId,
            title: "Collaborative Document",
            userId: user?.id || "anonymous"
          });
          if (createResponse.ok) {
            const newSession = await createResponse.json();
            setSessionData(newSession);
          }
        }
      } catch (error) {
        console.error("Failed to initialize session:", error);
      } finally {
        setLoading(false);
      }
    };

    initializeSession();
  }, [roomId, user]);

  useEffect(() => {
    if (!roomId) return;
    
    const provider = new WebrtcProvider(`doc-room-${roomId}`, yDoc, {
      signaling: ['ws://localhost:8000/yjs-ws']
    });
    const yText = yDoc.getText("quill");

    // Sync Yjs changes into React state
    yText.observe(() => {
      setEditorContent(yText.toString());
    });

    return () => {
      provider.destroy();
      yDoc.destroy();
    };
  }, [yDoc, roomId]);

  const handleChange = (value) => {
    setEditorContent(value);
    const yText = yDoc.getText("quill");
    yText.delete(0, yText.length);
    yText.insert(0, value);
  };

  return (
    <div className="max-w-3xl mx-auto mt-10">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Collaborative Docs Editor</h1>
        {loading && <p className="text-gray-600">Connecting to session...</p>}
        {sessionData && (
          <p className="text-sm text-gray-600">
            Session: {sessionData.title || `Room ${roomId}`}
          </p>
        )}
      </div>
      <ReactQuill
        value={editorContent}
        onChange={handleChange}
        theme="snow"
        className="bg-white"
        placeholder={loading ? "Connecting..." : "Start typing to collaborate..."}
      />
    </div>
  );
}
