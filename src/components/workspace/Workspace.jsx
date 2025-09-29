import { useState } from "react";
import { VideoCall } from "./VideoCall";
import { DocEditor } from "./DocEditor";
import { Whiteboard } from "./Whiteboard";
import { TeamChat } from "./TeamChat";
import { TaskBoard } from "./TaskBoard";
import { useAuth } from "../../context/AuthContext";

export function Workspace({ roomId = "demo-room" }) {
  const [activeTab, setActiveTab] = useState("video");
  const { user, logout } = useAuth();

  const tabs = [
    { id: "video", label: "Video Call", icon: "🎥", component: VideoCall },
    { id: "docs", label: "Documents", icon: "📝", component: DocEditor },
    { id: "whiteboard", label: "Whiteboard", icon: "🎨", component: Whiteboard },
    { id: "tasks", label: "Tasks", icon: "📋", component: TaskBoard }
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;

  const handleBackToLanding = () => {
    window.location.hash = '';
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBackToLanding}
                className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
              >
                <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">C</span>
                </div>
                <span className="font-bold">CollabSpace</span>
              </button>
              <div className="text-gray-300">|</div>
              <h1 className="text-lg font-semibold text-gray-900">Workspace</h1>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 gradient-accent rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user?.name?.[0] || user?.email?.[0] || 'U'}
                  </span>
                </div>
                <span className="text-gray-700">{user?.name || user?.email}</span>
              </div>
              <button
                onClick={logout}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-4rem)]">
        {/* Main content */}
        <div className="flex-1 flex flex-col">
          {/* Tab navigation */}
          <div className="bg-white border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex space-x-8">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-lg">{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Active component */}
          <div className="flex-1 p-6">
            {ActiveComponent && (
              <ActiveComponent roomId={roomId} user={user} />
            )}
          </div>
        </div>

        {/* Chat sidebar */}
        <div className="w-80 border-l bg-white">
          <TeamChat roomId={roomId} user={user} />
        </div>
      </div>
    </div>
  );
}
