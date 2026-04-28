import { useState, useEffect } from 'react'
import { authApi, User } from '../api'
import { clearAccessToken, setAccessToken } from '../api/client'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
    const onSessionExpired = () => {
      setUser(null)
      clearAccessToken()
    }
    window.addEventListener('auth:session-expired', onSessionExpired)
    return () => window.removeEventListener('auth:session-expired', onSessionExpired)
  }, [])

  async function checkAuth() {
    try {
      const userData = await authApi.me()
      setUser(userData)
    } catch (error) {
      setUser(null)
      clearAccessToken()
    } finally {
      setLoading(false)
    }
  }

  async function login(email: string, password: string) {
    const response = await authApi.login(email, password)
    setAccessToken(response.accessToken)
    setUser(response.user)
    return response.user
  }

  async function register(email: string, password: string, firstName: string, lastName: string) {
    const response = await authApi.register(email, password, firstName, lastName)
    setAccessToken(response.accessToken)
    setUser(response.user)
    return response.user
  }

  async function logout() {
    await authApi.logout()
    clearAccessToken()
    setUser(null)
  }

  function updateUser(userData: User) {
    setUser(userData)
  }

  function can(permission: string) {
    return Boolean(user?.permissions?.includes(permission))
  }

  function hasRole(role: string) {
    return Boolean(user?.roles?.includes(role))
  }

  return {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    checkAuth,
    can,
    hasRole
  }
}

