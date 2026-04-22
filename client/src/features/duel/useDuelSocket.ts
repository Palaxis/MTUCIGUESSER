import { useState, useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import type { DuelPhase, DuelRoundData, DuelRoundResult, DuelGameOver } from './types'

// Автоматически определяем URL сервера на основе текущего хоста
const getServerUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  const { protocol, hostname } = window.location
  return `${protocol}//${hostname}:3001`
}

const SERVER_URL = getServerUrl()

export function useDuelSocket(user: any) {
  const socketRef = useRef<Socket | null>(null)
  const [phase, setPhase] = useState<DuelPhase>('lobby')
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [myId, setMyId] = useState<string | null>(null)
  const [players, setPlayers] = useState<any[]>([])
  const [roundData, setRoundData] = useState<DuelRoundData | null>(null)
  const [roundResult, setRoundResult] = useState<DuelRoundResult | null>(null)
  const [gameOver, setGameOver] = useState<DuelGameOver | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [guessReceived, setGuessReceived] = useState(false)

  useEffect(() => {
    const socket = io(SERVER_URL, { transports: ['websocket'] })
    socketRef.current = socket

    socket.on('connect', () => {
      setMyId(socket.id || null)
    })

    socket.on('room-created', (data) => {
      setRoomCode(data.roomCode)
      setPhase('waiting')
    })

    socket.on('player-joined', (data) => {
      setRoomCode(data.roomCode)
      setPlayers(data.players)
    })

    socket.on('duel-starting', (data) => {
      setPhase('starting')
      setCountdown(data.countdown)
      let c = data.countdown
      const interval = setInterval(() => {
        c--
        setCountdown(c)
        if (c <= 0) clearInterval(interval)
      }, 1000)
    })

    socket.on('duel-round-start', (data: DuelRoundData) => {
      setRoundData(data)
      setRoundResult(null)
      setGuessReceived(false)
      setPhase('photo')
    })

    socket.on('duel-photo-time-up', () => {
      setPhase('guessing')
    })

    socket.on('duel-guess-received', () => {
      setGuessReceived(true)
    })

    socket.on('duel-round-result', (data: DuelRoundResult) => {
      setRoundResult(data)
      setPhase('round-result')
    })

    socket.on('duel-game-over', (data: DuelGameOver) => {
      setGameOver(data)
      setPhase('game-over')
    })

    socket.on('duel-error', (data) => {
      setError(data.message)
    })

    socket.on('opponent-disconnected', (data) => {
      setError(data.message)
      setPhase('lobby')
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  const createRoom = useCallback(() => {
    if (!socketRef.current || !user) return
    setError(null)
    socketRef.current.emit('create-room', {
      userId: user.id,
      name: `${user.first_name} ${user.last_name}`,
      avatar_url: user.avatar_url || null
    })
  }, [user])

  const joinRoom = useCallback((code: string) => {
    if (!socketRef.current || !user) return
    setError(null)
    setRoomCode(code)
    socketRef.current.emit('join-room', {
      roomCode: code,
      userId: user.id,
      name: `${user.first_name} ${user.last_name}`,
      avatar_url: user.avatar_url || null
    })
  }, [user])

  const submitGuess = useCallback((guessX: number, guessY: number, selectedFloor: number) => {
    if (!socketRef.current || !roomCode) return
    socketRef.current.emit('submit-duel-guess', {
      roomCode,
      guess_x: guessX,
      guess_y: guessY,
      selected_floor: selectedFloor
    })
  }, [roomCode])

  const leaveRoom = useCallback(() => {
    if (!socketRef.current) return
    socketRef.current.emit('leave-room')
    setPhase('lobby')
    setRoomCode(null)
    setPlayers([])
    setRoundData(null)
    setRoundResult(null)
    setGameOver(null)
    setError(null)
    setGuessReceived(false)
  }, [])

  const resetDuel = useCallback(() => {
    leaveRoom()
  }, [leaveRoom])

  return {
    phase,
    roomCode,
    myId,
    players,
    roundData,
    roundResult,
    gameOver,
    error,
    countdown,
    guessReceived,
    createRoom,
    joinRoom,
    submitGuess,
    leaveRoom,
    resetDuel,
    setError
  }
}
