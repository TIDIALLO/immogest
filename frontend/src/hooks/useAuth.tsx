import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'

import { api, ApiError } from '@/lib/api'
import type { Me } from '@/lib/types'

interface AuthContextValue {
  user: Me | null
  loading: boolean
  login: (username: string, password: string) => Promise<Me>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['/me'],
    queryFn: async () => {
      await api.ensureCsrf()
      try {
        return await api.get<Me>('/me/')
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return null
        throw error
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  })

  // Vide le cache des données métier sans détacher la requête /me observée par ce provider.
  const resetData = useCallback(() => {
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== '/me' })
  }, [qc])

  const login = useCallback(
    async (username: string, password: string) => {
      const me = await api.post<Me>('/auth/login/', { username, password })
      await api.ensureCsrf() // le jeton CSRF change après la connexion
      resetData()
      qc.setQueryData(['/me'], me)
      return me
    },
    [qc, resetData],
  )

  const logout = useCallback(async () => {
    await api.post('/auth/logout/')
    resetData()
    qc.setQueryData(['/me'], null)
    await api.ensureCsrf()
  }, [qc, resetData])

  const value = useMemo(
    () => ({ user: data ?? null, loading: isLoading, login, logout }),
    [data, isLoading, login, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}
