import React, { useState } from 'react'
import './HomePage.css'
import RulesPage from './RulesPage'
import ProfileMenu from '../components/ProfileMenu'

interface HomePageProps {
  user: any
  onStartGame: () => void
  onNavigateToLogin: () => void
  onNavigateToRegister: () => void
  onNavigateToAccount: () => void
  onLogout: () => void
  onNavigateToAdmin: () => void
}

export default function HomePage({ 
  user, 
  onStartGame, 
  onNavigateToLogin, 
  onNavigateToRegister,
  onNavigateToAccount,
  onLogout,
  onNavigateToAdmin
}: HomePageProps) {
  const [showRules, setShowRules] = useState(false)

  return (
    <>
      <div className="home-page">
        <div className="home-background">
          <div className="home-circle home-circle-1"></div>
          <div className="home-circle home-circle-2"></div>
          <div className="home-circle home-circle-3"></div>
        </div>

        <div className="home-header">
        <div className="home-logo">
          <img src="/mtuci-logo-darkblue.svg" alt="MTUCI" className="home-logo-icon" />
          <h1 className="home-logo-text">MTUCI Guesser</h1>
        </div>

          <div className="home-auth-buttons">
            {user ? (
              <ProfileMenu 
                onNavigateToAccount={onNavigateToAccount}
                onLogout={onLogout}
              />
            ) : (
              <>
                <button className="home-login-btn" onClick={onNavigateToLogin}>
                  Войти
                </button>
                <button className="home-register-btn" onClick={onNavigateToRegister}>
                  Создать аккаунт
                </button>
              </>
            )}
          </div>
        </div>

        <div className="home-content">
          <div className="home-actions">
            <button className="home-start-btn" onClick={onStartGame}>
              Начать игру
            </button>
            <button className="home-rules-btn" onClick={() => setShowRules(true)}>
              ?
            </button>
          </div>
          
          {user?.email === 'admin@admin.com' && (
            <button 
              className="home-admin-link"
              onClick={onNavigateToAdmin}
            >
              Админ панель
            </button>
          )}
        </div>
      </div>

      {showRules && <RulesPage onClose={() => setShowRules(false)} />}
    </>
  )
}

