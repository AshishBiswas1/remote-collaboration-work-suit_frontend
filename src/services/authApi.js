const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/collab/user`;

export const authAPI = {
  signup: (data) => fetch(`${API_BASE}/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      name: data.name,
      email: data.email,
      password: data.password,
      passwordConfirm: data.passwordConfirm
    })
  }),
  
  login: (data) => fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  }),
  
  logout: () => fetch(`${API_BASE}/logout`, {
    method: 'POST',
    credentials: 'include'
  }),
  
  getProfile: (token) => fetch(`${API_BASE}/profile`, {
    headers: { 'Authorization': `Bearer ${token}` },
    credentials: 'include'
  })
};