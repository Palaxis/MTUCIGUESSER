export interface GameState {
  round: number
  totalRounds: number
  totalScore: number
  currentLocation: any | null
  selectedFloor: number | null
  guess: { x: number; y: number } | null
  result: any | null
  showResult: boolean
  viewMode: 'photo' | 'map'
  mapZoom: number
  minZoom: number
}

export interface GameCompleteData {
  score: number
  rank?: number
  isNewRecord?: boolean
  previousBest?: number
}

