import { apiClient } from './client'

export interface LeaderboardPlayer {
  rank: number
  name: string
  score: number
}

export const leaderboardApi = {
  async getLeaderboard(): Promise<LeaderboardPlayer[]> {
    const response = await apiClient.get<LeaderboardPlayer[]>('/api/leaderboard')
    return response.data
  }
}

