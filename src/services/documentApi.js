const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/collab/document`;

export const documentAPI = {
  createSession: (data) => fetch(`${API_BASE}/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  }),
  
  joinSession: (sessionId) => fetch(`${API_BASE}/join/${sessionId}`, {
    method: 'POST',
    credentials: 'include'
  }),
  
  getSession: (sessionId) => fetch(`${API_BASE}/${sessionId}`, {
    credentials: 'include'
  })
};
