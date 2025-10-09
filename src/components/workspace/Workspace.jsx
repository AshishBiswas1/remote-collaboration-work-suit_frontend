import { useEffect, useMemo, useState } from "react";
import { VideoCall } from "./VideoCall";
import { DocEditor } from "./DocEditor";
import { Whiteboard } from "./Whiteboard";
import { TeamChat } from "./TeamChat";
import { TaskBoard } from "./TaskBoard";
import { useAuth } from "../../context/AuthContext";
import { sessionAPI } from "../../services/sessionApi";
import { Navbar } from "../landing/Navbar";
import { SessionModal } from "./SessionModal";

/** Hash room helpers */
function parseRoomFromHash() {
  const hash = window.location.hash || "";
  const [base, query = ""] = hash.split("?");
  if (!base.startsWith("#workspace")) return null;
  const params = new URLSearchParams(query);
  const room = params.get("room");
  return room || null;
}
function setRoomInHash(roomId) {
  const url = new URL(window.location.href);
  url.hash = `workspace?room=${encodeURIComponent(roomId)}`;
  window.history.replaceState({}, "", url);
}

/** Storage helpers */
function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
function sessionsKey(userId) {
  return `cs:sessions:${userId || "anon"}`;
}

export function Workspace() {
  const { user, logout } = useAuth();
  const userId = user?.id || "anon";

  const [activeTab, setActiveTab] = useState("launcher");
  const [roomId, setRoomId] = useState(parseRoomFromHash() || "");
  const [mySessions, setMySessions] = useState(() => loadJSON(sessionsKey(userId), []));
  const [toast, setToast] = useState("");
  const [showSessionModal, setShowSessionModal] = useState(false);
  
  // Session deletion state
  const [selectedSessions, setSelectedSessions] = useState(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);

  const shareLink = useMemo(() => {
    if (!roomId) return "";
    const url = new URL(window.location.href);
    url.hash = `workspace?room=${encodeURIComponent(roomId)}`;
    return url.toString();
  }, [roomId]);

  useEffect(() => {
    const onHash = () => {
      const fromHash = parseRoomFromHash();
      if (fromHash && fromHash !== roomId) {
        setRoomId(fromHash);
        setMySessions((prev) => {
          const exists = prev.some((s) => s.id === fromHash);
          if (exists) return prev;
          const next = [
            { id: fromHash, name: `Session ${new Date().toLocaleString()}`, joinedAt: Date.now() },
            ...prev,
          ];
          saveJSON(sessionsKey(userId), next);
          return next;
        });
        setActiveTab("launcher");
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [roomId, userId]);

  useEffect(() => {
    setMySessions(loadJSON(sessionsKey(userId), []));
  }, [userId]);

  const tabs = [
    { id: "video", label: "Video Call", icon: "🎥", component: VideoCall },
    { id: "docs", label: "Documents", icon: "📝", component: DocEditor },
    { id: "teamchat", label: "Team Chat", icon: "💬", component: TeamChat },
    { id: "whiteboard", label: "Whiteboard", icon: "🎨", component: Whiteboard },
    { id: "tasks", label: "Tasks", icon: "📋", component: TaskBoard },
  ];
  const ActiveComponent = tabs.find((t) => t.id === activeTab)?.component;

  const handleStartSession = async (sessionData) => {
    try {
      setToast("Creating session...");
      
      // Create session via backend API with the provided data
      const response = await sessionAPI.createSession(sessionData);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create session');
      }

      const result = await response.json();
      const session = result.data.session;
      
      // Use the session token as the room ID
      const newId = session.session_token;
      setRoomId(newId);
      setRoomInHash(newId);

      // Store session locally
      const newSession = {
        id: newId,
        name: session.session_name,
        joinedAt: Date.now(),
        backendSessionId: session.id,
        sessionToken: session.session_token,
        creatorId: session.creator_id,
        maxParticipants: session.max_participants,
        expiresAt: session.expires_at
      };
      
      const next = [newSession, ...loadJSON(sessionsKey(userId), [])];
      setMySessions(next);
      saveJSON(sessionsKey(userId), next);

      const link = new URL(window.location.href).toString();
      try {
        await navigator.clipboard.writeText(link);
        setToast("Session created successfully and link copied to clipboard!");
      } catch {
        setToast("Session created successfully. Copy the share link from header.");
      }
      
      console.log('Session created:', session);
      
    } catch (error) {
      console.error('Failed to create session:', error);
      setToast(`Failed to create session: ${error.message}`);
      throw error; // Re-throw so the modal can handle it
    }
    
    setTimeout(() => setToast(""), 3000);
  };

  const handleCopyShare = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setToast("Share link copied.");
      setTimeout(() => setToast(""), 1800);
    } catch {}
  };

  const handleJoinExisting = (id) => {
    setRoomId(id);
    setRoomInHash(id);
    setActiveTab("launcher");
  };

  const handleBackToLauncher = () => {
    setActiveTab("launcher");
    // Clear the room ID and update URL when returning to launcher
    setRoomId("");
    window.history.replaceState({}, "", window.location.pathname + "#workspace");
  };

  // Session deletion functions
  const handleDeleteSingleSession = (sessionId) => {
    const sessionToDelete = mySessions.find(s => s.id === sessionId);
    if (!sessionToDelete) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete the session "${sessionToDelete.name}"? This action cannot be undone.`
    );

    if (confirmed) {
      const updatedSessions = mySessions.filter(s => s.id !== sessionId);
      setMySessions(updatedSessions);
      saveJSON(sessionsKey(userId), updatedSessions);
      
      // Clear current room if it's the one being deleted
      if (roomId === sessionId) {
        setRoomId("");
        window.history.replaceState({}, "", window.location.pathname + "#workspace");
      }
      
      setToast("Session deleted successfully.");
      setTimeout(() => setToast(""), 2000);
    }
  };

  const handleToggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    setSelectedSessions(new Set());
  };

  const handleSelectSession = (sessionId) => {
    const newSelected = new Set(selectedSessions);
    if (newSelected.has(sessionId)) {
      newSelected.delete(sessionId);
    } else {
      newSelected.add(sessionId);
    }
    setSelectedSessions(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedSessions.size === mySessions.length) {
      setSelectedSessions(new Set());
    } else {
      setSelectedSessions(new Set(mySessions.map(s => s.id)));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedSessions.size === 0) return;

    const sessionNames = mySessions
      .filter(s => selectedSessions.has(s.id))
      .map(s => s.name)
      .join(", ");

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedSessions.size} session(s): ${sessionNames}? This action cannot be undone.`
    );

    if (confirmed) {
      const updatedSessions = mySessions.filter(s => !selectedSessions.has(s.id));
      setMySessions(updatedSessions);
      saveJSON(sessionsKey(userId), updatedSessions);
      
      // Clear current room if it's being deleted
      if (selectedSessions.has(roomId)) {
        setRoomId("");
        window.history.replaceState({}, "", window.location.pathname + "#workspace");
      }
      
      setSelectedSessions(new Set());
      setIsSelectMode(false);
      setToast(`${selectedSessions.size} session(s) deleted successfully.`);
      setTimeout(() => setToast(""), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navbar */}
      <Navbar />

      {/* Toast */}
      {toast && (
        <div className="fixed top-24 sm:top-28 left-1/2 -translate-x-1/2 z-50 px-4">
          <div className="card-modern px-4 py-2 text-sm max-w-sm">{toast}</div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0 pt-16 sm:pt-20">{/* Add padding-top for navbar */}
        {/* Workspace Header */}
        <div className="bg-white shadow-sm border-b flex-shrink-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-12 sm:h-14">
              <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
                <h1 className="text-base sm:text-lg font-semibold text-gray-900 truncate">Workspace</h1>
                <div className="text-gray-300 hidden sm:block">|</div>
                <span className="text-xs sm:text-sm text-gray-600 hidden lg:block truncate max-w-40">
                  {roomId ? `Session: ${roomId}` : "No active session"}
                </span>
              </div>

              <div className="flex items-center space-x-1 sm:space-x-3 flex-shrink-0">
                <button onClick={() => setShowSessionModal(true)} className="btn btn-primary py-1.5 sm:py-2 text-xs sm:text-sm px-2 sm:px-3 whitespace-nowrap">
                  <span className="hidden sm:inline">Start session</span>
                  <span className="sm:hidden">Start</span>
                </button>
                <button
                  onClick={handleCopyShare}
                  className="btn btn-secondary py-1.5 sm:py-2 text-xs sm:text-sm px-2 sm:px-3 whitespace-nowrap"
                  disabled={!roomId}
                  title={roomId ? "Copy share link" : "Start a session first"}
                >
                  <span className="hidden sm:inline">Share link</span>
                  <span className="sm:hidden">Share</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        {/* Tabs (hide on launcher) */}
        {activeTab !== "launcher" && (
          <div className="bg-white border-b flex-shrink-0">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex space-x-2 sm:space-x-4 lg:space-x-8 overflow-x-auto scrollbar-hide">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (!roomId) {
                        setToast("Session required. Please create or join a session first.");
                        setTimeout(() => setToast(""), 3000);
                        setActiveTab("launcher");
                        return;
                      }
                      setActiveTab(tab.id);
                    }}
                    className={`flex items-center space-x-1 sm:space-x-2 py-3 sm:py-4 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap flex-shrink-0 ${
                      activeTab === tab.id
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    } ${!roomId ? 'opacity-50' : ''}`}
                  >
                    <span className="text-sm sm:text-lg">{tab.icon}</span>
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden text-xs">{tab.label.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-hidden">
          <div className="h-full p-3 sm:p-4 lg:p-6">
            {activeTab === "launcher" ? (
              <div className="max-w-7xl mx-auto h-full flex flex-col">
                {/* Session header */}
                <div className="mb-4 sm:mb-6 flex-shrink-0">
                  <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
                        {roomId ? "Session Active - Choose a Feature" : "Choose an operation"}
                      </h2>
                      <p className="text-sm sm:text-base text-gray-600">
                        {roomId 
                          ? `Session ${roomId} is active. Click any feature below to start collaborating.`
                          : "Start a session to get a shareable link, or open a past session."
                        }
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
                      <button onClick={() => setShowSessionModal(true)} className="btn btn-primary text-sm sm:text-base px-3 sm:px-4 py-2 whitespace-nowrap">
                        <span className="hidden sm:inline">Start session</span>
                        <span className="sm:hidden">Start</span>
                      </button>
                      <button
                        onClick={handleCopyShare}
                        className="btn btn-secondary text-sm sm:text-base px-3 sm:px-4 py-2 whitespace-nowrap"
                        disabled={!roomId}
                        title={roomId ? "Copy share link" : "Start a session first"}
                      >
                        <span className="hidden sm:inline">Share link</span>
                        <span className="sm:hidden">Share</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Launcher grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-6 mb-6">
                  {tabs.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        if (!roomId) {
                          setToast("Please create a session or join an existing session first.");
                          setTimeout(() => setToast(""), 3000);
                          return;
                        }
                        setActiveTab(t.id);
                      }}
                      className={`card-modern p-3 sm:p-4 lg:p-6 text-left hover-scale transition-all ${
                        !roomId ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg'
                      }`}
                      disabled={!roomId}
                    >
                      <div className="text-lg sm:text-xl lg:text-2xl mb-2 sm:mb-3">{t.icon}</div>
                      <div className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900 mb-1 leading-tight">
                        {t.label}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-600 leading-tight">
                        {!roomId 
                          ? "Session required"
                          : `Open ${t.label.toLowerCase()}`
                        }
                      </div>
                    </button>
                  ))}
                </div>

                {/* Session requirement message */}
                {!roomId && (
                  <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex-shrink-0">
                    <div className="flex items-start">
                      <div className="text-yellow-400 text-base sm:text-lg mr-2 sm:mr-3 flex-shrink-0">⚠️</div>
                      <div className="min-w-0">
                        <h4 className="text-yellow-800 font-medium mb-1 text-sm sm:text-base">Session Required</h4>
                        <p className="text-yellow-700 text-xs sm:text-sm">
                          To access workspace features, create a new session or join an existing one from your previous sessions below.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Previous sessions */}
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4 gap-2 sm:gap-0 flex-shrink-0">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                      Previous sessions ({mySessions.length})
                    </h3>
                    {mySessions.length > 0 && (
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        {isSelectMode ? (
                          <>
                            <button
                              onClick={handleSelectAll}
                              className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 whitespace-nowrap"
                            >
                              {selectedSessions.size === mySessions.length ? "Deselect All" : "Select All"}
                            </button>
                            <button
                              onClick={handleDeleteSelected}
                              disabled={selectedSessions.size === 0}
                              className="btn btn-danger py-1 px-2 sm:px-3 text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            >
                              <span className="hidden sm:inline">Delete Selected ({selectedSessions.size})</span>
                              <span className="sm:hidden">Delete ({selectedSessions.size})</span>
                            </button>
                            <button
                              onClick={handleToggleSelectMode}
                              className="px-2 sm:px-4 py-1 sm:py-2 bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-lg shadow-sm transition-all duration-200 text-xs sm:text-sm whitespace-nowrap"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={handleToggleSelectMode}
                            className="px-2 sm:px-4 py-1 sm:py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg shadow-sm transition-all duration-200 text-xs sm:text-sm whitespace-nowrap"
                          >
                            <span className="hidden sm:inline">Manage Sessions</span>
                            <span className="sm:hidden">Manage</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    {mySessions.length === 0 ? (
                      <div className="text-sm sm:text-base text-gray-600 text-center py-8">
                        No previous sessions yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 pb-4">
                        {mySessions.map((s) => (
                          <div key={s.id} className={`card-modern p-3 sm:p-4 transition-all ${
                            isSelectMode && selectedSessions.has(s.id) ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                          }`}>
                            <div className="flex items-start gap-2 sm:gap-3">
                              {isSelectMode && (
                                <div className="pt-1 flex-shrink-0">
                                  <input
                                    type="checkbox"
                                    checked={selectedSessions.has(s.id)}
                                    onChange={() => handleSelectSession(s.id)}
                                    className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                  />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="text-sm sm:text-base text-gray-900 font-semibold truncate mb-1">
                                  {s.name}
                                </div>
                                <div className="text-xs sm:text-sm text-gray-500 break-all font-mono mb-1">
                                  {s.id}
                                </div>
                                {s.backendSessionId && (
                                  <div className="text-xs text-gray-400">
                                    Backend ID: {s.backendSessionId}
                                  </div>
                                )}
                                {s.expiresAt && (
                                  <div className="text-xs text-gray-400">
                                    Expires: {new Date(s.expiresAt).toLocaleString()}
                                  </div>
                                )}
                              </div>
                              {!isSelectMode && (
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button
                                    onClick={() => handleJoinExisting(s.id)}
                                    className="btn btn-secondary py-1 sm:py-1.5 text-xs sm:text-sm px-2 sm:px-3 whitespace-nowrap"
                                  >
                                    Join
                                  </button>
                                  <button
                                    onClick={async () => {
                                      const link = `${location.origin}/#workspace?room=${encodeURIComponent(s.id)}`;
                                      try {
                                        await navigator.clipboard.writeText(link);
                                        setToast("Link copied!");
                                        setTimeout(() => setToast(""), 2000);
                                      } catch {
                                        setToast("Failed to copy link.");
                                        setTimeout(() => setToast(""), 2000);
                                      }
                                    }}
                                    className="btn btn-glass py-1 sm:py-1.5 text-xs sm:text-sm px-2 sm:px-3 hidden sm:block"
                                    title="Copy link"
                                  >
                                    📋
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSingleSession(s.id)}
                                    className="btn btn-glass py-1 sm:py-1.5 text-xs sm:text-sm text-red-600 hover:text-red-800 hover:bg-red-50 px-2 sm:px-3"
                                    title="Delete session"
                                  >
                                    ×
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full">
                {ActiveComponent && roomId ? (
                  <ActiveComponent
                    roomId={roomId}
                    user={user}
                    mySessions={mySessions}
                    onJoinSession={handleJoinExisting}
                    onBackToLauncher={handleBackToLauncher}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center max-w-md mx-auto p-4 sm:p-8">
                      <div className="text-3xl sm:text-4xl mb-4">🚫</div>
                      <h3 className="text-lg sm:text-xl font-bold mb-3 text-gray-800">No Session Selected</h3>
                      <p className="text-sm sm:text-base text-gray-600 mb-4">
                        You need to create a session or join an existing session to access workspace features.
                      </p>
                      <button
                        onClick={handleBackToLauncher}
                        className="btn btn-primary"
                      >
                        Go to Launcher
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Session Modal */}
      <SessionModal
        isOpen={showSessionModal}
        onClose={() => setShowSessionModal(false)}
        onCreateSession={handleStartSession}
        user={user}
      />
    </div>
  );
}
