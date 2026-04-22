import React, { useState, useRef, useEffect } from 'react'
import './DuelPage.css'
import { useDuelSocket } from '../features/duel/useDuelSocket'
import { gameApi } from '../shared/api'
import type { Floor } from '../shared/api/game'

interface DuelPageProps {
  user: any
  onNavigateToHome: () => void
  onNavigateToLogin: () => void
}

export default function DuelPage({ user, onNavigateToHome, onNavigateToLogin }: DuelPageProps) {
  const duel = useDuelSocket(user)
  const [joinCode, setJoinCode] = useState('')

  // Guessing state
  const [floors, setFloors] = useState<Floor[]>([])
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null)
  const [guess, setGuess] = useState<{ x: number; y: number } | null>(null)
  const [photoTimer, setPhotoTimer] = useState(10)
  const [guessTimer, setGuessTimer] = useState(15)
  const [mapZoom, setMapZoom] = useState(1)
  const [minZoom, setMinZoom] = useState(0.5)

  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapContainerMobileRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<HTMLImageElement | null>(null)
  const photoRef = useRef<HTMLDivElement | null>(null)

  // Photo drag state
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)

  // Load floors on mount
  useEffect(() => {
    gameApi.getFloors().then(setFloors)
  }, [])

  function calculateFitZoom() {
    if (!selectedFloor || floors.length === 0) return null
    const currentFloor = floors.find(f => f.id === selectedFloor)
    if (!currentFloor) return null

    // Try desktop container first, then mobile
    const container = mapContainerRef.current || mapContainerMobileRef.current
    if (!container) return null

    const containerRect = container.getBoundingClientRect()
    const containerWidth = containerRect.width - 4
    const containerHeight = containerRect.height - 4

    if (containerWidth <= 0 || containerHeight <= 0) return null

    const scaleX = containerWidth / currentFloor.width_px
    const scaleY = containerHeight / currentFloor.height_px
    return Math.min(scaleX, scaleY)
  }

  // Handle map fit on floor change
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
  }, [selectedFloor, floors, duel.phase])

  // Handle Resize
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
  }, [selectedFloor, floors, mapZoom, duel.phase])

  // Photo timer
  useEffect(() => {
    if (duel.phase !== 'photo') return
    const time = duel.roundData?.photoTime || 10
    setPhotoTimer(time)
    const interval = setInterval(() => {
      setPhotoTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [duel.phase, duel.roundData])

  // Guess timer
  useEffect(() => {
    if (duel.phase !== 'guessing') return
    const time = duel.roundData?.guessTime || 15
    setGuessTimer(time)
    setSelectedFloor(null)
    setGuess(null)
    setMapZoom(1)
    const interval = setInterval(() => {
      setGuessTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [duel.phase, duel.roundData])

  // Auto-submit when guess timer hits 0
  useEffect(() => {
    if (guessTimer === 0 && duel.phase === 'guessing' && !duel.guessReceived) {
      handleSubmitGuess()
    }
  }, [guessTimer])

  function handleSubmitGuess() {
    if (duel.guessReceived) return
    if (guess && selectedFloor) {
      duel.submitGuess(guess.x, guess.y, selectedFloor)
    } else {
      // Submit a bad guess if nothing selected
      duel.submitGuess(0, 0, selectedFloor || 1)
    }
  }

  function onMapClick(e: React.MouseEvent<HTMLImageElement>) {
    if (!selectedFloor) return
    const currentFloor = floors.find(f => f.id === selectedFloor)
    if (!currentFloor) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.round((e.clientX - rect.left) * (currentFloor.width_px / rect.width))
    const y = Math.round((e.clientY - rect.top) * (currentFloor.height_px / rect.height))
    setGuess({ x, y })
  }

  // Touch handling for map - distinguish tap from scroll
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const mapInnerRef = useRef<HTMLDivElement | null>(null)

  function onMapTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    const touch = e.touches[0]
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    }
  }

  function onMapTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    if (!touchStartRef.current || !selectedFloor) return
    
    const touch = e.changedTouches[0]
    const deltaX = Math.abs(touch.clientX - touchStartRef.current.x)
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y)
    const deltaTime = Date.now() - touchStartRef.current.time

    // If it's a tap (small movement, short time) - place marker
    if (deltaX < 15 && deltaY < 15 && deltaTime < 300) {
      const currentFloor = floors.find(f => f.id === selectedFloor)
      if (!currentFloor) return
      
      // Find the img element inside the container
      const container = e.currentTarget
      const img = container.querySelector('img')
      if (!img) return
      
      const rect = img.getBoundingClientRect()
      const x = Math.round((touch.clientX - rect.left) * (currentFloor.width_px / rect.width))
      const y = Math.round((touch.clientY - rect.top) * (currentFloor.height_px / rect.height))
      setGuess({ x, y })
    }
    
    touchStartRef.current = null
  }

  function scrollPhotoLeft() {
    if (photoRef.current) photoRef.current.scrollBy({ left: -200, behavior: 'smooth' })
  }
  function scrollPhotoRight() {
    if (photoRef.current) photoRef.current.scrollBy({ left: 200, behavior: 'smooth' })
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
  function handlePhotoMouseUp() { setIsDragging(false) }
  function handlePhotoMouseLeave() { setIsDragging(false) }

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
  function handlePhotoTouchEnd() { setIsDragging(false) }

  // If user is not logged in
  if (!user) {
    return (
      <div className="duel-page">
        <div className="duel-background">
          <div className="duel-bg-circle duel-bg-circle-1"></div>
          <div className="duel-bg-circle duel-bg-circle-2"></div>
        </div>
        <div className="duel-center-content">
          <div className="duel-logo">
            <img src="/mtuci-logo-darkblue.svg" alt="MTUCI" className="duel-logo-icon" />
            <h1 className="duel-logo-text">MTUCI Guesser</h1>
          </div>
          <div className="duel-auth-required">
            <h2>Дуэли</h2>
            <p>Для игры в дуэли необходимо войти в аккаунт</p>
            <button className="duel-btn duel-btn-primary" onClick={onNavigateToLogin}>Войти</button>
            <button className="duel-btn duel-btn-secondary" onClick={onNavigateToHome}>На главную</button>
          </div>
        </div>
      </div>
    )
  }

  // ===================== LOBBY PHASE =====================
  if (duel.phase === 'lobby') {
    return (
      <div className="duel-page">
        <div className="duel-background">
          <div className="duel-bg-circle duel-bg-circle-1"></div>
          <div className="duel-bg-circle duel-bg-circle-2"></div>
        </div>
        <div className="duel-center-content">
          <div className="duel-logo" onClick={onNavigateToHome} style={{ cursor: 'pointer' }}>
            <img src="/mtuci-logo-darkblue.svg" alt="MTUCI" className="duel-logo-icon" />
            <h1 className="duel-logo-text">MTUCI Guesser</h1>
          </div>
          <div className="duel-lobby-card">
            <h2 className="duel-lobby-title">⚔️ Дуэли</h2>
            <p className="duel-lobby-subtitle">Сразись с другом в угадывании локаций МТУСИ!</p>
            
            {duel.error && <div className="duel-error">{duel.error}</div>}
            
            <button className="duel-btn duel-btn-primary duel-btn-large" onClick={duel.createRoom}>
              Создать комнату
            </button>

            <div className="duel-divider">
              <span>или</span>
            </div>

            <div className="duel-join-section">
              <input
                type="text"
                className="duel-code-input"
                placeholder="Код комнаты"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
              />
              <button 
                className="duel-btn duel-btn-primary"
                onClick={() => joinCode.length === 6 && duel.joinRoom(joinCode)}
                disabled={joinCode.length !== 6}
              >
                Войти
              </button>
            </div>

            <button className="duel-btn duel-btn-back" onClick={onNavigateToHome}>
              ← На главную
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ===================== WAITING PHASE =====================
  if (duel.phase === 'waiting') {
    return (
      <div className="duel-page">
        <div className="duel-background">
          <div className="duel-bg-circle duel-bg-circle-1"></div>
          <div className="duel-bg-circle duel-bg-circle-2"></div>
        </div>
        <div className="duel-center-content">
          <div className="duel-logo">
            <img src="/mtuci-logo-darkblue.svg" alt="MTUCI" className="duel-logo-icon" />
            <h1 className="duel-logo-text">MTUCI Guesser</h1>
          </div>
          <div className="duel-waiting-card">
            <h2 className="duel-waiting-title">Ожидание противника...</h2>
            <div className="duel-room-code-display">
              <span className="duel-room-code-label">Код комнаты</span>
              <span className="duel-room-code">{duel.roomCode}</span>
            </div>
            <p className="duel-waiting-hint">Отправь этот код другу</p>
            <div className="duel-waiting-spinner">
              <div className="duel-spinner"></div>
            </div>
            <button className="duel-btn duel-btn-back" onClick={duel.leaveRoom}>
              Отмена
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ===================== STARTING PHASE =====================
  if (duel.phase === 'starting') {
    return (
      <div className="duel-page duel-page-dark">
        <div className="duel-countdown-overlay">
          <h2 className="duel-countdown-title">Дуэль начинается!</h2>
          <div className="duel-countdown-players">
            <div className="duel-countdown-player">
              <div className="duel-avatar-circle">
                {duel.players[0]?.avatar_url ? (
                  <img src={duel.players[0].avatar_url} alt="" className="duel-avatar-img" />
                ) : (
                  <span className="duel-avatar-initial">{duel.players[0]?.name?.charAt(0) || '?'}</span>
                )}
              </div>
              <span className="duel-player-name-starting">{duel.players[0]?.name}</span>
            </div>
            <div className="duel-vs">VS</div>
            <div className="duel-countdown-player">
              <div className="duel-avatar-circle">
                {duel.players[1]?.avatar_url ? (
                  <img src={duel.players[1].avatar_url} alt="" className="duel-avatar-img" />
                ) : (
                  <span className="duel-avatar-initial">{duel.players[1]?.name?.charAt(0) || '?'}</span>
                )}
              </div>
              <span className="duel-player-name-starting">{duel.players[1]?.name}</span>
            </div>
          </div>
          <div className="duel-countdown-number">{duel.countdown}</div>
        </div>
      </div>
    )
  }

  // ===================== PHOTO PHASE =====================
  if (duel.phase === 'photo' && duel.roundData) {
    const rd = duel.roundData
    return (
      <div className="duel-page duel-page-dark duel-photo-page">
        {/* Desktop Header */}
        <header className="duel-play-header duel-play-header-desktop">
          <div className="duel-play-logo">
            <img src="/mtuci-logo-white.svg" alt="MTUCI" className="duel-play-logo-icon" />
            <h1 className="duel-play-logo-text">MTUCI Guesser</h1>
          </div>
          <div className="duel-hp-bars">
            {renderHpBars(rd.players, duel.myId)}
          </div>
          <div className="duel-round-info">
            Раунд {rd.round}/{rd.totalRounds}
          </div>
        </header>

        {/* Mobile Header */}
        <header className="duel-play-header duel-play-header-mobile duel-photo-header-mobile">
          <div className="duel-header-top">
            <div className="duel-round-badge">
              📷 Раунд {rd.round}/{rd.totalRounds}
            </div>
            <div className="duel-timer-compact duel-timer-photo">
              {photoTimer}с
            </div>
          </div>
          <div className="duel-hp-bars-mobile">
            {renderHpBarsMobile(rd.players, duel.myId)}
          </div>
        </header>

        <div className="duel-timer-bar">
          <div className="duel-timer-fill" style={{ width: `${(photoTimer / (rd.photoTime || 10)) * 100}%` }}></div>
        </div>
        <div className="duel-timer-text duel-timer-text-desktop">Осмотр: {photoTimer}с</div>

        <div className="duel-photo-section">
          <div className="duel-photo-wrapper">
            <button className="duel-arrow duel-arrow-left" onClick={scrollPhotoLeft}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M15 6L9 12L15 18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div 
              className="duel-photo-container"
              ref={photoRef}
              onMouseDown={handlePhotoMouseDown}
              onMouseMove={handlePhotoMouseMove}
              onMouseUp={handlePhotoMouseUp}
              onMouseLeave={handlePhotoMouseLeave}
              onTouchStart={handlePhotoTouchStart}
              onTouchMove={handlePhotoTouchMove}
              onTouchEnd={handlePhotoTouchEnd}
            >
              <img className="duel-photo" src={rd.location.image_path} alt="Найди это место" draggable={false} />
            </div>
            <button className="duel-arrow duel-arrow-right" onClick={scrollPhotoRight}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M9 6L15 12L9 18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile hint */}
        <div className="duel-photo-hint-mobile">
          👆 Свайпай фото для осмотра
        </div>
      </div>
    )
  }

  // ===================== GUESSING PHASE =====================
  if (duel.phase === 'guessing' && duel.roundData) {
    const rd = duel.roundData
    const currentFloor = selectedFloor ? floors.find(f => f.id === selectedFloor) : null
    const sortedFloors = [...floors].sort((a, b) => parseInt(a.level || '0') - parseInt(b.level || '0')).slice(0, 5)
    
    return (
      <div className="duel-page duel-page-dark duel-guessing-page">
        {/* ===== DESKTOP HEADER ===== */}
        <header className="duel-play-header duel-play-header-desktop">
          <div className="duel-play-logo">
            <img src="/mtuci-logo-white.svg" alt="MTUCI" className="duel-play-logo-icon" />
            <h1 className="duel-play-logo-text">MTUCI Guesser</h1>
          </div>
          <div className="duel-hp-bars">
            {renderHpBars(rd.players, duel.myId)}
          </div>
          <div className="duel-round-info">
            Раунд {rd.round}/{rd.totalRounds}
          </div>
        </header>

        {/* ===== MOBILE HEADER ===== */}
        <header className="duel-play-header duel-play-header-mobile">
          <div className="duel-header-top">
            <div className="duel-round-badge">
              {rd.round}/{rd.totalRounds}
            </div>
            <div className="duel-timer-compact">
              {duel.guessReceived ? '✓' : `${guessTimer}с`}
            </div>
          </div>
          <div className="duel-hp-bars-mobile">
            {renderHpBarsMobile(rd.players, duel.myId)}
          </div>
        </header>

        {/* Timer Bar */}
        <div className="duel-timer-bar duel-timer-bar-guess">
          <div className="duel-timer-fill duel-timer-fill-guess" style={{ width: `${(guessTimer / (rd.guessTime || 15)) * 100}%` }}></div>
        </div>
        <div className="duel-timer-text duel-timer-text-desktop">
          {duel.guessReceived ? '✓ Ответ принят!' : `Ответь: ${guessTimer}с`}
        </div>

        {/* ===== DESKTOP LAYOUT ===== */}
        <div className="duel-content-map">
          <div className="duel-guess-layout">
            <div className="duel-map-section">
              <h3 className="duel-map-title">Найди точку на карте</h3>
              <div className="duel-map-container" ref={mapContainerRef}>
                {currentFloor ? (
                  <div 
                    className="duel-map-inner"
                    onTouchStart={onMapTouchStart}
                    onTouchEnd={onMapTouchEnd}
                  >
                    <div className="duel-map-wrapper" style={{ 
                      width: `${currentFloor.width_px * mapZoom}px`,
                      height: `${currentFloor.height_px * mapZoom}px`,
                      position: 'relative'
                    }}>
                      <img
                        ref={mapRef}
                        className="duel-map"
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
                          className="duel-pin duel-pin-guess"
                          style={{
                            left: `${(guess.x / currentFloor.width_px) * 100}%`,
                            top: `${(guess.y / currentFloor.height_px) * 100}%`
                          }}
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="duel-map-placeholder">Выберите этаж</div>
                )}

                {currentFloor && (
                  <div className="duel-zoom-controls">
                    <button 
                      className="duel-zoom-btn" 
                      onClick={() => setMapZoom(Math.min(mapZoom + 0.2, 3))}
                      title="Увеличить (макс. 3x)"
                    >
                      <span className="duel-zoom-icon">+</span>
                    </button>
                    <button 
                      className="duel-zoom-btn" 
                      onClick={() => setMapZoom(Math.max(mapZoom - 0.2, minZoom))}
                      disabled={mapZoom <= minZoom}
                      title="Уменьшить"
                    >
                      <span className="duel-zoom-icon">−</span>
                    </button>
                    <button 
                      className="duel-zoom-btn duel-zoom-reset" 
                      onClick={() => setMapZoom(minZoom)}
                      title="Вернуть к начальному масштабу"
                    >
                      <span className="duel-zoom-icon">◻</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="duel-sidebar">
              <div className="duel-floor-selection">
                <h3 className="duel-floor-title">Выбери этаж</h3>
                {sortedFloors.map((floor, idx) => (
                  <label key={floor.id} className="duel-floor-option">
                    <input
                      type="radio"
                      name="duel-floor"
                      className="duel-floor-radio"
                      checked={selectedFloor === floor.id}
                      onChange={() => setSelectedFloor(floor.id)}
                    />
                    <span className="duel-floor-label">{floor.level || `${idx + 1} этаж`}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <button
            className="duel-submit-btn"
            onClick={handleSubmitGuess}
            disabled={(!guess || !selectedFloor) || duel.guessReceived}
          >
            {duel.guessReceived ? '✓ Принято' : 'Ответить'}
          </button>
        </div>

        {/* ===== MOBILE LAYOUT ===== */}
        {/* Floor Selection - Horizontal Pills */}
        <div className="duel-floor-pills">
          {sortedFloors.map((floor, idx) => (
            <button
              key={floor.id}
              className={`duel-floor-pill ${selectedFloor === floor.id ? 'duel-floor-pill-active' : ''}`}
              onClick={() => setSelectedFloor(floor.id)}
            >
              {floor.level || `${idx + 1}`}
            </button>
          ))}
        </div>

        {/* Map Section - Full Width */}
        <div className="duel-map-section-mobile">
          <div className="duel-map-container-mobile" ref={mapContainerMobileRef}>
            {currentFloor ? (
              <div 
                className="duel-map-inner"
                ref={mapInnerRef}
                onTouchStart={onMapTouchStart}
                onTouchEnd={onMapTouchEnd}
              >
                <div className="duel-map-wrapper" style={{ 
                  width: `${currentFloor.width_px * mapZoom}px`,
                  height: `${currentFloor.height_px * mapZoom}px`,
                  position: 'relative'
                }}>
                  <img
                    ref={mapRef}
                    className="duel-map"
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
                      className="duel-pin duel-pin-guess duel-pin-mobile"
                      style={{
                        left: `${(guess.x / currentFloor.width_px) * 100}%`,
                        top: `${(guess.y / currentFloor.height_px) * 100}%`
                      }}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="duel-map-placeholder-mobile">
                <span>👆</span>
                <span>Выбери этаж выше</span>
              </div>
            )}

            {/* Zoom Controls - Larger for touch */}
            {currentFloor && (
              <div className="duel-zoom-controls-mobile">
                <button 
                  className="duel-zoom-btn-mobile" 
                  onClick={() => setMapZoom(Math.min(mapZoom + 0.3, 3))}
                >
                  +
                </button>
                <button 
                  className="duel-zoom-btn-mobile" 
                  onClick={() => setMapZoom(Math.max(mapZoom - 0.3, minZoom))}
                  disabled={mapZoom <= minZoom}
                >
                  −
                </button>
                <button 
                  className="duel-zoom-btn-mobile duel-zoom-btn-reset" 
                  onClick={() => setMapZoom(minZoom)}
                >
                  ⟲
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Fixed Bottom Submit Button */}
        <div className="duel-submit-container-mobile">
          <button
            className="duel-submit-btn-mobile"
            onClick={handleSubmitGuess}
            disabled={(!guess || !selectedFloor) || duel.guessReceived}
          >
            {duel.guessReceived ? '✓ Принято' : guess ? 'Ответить' : 'Выбери точку'}
          </button>
        </div>
      </div>
    )
  }

  // ===================== ROUND RESULT PHASE =====================
  if (duel.phase === 'round-result' && duel.roundResult) {
    const rr = duel.roundResult
    const playerIds = Object.keys(rr.players)
    const myResult = rr.players[duel.myId || '']
    const opponentId = playerIds.find(id => id !== duel.myId) || ''
    const opponentResult = rr.players[opponentId]

    return (
      <div className="duel-page duel-page-dark">
        <div className="duel-result-overlay">
          <h2 className="duel-result-title">Раунд {rr.round} — Результат</h2>
          
          <div className="duel-result-players">
            {/* Player 1 (me) */}
            <div className="duel-result-player">
              <div className="duel-avatar-circle duel-avatar-medium">
                {myResult?.avatar_url ? (
                  <img src={myResult.avatar_url} alt="" className="duel-avatar-img" />
                ) : (
                  <span className="duel-avatar-initial">{myResult?.name?.charAt(0) || '?'}</span>
                )}
              </div>
              <span className="duel-result-player-name">{myResult?.name || 'Вы'}</span>
              <span className="duel-result-damage">-{myResult?.damage || 0} HP</span>
              <div className="duel-hp-bar-container">
                <div className="duel-hp-bar-bg">
                  <div 
                    className="duel-hp-bar-fill duel-hp-animate" 
                    style={{ width: `${((myResult?.hp || 0) / 5000) * 100}%` }}
                  ></div>
                </div>
                <span className="duel-hp-text">{myResult?.hp || 0} / 5000</span>
              </div>
            </div>

            <div className="duel-result-vs">VS</div>

            {/* Player 2 (opponent) */}
            <div className="duel-result-player">
              <div className="duel-avatar-circle duel-avatar-medium">
                {opponentResult?.avatar_url ? (
                  <img src={opponentResult.avatar_url} alt="" className="duel-avatar-img" />
                ) : (
                  <span className="duel-avatar-initial">{opponentResult?.name?.charAt(0) || '?'}</span>
                )}
              </div>
              <span className="duel-result-player-name">{opponentResult?.name || 'Противник'}</span>
              <span className="duel-result-damage">-{opponentResult?.damage || 0} HP</span>
              <div className="duel-hp-bar-container">
                <div className="duel-hp-bar-bg">
                  <div 
                    className="duel-hp-bar-fill duel-hp-animate" 
                    style={{ width: `${((opponentResult?.hp || 0) / 5000) * 100}%` }}
                  ></div>
                </div>
                <span className="duel-hp-text">{opponentResult?.hp || 0} / 5000</span>
              </div>
            </div>
          </div>

          {/* Mini map with pins */}
          <div className="duel-result-map">
            <img src={rr.floor.image_path} alt="Карта" className="duel-result-map-img" />
            {/* Correct pin */}
            <div
              className="duel-pin duel-pin-correct"
              style={{
                left: `${(rr.location.correct_x / rr.floor.width_px) * 100}%`,
                top: `${(rr.location.correct_y / rr.floor.height_px) * 100}%`
              }}
            />
            {/* My guess pin */}
            {myResult?.guess_x != null && (
              <div
                className="duel-pin duel-pin-my"
                style={{
                  left: `${(myResult.guess_x / rr.floor.width_px) * 100}%`,
                  top: `${(myResult.guess_y! / rr.floor.height_px) * 100}%`
                }}
              />
            )}
            {/* Opponent guess pin */}
            {opponentResult?.guess_x != null && (
              <div
                className="duel-pin duel-pin-opponent"
                style={{
                  left: `${(opponentResult.guess_x / rr.floor.width_px) * 100}%`,
                  top: `${(opponentResult.guess_y! / rr.floor.height_px) * 100}%`
                }}
              />
            )}
          </div>
          <div className="duel-result-legend">
            <span className="duel-legend-item"><span className="duel-legend-dot duel-legend-correct"></span> Правильно</span>
            <span className="duel-legend-item"><span className="duel-legend-dot duel-legend-my"></span> Вы</span>
            <span className="duel-legend-item"><span className="duel-legend-dot duel-legend-opp"></span> Противник</span>
          </div>

          <p className="duel-result-next-hint">Следующий раунд скоро начнётся...</p>
        </div>
      </div>
    )
  }

  // ===================== GAME OVER PHASE =====================
  if (duel.phase === 'game-over' && duel.gameOver) {
    const go = duel.gameOver
    const isWinner = go.winnerId === duel.myId

    return (
      <div className="duel-page duel-page-dark">
        <div className="duel-gameover-overlay">
          <div className="duel-gameover-scene">
            {/* Winner side */}
            <div className={`duel-gameover-player duel-gameover-winner ${isWinner ? 'duel-gameover-me' : ''}`}>
              <div className="duel-avatar-circle duel-avatar-large">
                {go.winner.avatar_url ? (
                  <img src={go.winner.avatar_url} alt="" className="duel-avatar-img" />
                ) : (
                  <span className="duel-avatar-initial">{go.winner.name.charAt(0)}</span>
                )}
              </div>
              <span className="duel-gameover-name">{go.winner.name}</span>
              <span className="duel-gameover-hp">{go.winner.hp} HP</span>
              <span className="duel-gameover-crown">👑</span>
            </div>

            {/* Shooting animation */}
            <div className="duel-shooting-scene">
              <div className="duel-gun">🔫</div>
              <div className="duel-bullet-trail"></div>
              <div className="duel-explosion">💥</div>
            </div>

            {/* Loser side */}
            <div className={`duel-gameover-player duel-gameover-loser ${!isWinner ? 'duel-gameover-me' : ''}`}>
              <div className="duel-avatar-circle duel-avatar-large duel-avatar-dead">
                {go.loser.avatar_url ? (
                  <img src={go.loser.avatar_url} alt="" className="duel-avatar-img" />
                ) : (
                  <span className="duel-avatar-initial">{go.loser.name.charAt(0)}</span>
                )}
              </div>
              <span className="duel-gameover-name">{go.loser.name}</span>
              <span className="duel-gameover-hp">{go.loser.hp} HP</span>
              <span className="duel-gameover-skull">💀</span>
            </div>
          </div>

          <h2 className="duel-gameover-title">
            {isWinner ? '🎉 Победа!' : '😵 Поражение!'}
          </h2>

          <div className="duel-gameover-actions">
            <button className="duel-btn duel-btn-primary duel-btn-large" onClick={duel.resetDuel}>
              Ещё раз
            </button>
            <button className="duel-btn duel-btn-secondary" onClick={() => { duel.leaveRoom(); onNavigateToHome(); }}>
              На главную
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Default fallback
  return (
    <div className="duel-page">
      <div className="duel-center-content">
        <p>Загрузка...</p>
      </div>
    </div>
  )
}

// Helper: render HP bars for both players
function renderHpBars(players: Record<string, { hp: number; name: string; avatar_url: string | null }>, myId: string | null) {
  const ids = Object.keys(players)
  const myIdx = ids.findIndex(id => id === myId)
  const orderedIds = myIdx >= 0 ? [ids[myIdx], ...ids.filter(id => id !== myId)] : ids

  return (
    <div className="duel-hp-bars-row">
      {orderedIds.map((id, i) => {
        const p = players[id]
        return (
          <div key={id} className={`duel-hp-bar-item ${i === 0 ? 'duel-hp-mine' : 'duel-hp-opponent'}`}>
            <div className="duel-hp-avatar-mini">
              {p.avatar_url ? (
                <img src={p.avatar_url} alt="" className="duel-avatar-img-mini" />
              ) : (
                <span className="duel-avatar-initial-mini">{p.name.charAt(0)}</span>
              )}
            </div>
            <div className="duel-hp-info">
              <span className="duel-hp-name">{i === 0 ? 'Вы' : p.name}</span>
              <div className="duel-hp-bar-bg-mini">
                <div className="duel-hp-bar-fill-mini" style={{ width: `${(p.hp / 5000) * 100}%` }}></div>
              </div>
              <span className="duel-hp-value">{p.hp}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Helper: render compact HP bars for mobile
function renderHpBarsMobile(players: Record<string, { hp: number; name: string; avatar_url: string | null }>, myId: string | null) {
  const ids = Object.keys(players)
  const myIdx = ids.findIndex(id => id === myId)
  const orderedIds = myIdx >= 0 ? [ids[myIdx], ...ids.filter(id => id !== myId)] : ids

  return (
    <div className="duel-hp-mobile-row">
      {orderedIds.map((id, i) => {
        const p = players[id]
        const hpPercent = (p.hp / 5000) * 100
        return (
          <div key={id} className={`duel-hp-mobile-item ${i === 0 ? 'duel-hp-mobile-me' : 'duel-hp-mobile-opp'}`}>
            <div className="duel-hp-mobile-avatar">
              {p.avatar_url ? (
                <img src={p.avatar_url} alt="" />
              ) : (
                <span>{p.name.charAt(0)}</span>
              )}
            </div>
            <div className="duel-hp-mobile-bar">
              <div className="duel-hp-mobile-fill" style={{ width: `${hpPercent}%` }}></div>
            </div>
            <span className="duel-hp-mobile-value">{p.hp}</span>
          </div>
        )
      })}
    </div>
  )
}
