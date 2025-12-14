import React, { useState } from 'react'
import './RegistrationPage.css'

interface RegistrationPageProps {
  onRegister: (email: string, password: string, firstName: string, lastName: string) => Promise<void>
  onNavigateToLogin: () => void
}

export default function RegistrationPage({ onRegister, onNavigateToLogin }: RegistrationPageProps) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    try {
      await onRegister(email, password, firstName, lastName)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка регистрации')
    }
  }

  return (
    <div className="register-page">
      <div className="register-background">
        <div className="register-circle register-circle-1"></div>
        <div className="register-circle register-circle-2"></div>
        <div className="register-circle register-circle-3"></div>
      </div>

      <div className="register-header">
        <div className="register-logo">
          <img src="/mtuci-logo-darkblue.svg" alt="MTUCI" className="register-logo-icon" />
          <h1 className="register-logo-text">MTUCI Guesser</h1>
        </div>
      </div>

      <div className="register-content">
        <form className="register-form" onSubmit={handleRegister}>
          <h2 className="register-title">Давайте знакомиться</h2>

          {error && <div className="register-error">{error}</div>}

          <input
            type="text"
            className="register-input"
            placeholder="Введите имя"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />

          <input
            type="text"
            className="register-input"
            placeholder="Введите фамилию"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />

          <input
            type="email"
            className="register-input"
            placeholder="Введите вашу почту"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            className="register-input"
            placeholder="Введите пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="submit" className="register-btn">
            Создать аккаунт
          </button>
        </form>

        <button 
          className="register-login-btn" 
          onClick={onNavigateToLogin}
          type="button"
        >
          Уже есть аккаунт? Войти
        </button>
      </div>
    </div>
  )
}

