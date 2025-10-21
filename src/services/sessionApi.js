const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/collab/session`;

// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const sessionAPI = {
  createSession: (data) => fetch(`${API_BASE}/chat/create`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(data)
  }),
  
  getSession: (sessionId) => {
    const token = localStorage.getItem('token');
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(`${API_BASE}/${sessionId}`, {
      headers,
      credentials: 'include'
    });
  },
  
  joinSession: (sessionId) => {
    const token = localStorage.getItem('token');
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(`${API_BASE}/join/${sessionId}`, {
      method: 'POST',
      headers,
      credentials: 'include'
    });
  },

  generateShareLink: (sessionId, options = {}) => fetch(`${API_BASE}/${sessionId}/generate-link`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(options)
  }),

  joinSessionByLink: (sessionId, invitation) => {
    const token = localStorage.getItem('token');
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(`${API_BASE}/${sessionId}/join?invitation=${encodeURIComponent(invitation)}`, {
      method: 'GET',
      headers,
      credentials: 'include'
    });
  }
};