import { apiClient } from './client'

export interface User {
  id: number
  first_name: string
  last_name: string
  email: string
}

export const authApi = {
  async me(): Promise<User> {
    const response = await apiClient.get<User>('/api/auth/me')
    return response.data
  },

  async login(email: string, password: string): Promise<{ user: User }> {
    const response = await apiClient.post<{ user: User }>('/api/auth/login', { email, password })
    return response.data
  },

  async register(
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ): Promise<{ user: User }> {
    const response = await apiClient.post<{ user: User }>('/api/auth/register', {
      email,
      password,
      first_name: firstName,
      last_name: lastName
    })
    return response.data
  },

  async logout(): Promise<void> {
    await apiClient.post('/api/auth/logout')
  }
}

