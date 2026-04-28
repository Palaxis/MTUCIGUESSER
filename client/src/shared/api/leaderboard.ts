import { apiClient } from './client'

export interface LeaderboardPlayer {
  user_id: number
  rank: number
  name: string
  score: number
}

export interface PaginatedLeaderboard {
  items: LeaderboardPlayer[]
  total: number
  page: number
  pageSize: number
}

export const leaderboardApi = {
  async getLeaderboard(params?: Record<string, unknown>): Promise<PaginatedLeaderboard> {
    const response = await apiClient.get<PaginatedLeaderboard>('/api/leaderboard', { params })
    return response.data
  }
}

