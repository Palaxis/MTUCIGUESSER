import { apiClient } from './client'

export interface Floor {
  id: number
  name: string | null
  building: string | null
  level: string | null
  image_path: string
  width_px: number
  height_px: number
}

export interface LocationForGame {
  id: number
  floor_id: number
  image_path: string
  hint: string | null
  correct_x: number
  correct_y: number
}

export interface GuessResult {
  score: number
  correct_x: number
  correct_y: number
}

export interface GameResult {
  rank?: number
  isNewRecord?: boolean
  previousBest?: number
}

export const gameApi = {
  async getFloors(): Promise<Floor[]> {
    const response = await apiClient.get<Floor[]>('/api/floors')
    return response.data
  },

  async getRandomLocation(): Promise<{ location: LocationForGame }> {
    const response = await apiClient.get<{ location: LocationForGame }>('/api/locations/random')
    return response.data
  },

  async submitGuess(
    locationId: number,
    guessX: number,
    guessY: number,
    selectedFloor: number
  ): Promise<GuessResult> {
    const response = await apiClient.post<GuessResult>('/api/guess', {
      location_id: locationId,
      guess_x: guessX,
      guess_y: guessY,
      selected_floor: selectedFloor
    })
    return response.data
  },

  async saveGameResult(
    userId: number,
    totalScore: number,
    roundsPlayed: number
  ): Promise<GameResult> {
    const response = await apiClient.post<GameResult>('/api/game-results', {
      user_id: userId,
      total_score: totalScore,
      rounds_played: roundsPlayed
    })
    return response.data
  }
}

