import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";

function loadJSON(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } }
function saveJSON(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
function tasksKey(userId, roomId) { return `cs:tasks:${userId || "anon"}:room:${roomId || "none"}`; }
const defaultBoard = () => ([
  { id: "todo", name: "To do", items: [] },
  { id: "doing", name: "In progress", items: [] },
  { id: "done", name: "Done", items: [] },
]);

export function TaskBoard({ roomId, user, mySessions = [], onJoinSession, onBackToLauncher }) {
  const userId = user?.id || "anon";
  const [viewRoom, setViewRoom] = useState(roomId);
  const [board, setBoard] = useState(() => loadJSON(tasksKey(userId, viewRoom), defaultBoard()));
  const [title, setTitle] = useState("");
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  const displayName = user?.name || user?.email || "Anonymous User";

  useEffect(() => setViewRoom(roomId), [roomId]);
  useEffect(() => setBoard(loadJSON(tasksKey(userId, viewRoom), defaultBoard())), [userId, viewRoom]);
  useEffect(() => saveJSON(tasksKey(userId, viewRoom), board), [board, userId, viewRoom]);

  // Socket.IO connection for real-time task board updates
  useEffect(() => {
    if (!viewRoom) {
      // Disconnect if no room
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
        setOnlineUsers(new Set());
      }
      return;
    }

    // Connect to Socket.IO server for task board
    const socket = io("ws://localhost:3001", {
      query: {
        roomId: `taskboard-${viewRoom}`,
        userId: userId,
        userName: displayName,
      },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("join-taskboard", { 
        roomId: `taskboard-${viewRoom}`, 
        userId, 
        userName: displayName,
        currentBoard: board 
      });
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      setOnlineUsers(new Set());
    });

    socket.on("user-joined", ({ userId: joinedUserId, userName }) => {
      setOnlineUsers(prev => new Set([...prev, `${joinedUserId}:${userName}`]));
    });

    socket.on("user-left", ({ userId: leftUserId }) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        for (const user of newSet) {
          if (user.startsWith(`${leftUserId}:`)) {
            newSet.delete(user);
            break;
          }
        }
        return newSet;
      });
    });

    socket.on("online-users", (users) => {
      setOnlineUsers(new Set(users.map(u => `${u.userId}:${u.userName}`)));
    });

    socket.on("board-updated", (newBoard) => {
      setBoard(newBoard);
      saveJSON(tasksKey(userId, viewRoom), newBoard);
    });

    socket.on("task-added", ({ columnId, task }) => {
      setBoard(prev => {
        const newBoard = prev.map(col => 
          col.id === columnId 
            ? { ...col, items: [...col.items, task] }
            : col
        );
        saveJSON(tasksKey(userId, viewRoom), newBoard);
        return newBoard;
      });
    });

    socket.on("task-moved", ({ taskId, fromColumnId, toColumnId, newIndex }) => {
      setBoard(prev => {
        const newBoard = [...prev];
        const fromColumn = newBoard.find(col => col.id === fromColumnId);
        const toColumn = newBoard.find(col => col.id === toColumnId);
        
        if (fromColumn && toColumn) {
          const taskIndex = fromColumn.items.findIndex(item => item.id === taskId);
          if (taskIndex !== -1) {
            const [task] = fromColumn.items.splice(taskIndex, 1);
            toColumn.items.splice(newIndex, 0, task);
          }
        }
        
        saveJSON(tasksKey(userId, viewRoom), newBoard);
        return newBoard;
      });
    });

    return () => {
      socket.disconnect();
      setIsConnected(false);
      setOnlineUsers(new Set());
    };
  }, [viewRoom, userId, displayName]);

  const addCard = (colId) => {
    if (!title.trim() || !viewRoom) return;
    
    const newTask = { 
      id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, 
      text: title.trim(),
      createdBy: displayName,
      createdAt: Date.now()
    };

    // If connected to Socket.IO, emit the task addition
    if (socketRef.current && isConnected) {
      socketRef.current.emit("add-task", { columnId: colId, task: newTask });
    } else {
      // Fallback to local update
      setBoard((prev) =>
        prev.map((c) =>
          c.id === colId ? { ...c, items: [newTask, ...c.items] } : c
        )
      );
    }
    
    setTitle("");
  };

  const moveCard = (fromId, toId, card) => {
    if (fromId === toId || !viewRoom) return;
    
    const toColumn = board.find(c => c.id === toId);
    const newIndex = 0; // Add to beginning of target column

    // If connected to Socket.IO, emit the move
    if (socketRef.current && isConnected) {
      socketRef.current.emit("move-task", { 
        taskId: card.id, 
        fromColumnId: fromId, 
        toColumnId: toId, 
        newIndex 
      });
    } else {
      // Fallback to local update
      setBoard((prev) => {
        const removed = prev.map((c) =>
          c.id === fromId ? { ...c, items: c.items.filter((i) => i.id !== card.id) } : c
        );
        return removed.map((c) =>
          c.id === toId ? { ...c, items: [card, ...c.items] } : c
        );
      });
    }
  };

  const removeCard = (colId, cardId) => {
    if (!viewRoom) return;

    // If connected to Socket.IO, emit the removal
    if (socketRef.current && isConnected) {
      socketRef.current.emit("remove-task", { columnId: colId, taskId: cardId });
    } else {
      // Fallback to local update
      setBoard((prev) =>
        prev.map((c) =>
          c.id === colId ? { ...c, items: c.items.filter((i) => i.id !== cardId) } : c
        )
      );
    }
  };

  return (
    <div className="h-full w-full bg-[#0f1115] text-white rounded-2xl overflow-hidden flex flex-col" style={{ minHeight: '600px' }}>
      <div className="h-14 px-4 flex items-center justify-between bg-black/30 backdrop-blur border-b border-white/10">
        <div className="flex items-center space-x-2">
          <div className="font-semibold">Task Board</div>
          {viewRoom && (
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-xs text-white/70">
                {isConnected ? 'Synced' : 'Offline'}
              </span>
              {onlineUsers.size > 0 && (
                <span className="text-xs text-white/70">
                  • {onlineUsers.size} collaborating
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button 
            className="btn btn-glass py-2 text-red-400 hover:text-red-300" 
            onClick={onBackToLauncher}
          >
            Leave Session
          </button>
        </div>
      </div>

      {/* Online collaborators indicator */}
      {viewRoom && onlineUsers.size > 0 && (
        <div className="px-4 py-2 bg-blue-900/30 border-b border-white/10">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-white/70">Collaborating:</span>
            <div className="flex space-x-1 flex-wrap">
              {Array.from(onlineUsers).map((user, index) => {
                const [, userName] = user.split(':');
                return (
                  <span
                    key={index}
                    className="px-2 py-1 bg-purple-600/20 text-purple-300 text-xs rounded-full"
                  >
                    {userName}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="p-4 flex items-center space-x-2">
        <input 
          className="input-modern flex-1 bg-white text-gray-900 placeholder-gray-500 border border-gray-300" 
          placeholder={viewRoom ? "Task title…" : "Select a session first"} 
          value={title} 
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCard("todo")}
          disabled={!viewRoom}
        />
        <button 
          className="btn btn-primary py-2" 
          onClick={() => addCard("todo")}
          disabled={!title.trim() || !viewRoom}
        >
          Add Task
        </button>
      </div>

      {!viewRoom ? (
        <div className="flex-1 flex items-center justify-center text-white/60">
          <div className="text-center">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold mb-2">Select a session to manage tasks</h3>
            <p>Choose an active session from the dropdown above to start collaborating on tasks.</p>
          </div>
        </div>
      ) : (
        <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 overflow-auto">
          {board.map((col) => (
            <div key={col.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">{col.name}</div>
                <span className="text-xs text-white/70">{col.items.length} task{col.items.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-2 flex-1">
                {col.items.length === 0 && (
                  <div className="text-white/60 text-sm text-center py-8">
                    No tasks in {col.name.toLowerCase()}
                  </div>
                )}
                {col.items.map((item) => (
                  <div key={item.id} className="bg-white/10 rounded-xl p-3">
                    <div className="mb-2">{item.text}</div>
                    {item.createdBy && (
                      <div className="text-xs text-white/50 mb-2">
                        by {item.createdBy}
                        {item.createdAt && ` • ${new Date(item.createdAt).toLocaleDateString()}`}
                      </div>
                    )}
                    <div className="flex items-center flex-wrap gap-2 text-xs">
                      {["todo","doing","done"].filter(x => x !== col.id).map(target => (
                        <button 
                          key={target} 
                          className="btn btn-glass py-1" 
                          onClick={() => moveCard(col.id, target, item)}
                        >
                          → {target === "todo" ? "To Do" : target === "doing" ? "In Progress" : "Done"}
                        </button>
                      ))}
                      <button 
                        className="btn btn-glass py-1 text-red-400" 
                        onClick={() => removeCard(col.id, item.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isConnected && viewRoom && (
        <div className="px-4 pb-2">
          <div className="text-xs text-yellow-400">
            Note: Real-time collaboration requires a Socket.IO server. Changes will be stored locally.
          </div>
        </div>
      )}
    </div>
  );
}
