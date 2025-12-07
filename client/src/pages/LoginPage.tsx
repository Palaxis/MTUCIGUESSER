import React, { useState } from 'react'
import axios from 'axios'
import './LoginPage.css'

interface LoginPageProps {
  onLogin: (user: any) => void
  onNavigateToRegister: () => void
}

export default function LoginPage({ onLogin, onNavigateToRegister }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    try {
      const response = await axios.post('/api/auth/login', { email, password })
      onLogin(response.data.user)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка входа')
    }
  }

  return (
    <div className="login-page">
      <div className="login-background">
        <div className="login-circle login-circle-1"></div>
        <div className="login-circle login-circle-2"></div>
        <div className="login-circle login-circle-3"></div>
      </div>

      <div className="login-header">
        <div className="login-logo">
          <img src="/mtuci-logo-darkblue.svg" alt="MTUCI" className="login-logo-icon" />
          <h1 className="login-logo-text">MTUCI Guesser</h1>
        </div>
      </div>

      <div className="login-content">
        <form className="login-form" onSubmit={handleLogin}>
          <h2 className="login-title">Вход</h2>
          
          {error && <div className="login-error">{error}</div>}

          <div className="login-field">
            <label className="login-label">Почта</label>
            <input
              type="text"
              className="login-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@mtuci.ru"
              required
            />
          </div>

          <div className="login-field">
            <label className="login-label">Пароль</label>
            <input
              type="password"
              className="login-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="login-submit-btn">
            Войти
          </button>

          <div className="login-register-link">
            Нет аккаунта?{' '}
            <button 
              type="button" 
              className="login-link-btn" 
              onClick={onNavigateToRegister}
            >
              Зарегистрироваться
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}



