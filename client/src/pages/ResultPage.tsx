import React from 'react'
import './ResultPage.css'
import ProfileMenu from '../components/ProfileMenu'

interface ResultPageProps {
  score: number
  maxScore: number
  floorImage: string
  correctX: number
  correctY: number
  guessX: number
  guessY: number
  floorWidth: number
  floorHeight: number
  onNext: () => void
  user?: any
  onNavigateToAccount?: () => void
  onLogout?: () => void
}

export default function ResultPage({
  score,
  maxScore,
  floorImage,
  correctX,
  correctY,
  guessX,
  guessY,
  floorWidth,
  floorHeight,
  onNext,
  user,
  onNavigateToAccount,
  onLogout
}: ResultPageProps) {
  return (
    <div className="result-page">
      <header className="result-header">
        <div className="result-logo">
          <img src="/mtuci-logo-white.svg" alt="MTUCI" className="result-logo-icon" />
          <h1 className="result-logo-text">MTUCI Guesser</h1>
        </div>
        {user && onNavigateToAccount && onLogout ? (
          <ProfileMenu 
            onNavigateToAccount={onNavigateToAccount}
            onLogout={onLogout}
          />
        ) : (
          <button className="result-profile-btn">
            <svg width="25" height="25" viewBox="0 0 25 25" fill="none">
              <circle cx="12.5" cy="8" r="4" stroke="white" strokeWidth="2"/>
              <path d="M5 20C5 16 8 13 12.5 13C17 13 20 16 20 20" stroke="white" strokeWidth="2"/>
            </svg>
          </button>
        )}
      </header>

      <div className="result-content">
        <div className="result-card">
          <div className="result-map-container">
            <img 
              src={floorImage} 
              alt="Карта этажа" 
              className="result-map"
            />
            <div
              className="result-pin result-pin-guess"
              style={{ 
                left: `${(guessX / floorWidth) * 100}%`, 
                top: `${(guessY / floorHeight) * 100}%` 
              }}
            />
            <div
              className="result-pin result-pin-answer"
              style={{ 
                left: `${(correctX / floorWidth) * 100}%`, 
                top: `${(correctY / floorHeight) * 100}%` 
              }}
            />
          </div>

          <h2 className="result-title">Ваш результат</h2>
          <p className="result-score-text">{score} из {maxScore} баллов</p>

          <button className="result-next-btn" onClick={onNext}>
            Следующий раунд
          </button>
        </div>
      </div>
    </div>
  )
}

