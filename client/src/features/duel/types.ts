export interface DuelPlayer {
  odId: string
  name: string
  avatar_url: string | null
  hp: number
}

export interface DuelRoundData {
  round: number
  totalRounds: number
  location: {
    id: number
    floor_id: number
    image_path: string
    hint: string | null
  }
  floor: {
    id: number
    name: string | null
    building: string | null
    level: string | null
    image_path: string
    width_px: number
    height_px: number
  }
  photoTime: number
  guessTime: number
  players: Record<string, { hp: number; name: string; avatar_url: string | null }>
}

export interface DuelPlayerResult {
  name: string
  avatar_url: string | null
  score: number
  guess_x?: number
  guess_y?: number
  selected_floor?: number
  damage: number
  oldHp: number
  hp: number
  auto: boolean
}

export interface DuelRoundResult {
  round: number
  location: {
    correct_x: number
    correct_y: number
    floor_id: number
  }
  floor: {
    id: number
    name: string | null
    image_path: string
    width_px: number
    height_px: number
  }
  players: Record<string, DuelPlayerResult>
}

export interface DuelGameOver {
  winnerId: string
  winner: { name: string; odId: string; avatar_url: string | null; hp: number }
  loser: { name: string; odId: string; avatar_url: string | null; hp: number }
}

export type DuelPhase = 
  | 'lobby' 
  | 'waiting' 
  | 'starting' 
  | 'photo' 
  | 'guessing' 
  | 'round-result' 
  | 'game-over'
