import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, ApiError } from '@/lib/api'
import type { User } from '@/lib/types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const me = await api.get<User>('/api/auth/me', { redirectOn401: false })
      setUser(me)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setUser(null)
      }
      // 网络错误时保持现状，避免误踢登录态
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout', undefined, { redirectOn401: false })
    } finally {
      setUser(null)
      window.location.href = '/'
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
