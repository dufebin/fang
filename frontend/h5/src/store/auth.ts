import { create } from 'zustand'

interface AuthState {
  token: string | null
  role: string | null
  userId: number | null
  setAuth: (token: string, role: string, userId: number) => void
  logout: () => void
  isLoggedIn: () => boolean
  isAgent: () => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('token'),
  role: localStorage.getItem('role'),
  userId: Number(localStorage.getItem('userId')) || null,

  setAuth: (token, role, userId) => {
    localStorage.setItem('token', token)
    localStorage.setItem('role', role)
    localStorage.setItem('userId', String(userId))
    set({ token, role, userId })
  },

  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('userId')
    set({ token: null, role: null, userId: null })
  },

  isLoggedIn: () => !!get().token,
  isAgent: () => get().role === 'agent' || get().role === 'admin',
}))
