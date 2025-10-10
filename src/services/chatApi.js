const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/collab/chat`;

export const chatAPI = {
  // Health check endpoint for WebSocket
  getHealth: async () => {
    try {
      const response = await fetch(`${API_BASE}/health`, {
        credentials: 'include'
      });
      return await response.json();
    } catch (error) {
      console.error('Error fetching chat health:', error);
      return { status: 'error', error: error.message };
    }
  },

  // Get room info endpoint
  getRoomInfo: async (roomId) => {
    try {
      const response = await fetch(`${API_BASE}/room/${roomId}`, {
        credentials: 'include'
      });
      return await response.json();
    } catch (error) {
      console.error('Error fetching room info:', error);
      return { roomId, userCount: 0, messageCount: 0, users: [] };
    }
  }
};
