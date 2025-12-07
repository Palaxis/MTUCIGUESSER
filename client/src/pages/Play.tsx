import React, { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import './Play.css'
import ResultPage from './ResultPage'
import ProfileMenu from '../components/ProfileMenu'

type Floor = {
  id: number
  name: string | null
  building: string | null
  level: string | null
  image_path: string
  width_px: number
  height_px: number
}

type LocationForGame = {
  id: number
  floor_id: number
  image_path: string
  hint: string | null
  correct_x: number
  correct_y: number
}

interface PlayProps {
  onGameComplete: (score: number, rank?: number, isNewRecord?: boolean, previousBest?: number) => void
  user: any
  onNavigateToAccount: () => void
  onLogout: () => void
}

export default function Play({ onGameComplete, user, onNavigateToAccount, onLogout }: PlayProps) {
  const [floors, setFloors] = useState<Floor[]>([])
  const [locations, setLocations] = useState<LocationForGame[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null)
  const [guess, setGuess] = useState<{x:number, y:number} | null>(null)
  const [result, setResult] = useState<any>(null)
  const [showResult, setShowResult] = useState(false)
  const [round, setRound] = useState(1)
  const [totalRounds] = useState(5)
  const [totalScore, setTotalScore] = useState(0)
  const [mapZoom, setMapZoom] = useState(1)
  const [minZoom, setMinZoom] = useState(0.5)
  const [viewMode, setViewMode] = useState<'photo' | 'map'>('photo')
  const mapRef = useRef<HTMLImageElement | null>(null)
  const photoRef = useRef<HTMLDivElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)

  useEffect(() => {
    axios.get('/api/floors').then(r => setFloors(r.data))
    loadLocations()
  }, [])

  // Автоматически подстраиваем зум когда выбран этаж
  useEffect(() => {
    if (selectedFloor && floors.length > 0) {
      const currentFloor = floors.find(f => f.id === selectedFloor)
      if (currentFloor) {
        // Размер контейнера карты (517x276)
        const containerWidth = 517
        const containerHeight = 276
        
        // Рассчитываем минимальный зум чтобы карта поместилась
        const scaleX = containerWidth / currentFloor.width_px
        const scaleY = containerHeight / currentFloor.height_px
        const calculatedMinZoom = Math.min(scaleX, scaleY, 1) // не больше 1
        
        setMinZoom(calculatedMinZoom)
        setMapZoom(calculatedMinZoom) // устанавливаем начальный зум
      }
    }
  }, [selectedFloor, floors])

  async function loadLocations() {
    try {
      const response = await axios.get('/api/locations/random')
      console.log('Location response:', response.data)
      // API возвращает объект с location и floor
      if (response.data.location) {
        setLocations([response.data.location])
        setCurrentIndex(0)
      } else {
        console.error('No location in response')
      }
    } catch (error) {
      console.error('Failed to load location:', error)
    }
  }

  function nextLocation() {
    setShowResult(false)
    setGuess(null)
    setResult(null)
    setSelectedFloor(null)
    setMapZoom(1)
    setViewMode('photo')

    if (round >= totalRounds) {
      // Игра завершена
      completeGame()
    } else {
      setRound(round + 1)
      loadLocations()
    }
  }

  async function completeGame() {
    // Сохраняем результат если пользователь авторизован
    if (user) {
      try {
        const response = await axios.post('/api/game-results', {
          user_id: user.id,
          total_score: totalScore,
          rounds_played: totalRounds
        })
        onGameComplete(totalScore, response.data.rank, response.data.isNewRecord, response.data.previousBest)
      } catch (error) {
        console.error('Failed to save game result:', error)
        onGameComplete(totalScore)
      }
    } else {
      onGameComplete(totalScore)
    }
  }

  function scrollPhotoLeft() {
    if (photoRef.current) {
      photoRef.current.scrollBy({
        left: -200,
        behavior: 'smooth'
      })
    }
  }

  function scrollPhotoRight() {
    if (photoRef.current) {
      photoRef.current.scrollBy({
        left: 200,
        behavior: 'smooth'
      })
    }
  }

  function handlePhotoMouseDown(e: React.MouseEvent) {
    if (!photoRef.current) return
    setIsDragging(true)
    setStartX(e.pageX - photoRef.current.offsetLeft)
    setScrollLeft(photoRef.current.scrollLeft)
  }

  function handlePhotoMouseMove(e: React.MouseEvent) {
    if (!isDragging || !photoRef.current) return
    e.preventDefault()
    const x = e.pageX - photoRef.current.offsetLeft
    const walk = (x - startX) * 2
    photoRef.current.scrollLeft = scrollLeft - walk
  }

  function handlePhotoMouseUp() {
    setIsDragging(false)
  }

  function handlePhotoMouseLeave() {
    setIsDragging(false)
  }

  function onMapClick(e: React.MouseEvent<HTMLImageElement>) {
    if (!selectedFloor || !mapRef.current) return
    const currentFloor = floors.find(f => f.id === selectedFloor)
    if (!currentFloor) return

    const rect = mapRef.current.getBoundingClientRect()
    const x = Math.round((e.clientX - rect.left) * (currentFloor.width_px / rect.width))
    const y = Math.round((e.clientY - rect.top) * (currentFloor.height_px / rect.height))
    
    console.log('Click coordinates:', { x, y, zoom: mapZoom })
    setGuess({ x, y })
  }

  async function submitGuess() {
    if (!locations[currentIndex] || !guess || !selectedFloor) return
    
    try {
      const response = await axios.post('/api/guess', {
        location_id: locations[currentIndex].id,
        guess_x: guess.x,
        guess_y: guess.y,
        selected_floor: selectedFloor
      })
      
      setResult(response.data)
      setTotalScore(totalScore + response.data.score)
      setShowResult(true)
    } catch (error) {
      console.error('Failed to submit guess:', error)
    }
  }

  const currentLocation = locations[currentIndex]
  const currentFloor = selectedFloor ? floors.find(f => f.id === selectedFloor) : null

  if (showResult && result && currentLocation && currentFloor) {
    return (
      <ResultPage
        score={result.score}
        maxScore={100}
        floorImage={currentFloor.image_path}
        correctX={result.correct_x}
        correctY={result.correct_y}
        guessX={guess!.x}
        guessY={guess!.y}
        floorWidth={currentFloor.width_px}
        floorHeight={currentFloor.height_px}
        onNext={nextLocation}
      />
    )
  }

  return (
    <div className="play-page">
      <header className="play-header">
        <div className="play-logo">
          <img src="/mtuci-logo-white.svg" alt="MTUCI" className="play-logo-icon" />
          <h1 className="play-logo-text">MTUCI Guesser</h1>
        </div>
        {user ? (
          <ProfileMenu 
            onNavigateToAccount={onNavigateToAccount}
            onLogout={onLogout}
          />
        ) : (
          <button className="play-profile-btn">
            <svg width="25" height="25" viewBox="0 0 25 25" fill="none">
              <circle cx="12.5" cy="8" r="4" stroke="white" strokeWidth="2"/>
              <path d="M5 20C5 16 8 13 12.5 13C17 13 20 16 20 20" stroke="white" strokeWidth="2"/>
            </svg>
          </button>
        )}
      </header>

      <div className="play-round-indicator">
        Раунд {round} из {totalRounds}
      </div>

      {viewMode === 'photo' ? (
        <div className="play-content play-content-photo">
          <div className="play-photo-wrapper">
            <button className="play-arrow play-arrow-left" onClick={scrollPhotoLeft}>
              <svg width="80" height="80" viewBox="0 0 80 80">
                <path d="M50 20L25 40L50 60" stroke="#372579" strokeWidth="3" fill="none"/>
              </svg>
            </button>
            
            <div 
              className="play-photo-container play-photo-big" 
              ref={photoRef}
              onMouseDown={handlePhotoMouseDown}
              onMouseMove={handlePhotoMouseMove}
              onMouseUp={handlePhotoMouseUp}
              onMouseLeave={handlePhotoMouseLeave}
            >
              {currentLocation && (
                <img 
                  className="play-photo" 
                  src={currentLocation.image_path} 
                  alt="Найди это место"
                />
              )}
            </div>

            <button className="play-arrow play-arrow-right" onClick={scrollPhotoRight}>
              <svg width="80" height="80" viewBox="0 0 80 80">
                <path d="M30 20L55 40L30 60" stroke="#372579" strokeWidth="3" fill="none"/>
              </svg>
            </button>
          </div>

          <button 
            className="play-ready-btn"
            onClick={() => setViewMode('map')}
          >
            Готово
          </button>
        </div>
      ) : (
        <div className="play-content play-content-map">
          <h2 className="play-question">Где это?</h2>

          <div className="play-map-layout">
            <div className="play-map-section">
              <h3 className="play-map-title">Найди точку на карте</h3>
              
              <div className="play-map-container">
                {currentFloor ? (
                  <div className="play-map-inner">
                    <div className="play-map-wrapper" style={{ 
                      width: `${currentFloor.width_px * mapZoom}px`,
                      height: `${currentFloor.height_px * mapZoom}px`,
                      position: 'relative'
                    }}>
                      <img
                        ref={mapRef}
                        className="play-map"
                        src={currentFloor.image_path}
                        alt="Карта этажа"
                        onClick={onMapClick}
                        style={{ 
                          width: '100%',
                          height: '100%'
                        }}
                      />
                      {guess && (
                        <div
                          className="play-pin play-pin-guess"
                          style={{ 
                            left: `${(guess.x / currentFloor.width_px) * 100}%`, 
                            top: `${(guess.y / currentFloor.height_px) * 100}%` 
                          }}
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="play-map-placeholder">
                    Выберите этаж
                  </div>
                )}

                <div className="play-zoom-controls">
                  <button 
                    className="play-zoom-btn" 
                    onClick={() => setMapZoom(Math.min(mapZoom + 0.2, 3))}
                    title="Увеличить (макс. 3x)"
                  >
                    <span className="play-zoom-icon">+</span>
                  </button>
                  <button 
                    className="play-zoom-btn" 
                    onClick={() => setMapZoom(Math.max(mapZoom - 0.2, minZoom))}
                    disabled={mapZoom <= minZoom}
                    title="Уменьшить"
                  >
                    <span className="play-zoom-icon">−</span>
                  </button>
                  <button 
                    className="play-zoom-btn play-zoom-reset" 
                    onClick={() => setMapZoom(minZoom)}
                    title="Вернуть к начальному масштабу"
                  >
                    <span className="play-zoom-icon">◻</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="play-sidebar">
              <div className="play-photo-preview">
                {currentLocation && (
                  <>
                    <img 
                      className="play-photo-small" 
                      src={currentLocation.image_path} 
                      alt="Превью"
                    />
                    <button 
                      className="play-fullscreen-btn"
                      onClick={() => setViewMode('photo')}
                      title="Открыть фото в полноэкранном режиме"
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M2 2L8 8M18 2L12 8M2 18L8 12M18 18L12 12" stroke="#372579" strokeWidth="2"/>
                        <rect x="1" y="1" width="18" height="18" stroke="#372579" strokeWidth="2" fill="none"/>
                      </svg>
                    </button>
                  </>
                )}
              </div>

              <div className="play-floor-selection">
                <h3 className="play-floor-title">Выбери этаж</h3>
                
                {[...floors]
                  .sort((a, b) => {
                    const levelA = parseInt(a.level || '0')
                    const levelB = parseInt(b.level || '0')
                    return levelA - levelB
                  })
                  .slice(0, 5)
                  .map((floor, idx) => (
                  <label key={floor.id} className="play-floor-option">
                    <input
                      type="radio"
                      name="floor"
                      className="play-floor-radio"
                      checked={selectedFloor === floor.id}
                      onChange={() => setSelectedFloor(floor.id)}
                    />
                    <span className="play-floor-label">
                      {floor.level || `${idx + 1} этаж`}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <button 
            className="play-submit-btn" 
            onClick={submitGuess}
            disabled={!guess || !selectedFloor}
          >
            Ответить
          </button>
        </div>
      )}
    </div>
  )
}
