import { useState, useEffect } from 'react'
import { authApi, User } from '../api'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    try {
      const userData = await authApi.me()
      setUser(userData)
    } catch (error) {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  async function login(email: string, password: string) {
    const response = await authApi.login(email, password)
    setUser(response.user)
    return response.user
  }

  async function register(email: string, password: string, firstName: string, lastName: string) {
    const response = await authApi.register(email, password, firstName, lastName)
    setUser(response.user)
    return response.user
  }

  async function logout() {
    await authApi.logout()
    setUser(null)
  }

  function updateUser(userData: User) {
    setUser(userData)
  }

  return {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    checkAuth
  }
}

