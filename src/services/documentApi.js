const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/collab/document`;

// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const documentAPI = {
  createSession: (data) => fetch(`${API_BASE}/create`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(data)
  }),
  
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
  }
};
