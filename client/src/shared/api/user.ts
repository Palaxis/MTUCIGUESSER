import { apiClient } from './client'
import { User } from './auth'

export interface UpdateUserData {
  first_name?: string
  last_name?: string
  email?: string
  password?: string
}

export const userApi = {
  async update(userId: number, data: UpdateUserData): Promise<User> {
    const response = await apiClient.put<User>(`/api/users/${userId}`, data)
    return response.data
  },

  async uploadAvatar(userId: number, file: File): Promise<User> {
    const formData = new FormData()
    formData.append('avatar', file)
    const response = await apiClient.post<User>(`/api/users/${userId}/avatar`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
  }
}

