const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/collab/session`;

export const sessionAPI = {
  createSession: (data) => fetch(`${API_BASE}/chat/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  }),
  
  getSession: (sessionId) => fetch(`${API_BASE}/${sessionId}`, {
    credentials: 'include'
  }),
  
  joinSession: (sessionId) => fetch(`${API_BASE}/join/${sessionId}`, {
    method: 'POST',
    credentials: 'include'
  })
};