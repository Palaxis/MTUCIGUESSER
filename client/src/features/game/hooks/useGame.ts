import { useState, useEffect, useRef } from 'react'
import { gameApi, Floor, LocationForGame } from '../../../shared/api'

const TOTAL_ROUNDS = 5

export function useGame() {
  const [floors, setFloors] = useState<Floor[]>([])
  const [locations, setLocations] = useState<LocationForGame[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null)
  const [guess, setGuess] = useState<{ x: number; y: number } | null>(null)
  const [result, setResult] = useState<any>(null)
  const [showResult, setShowResult] = useState(false)
  const [round, setRound] = useState(1)
  const [totalScore, setTotalScore] = useState(0)
  const [mapZoom, setMapZoom] = useState(1)
  const [minZoom, setMinZoom] = useState(0.5)
  const [viewMode, setViewMode] = useState<'photo' | 'map'>('photo')
  const mapContainerRef = useRef<HTMLDivElement | null>(null)

  async function loadLocations() {
    try {
      const response = await gameApi.getRandomLocation()
      if (response.location) {
        setLocations([response.location])
        setCurrentIndex(0)
      }
    } catch (error) {
      console.error('Failed to load location:', error)
    }
  }

  useEffect(() => {
    gameApi.getFloors().then(setFloors)
    loadLocations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function calculateFitZoom() {
    if (!selectedFloor || floors.length === 0 || !mapContainerRef.current) return null

    const currentFloor = floors.find(f => f.id === selectedFloor)
    if (!currentFloor) return null

    const containerRect = mapContainerRef.current.getBoundingClientRect()
    const containerWidth = containerRect.width - 4
    const containerHeight = containerRect.height - 4

    if (containerWidth <= 0 || containerHeight <= 0) return null

    const scaleX = containerWidth / currentFloor.width_px
    const scaleY = containerHeight / currentFloor.height_px
    return Math.min(scaleX, scaleY)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      const fitZoom = calculateFitZoom()
      if (fitZoom !== null) {
        const calculatedMinZoom = Math.min(fitZoom, 1)
        setMinZoom(calculatedMinZoom)
        setMapZoom(fitZoom)
      }
    }, 50)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFloor, floors])

  useEffect(() => {
    const handleResize = () => {
      const fitZoom = calculateFitZoom()
      if (fitZoom !== null) {
        const calculatedMinZoom = Math.min(fitZoom, 1)
        setMinZoom(calculatedMinZoom)
        if (mapZoom < calculatedMinZoom) {
          setMapZoom(calculatedMinZoom)
        }
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFloor, floors, mapZoom])

  function nextLocation() {
    setShowResult(false)
    setGuess(null)
    setResult(null)
    setSelectedFloor(null)
    setMapZoom(1)
    setViewMode('photo')

    if (round >= TOTAL_ROUNDS) {
      return true // Игра завершена
    } else {
      setRound(round + 1)
      loadLocations()
      return false
    }
  }

  async function submitGuess() {
    if (!locations[currentIndex] || !guess || !selectedFloor) return null

    try {
      const response = await gameApi.submitGuess(
        locations[currentIndex].id,
        guess.x,
        guess.y,
        selectedFloor
      )

      setResult(response)
      setTotalScore(totalScore + response.score)
      setShowResult(true)
      return response
    } catch (error) {
      console.error('Failed to submit guess:', error)
      return null
    }
  }

  function resetGame() {
    setRound(1)
    setTotalScore(0)
    setGuess(null)
    setResult(null)
    setShowResult(false)
    setSelectedFloor(null)
    setMapZoom(1)
    setViewMode('photo')
    loadLocations()
  }

  return {
    // State
    floors,
    locations,
    currentIndex,
    selectedFloor,
    guess,
    result,
    showResult,
    round,
    totalRounds: TOTAL_ROUNDS,
    totalScore,
    mapZoom,
    minZoom,
    viewMode,
    mapContainerRef,
    // Actions
    setSelectedFloor,
    setGuess,
    setMapZoom,
    setViewMode,
    nextLocation,
    submitGuess,
    resetGame,
    loadLocations
  }
}

