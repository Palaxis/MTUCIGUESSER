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
  }
}

