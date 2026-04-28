import React, { useRef, useState } from 'react'
import './Play.css'
import ResultPage from './ResultPage'
import { ProfileMenu } from '../shared/ui'
import { useGame } from '../features/game/hooks'
import { gameApi } from '../shared/api'
import PanoramaViewer from '../components/PanoramaViewer'

interface PlayProps {
  onGameComplete: (score: number, rank?: number, isNewRecord?: boolean, previousBest?: number) => void
  user: any
  onNavigateToHome: () => void
  onNavigateToAccount: () => void
  onLogout: () => void
  mode?: 'classic' | '360'
}

export default function Play({ onGameComplete, user, onNavigateToHome, onNavigateToAccount, onLogout, mode = 'classic' }: PlayProps) {
  const game = useGame(mode)
  const {
    floors,
    locations,
    currentIndex,
    selectedFloor,
    guess,
    result,
    showResult,
    round,
    totalRounds,
    totalScore,
    mapZoom,
    minZoom,
    viewMode,
    mapContainerRef,
    setSelectedFloor,
    setGuess,
    setMapZoom,
    setViewMode,
    nextLocation: gameNextLocation,
    submitGuess: gameSubmitGuess
  } = game

  const mapRef = useRef<HTMLImageElement | null>(null)
  const photoRef = useRef<HTMLDivElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)

  async function nextLocation() {
    const isComplete = gameNextLocation()
    if (isComplete) {
      await completeGame()
    }
  }

  async function completeGame() {
    if (user) {
      try {
        const response = await gameApi.saveGameResult(user.id, totalScore, totalRounds)
        onGameComplete(totalScore, response.rank, response.isNewRecord, response.previousBest)
      } catch (error) {
        console.error('Failed to save game result:', error)
        onGameComplete(totalScore)
      }
    } else {
      onGameComplete(totalScore)
    }
  }

  async function submitGuess() {
    await gameSubmitGuess()
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

  // Touch events for photo scrolling
  function handlePhotoTouchStart(e: React.TouchEvent) {
    if (!photoRef.current) return
    const touch = e.touches[0]
    setIsDragging(true)
    setStartX(touch.pageX - photoRef.current.offsetLeft)
    setScrollLeft(photoRef.current.scrollLeft)
  }

  function handlePhotoTouchMove(e: React.TouchEvent) {
    if (!isDragging || !photoRef.current) return
    const touch = e.touches[0]
    const x = touch.pageX - photoRef.current.offsetLeft
    const walk = (x - startX) * 1.5
    photoRef.current.scrollLeft = scrollLeft - walk
  }

  function handlePhotoTouchEnd() {
    setIsDragging(false)
  }

  // Touch handling for map - distinguish tap from scroll
  const mapTouchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)

  function onMapTouchStart(e: React.TouchEvent) {
    const touch = e.touches[0]
    mapTouchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    }
  }

  function onMapTouchEnd(e: React.TouchEvent) {
    if (!mapTouchStartRef.current || !selectedFloor) return
    
    const touch = e.changedTouches[0]
    const deltaX = Math.abs(touch.clientX - mapTouchStartRef.current.x)
    const deltaY = Math.abs(touch.clientY - mapTouchStartRef.current.y)
    const deltaTime = Date.now() - mapTouchStartRef.current.time

    // If it's a tap (small movement, short time) - place marker
    if (deltaX < 15 && deltaY < 15 && deltaTime < 300) {
      const currentFloor = floors.find(f => f.id === selectedFloor)
      if (!currentFloor) return
      
      // Find the img element inside the container
      const container = e.currentTarget as HTMLElement
      const img = container.querySelector('img')
      if (!img) return
      
      const rect = img.getBoundingClientRect()
      const x = Math.round((touch.clientX - rect.left) * (currentFloor.width_px / rect.width))
      const y = Math.round((touch.clientY - rect.top) * (currentFloor.height_px / rect.height))
      setGuess({ x, y })
    }
    
    mapTouchStartRef.current = null
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
        onNavigateToHome={onNavigateToHome}
        user={user}
        onNavigateToAccount={onNavigateToAccount}
        onLogout={onLogout}
      />
    )
  }

  return (
    <div className="play-page">
      <header className="play-header">
        <div className="play-logo" onClick={onNavigateToHome} style={{ cursor: 'pointer' }}>
          <img src="/mtuci-logo-white.svg" alt="MTUCI" className="play-logo-icon" />
          <h1 className="play-logo-text">MTUCI Guesser</h1>
        </div>
        {user ? (
          <ProfileMenu 
            variant="light"
            avatarUrl={user?.avatar_url}
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
            {mode === '360' ? (
              currentLocation ? <PanoramaViewer imageUrl={currentLocation.image_path} /> : null
            ) : (
              <>
                <button className="play-arrow play-arrow-left" onClick={scrollPhotoLeft}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M15 6L9 12L15 18" stroke="#372579" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                <div
                  className="play-photo-container play-photo-big"
                  ref={photoRef}
                  onMouseDown={handlePhotoMouseDown}
                  onMouseMove={handlePhotoMouseMove}
                  onMouseUp={handlePhotoMouseUp}
                  onMouseLeave={handlePhotoMouseLeave}
                  onTouchStart={handlePhotoTouchStart}
                  onTouchMove={handlePhotoTouchMove}
                  onTouchEnd={handlePhotoTouchEnd}
                >
                  {currentLocation && (
                    <img
                      className="play-photo"
                      src={currentLocation.image_path}
                      alt="Найди это место"
                      draggable={false}
                    />
                  )}
                </div>

                <button className="play-arrow play-arrow-right" onClick={scrollPhotoRight}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M9 6L15 12L9 18" stroke="#372579" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </>
            )}
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
              
              <div className="play-map-container" ref={mapContainerRef}>
                {currentFloor ? (
                  <div 
                    className="play-map-inner"
                    onTouchStart={onMapTouchStart}
                    onTouchEnd={onMapTouchEnd}
                  >
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
                        draggable={false}
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
