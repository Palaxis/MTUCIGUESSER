import React, { useEffect, useState } from 'react'
import './HomePage.css'
import RulesPage from './RulesPage'
import { ProfileMenu } from '../shared/ui'
import { getDailyWeatherHint, type WeatherHintData } from '../shared/api'

interface HomePageProps {
  user: any
  onNavigateToHome: () => void
  onStartGame: () => void
  onNavigateToLogin: () => void
  onNavigateToRegister: () => void
  onNavigateToAccount: () => void
  onLogout: () => void
  onNavigateToAdmin: () => void
  onNavigateToDuel: () => void
  onStartGame360: () => void
  canAccessAdmin: boolean
}

export default function HomePage({ 
  user, 
  onNavigateToHome,
  onStartGame, 
  onNavigateToLogin, 
  onNavigateToRegister,
  onNavigateToAccount,
  onLogout,
  onNavigateToAdmin,
  onNavigateToDuel,
  onStartGame360,
  canAccessAdmin
}: HomePageProps) {
  const [showRules, setShowRules] = useState(false)
  const [hint, setHint] = useState<WeatherHintData | null>(null)
  const [hintStatus, setHintStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')

  useEffect(() => {
    let isMounted = true
    setHintStatus('loading')

    getDailyWeatherHint('Moscow')
      .then((value) => {
        if (!isMounted) return
        if (value) {
          setHint(value)
          setHintStatus('ready')
          return
        }
        setHint(null)
        setHintStatus('empty')
      })
      .catch(() => {
        if (!isMounted) return
        setHint(null)
        setHintStatus('error')
      })

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <>
      <main className="home-page">
        <div className="home-background">
          <div className="home-circle home-circle-1"></div>
          <div className="home-circle home-circle-2"></div>
          <div className="home-circle home-circle-3"></div>
        </div>

        <header className="home-header">
        <div className="home-logo" onClick={onNavigateToHome}>
          <img src="/mtuci-logo-darkblue.svg" alt="MTUCI" className="home-logo-icon" />
          <h1 className="home-logo-text">MTUCI Guesser</h1>
        </div>

          <div className="home-auth-buttons">
            {user ? (
              <ProfileMenu 
                avatarUrl={user?.avatar_url}
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
        </header>

        <section className="home-content" aria-label="Игровые действия">
          <nav className="home-actions" aria-label="Навигация по режимам">
            <button className="home-start-btn" onClick={onStartGame}>
              Начать игру
            </button>
            <button className="home-duel-btn" onClick={onNavigateToDuel}>
              ⚔️ Дуэли
            </button>
            <button className="home-360-btn" onClick={onStartGame360}>
              360 DEBUG
            </button>
            <button className="home-rules-btn" onClick={() => setShowRules(true)}>
              ?
            </button>
          </nav>

          <aside className="home-weather-widget" aria-live="polite">
            <h2 className="home-weather-title">Подсказка дня</h2>
            {hintStatus === 'loading' && <p className="home-weather-text">Загрузка внешних данных...</p>}
            {hintStatus === 'ready' && hint && (
              <>
                <p className="home-weather-text">
                  {hint.city}: {hint.temperatureCelsius}°C, {hint.weather}
                </p>
                <p className="home-weather-tip">{hint.recommendation}</p>
              </>
            )}
            {hintStatus === 'empty' && (
              <p className="home-weather-text">Внешний сервис не вернул данные. Игра работает в штатном режиме.</p>
            )}
            {hintStatus === 'error' && (
              <p className="home-weather-text">Сервис временно недоступен. Используйте встроенные подсказки в игре.</p>
            )}
          </aside>
          
          {canAccessAdmin && (
            <button 
              className="home-admin-link"
              onClick={onNavigateToAdmin}
            >
              Админ панель
            </button>
          )}
        </section>
      </main>

      {showRules && <RulesPage onClose={() => setShowRules(false)} />}
    </>
  )
}

