import React, { useState, useEffect } from 'react'
import axios from 'axios'
import './AccountPage.css'

interface User {
  id: number
  first_name: string
  last_name: string
  email: string
}

interface AccountPageProps {
  user: User
  onLogout: () => void
  onUpdate: (user: User) => void
}

export default function AccountPage({ user, onLogout, onUpdate }: AccountPageProps) {
  const [firstName, setFirstName] = useState(user.first_name)
  const [lastName, setLastName] = useState(user.last_name)
  const [email, setEmail] = useState(user.email)
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    setFirstName(user.first_name)
    setLastName(user.last_name)
    setEmail(user.email)
  }, [user])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    try {
      const data: any = {
        first_name: firstName,
        last_name: lastName,
        email
      }
      if (password) {
        data.password = password
      }

      const response = await axios.put(`/api/users/${user.id}`, data)
      onUpdate(response.data)
      setMessage('Изменения сохранены')
      setPassword('')
    } catch (err: any) {
      setMessage(err.response?.data?.error || 'Ошибка сохранения')
    }
  }

  return (
    <div className="account-page">
      <header className="account-header">
        <div className="account-logo">
          <img src="/mtuci-logo-white.svg" alt="MTUCI" className="account-logo-icon" />
          <h1 className="account-logo-text">MTUCI Guesser</h1>
        </div>
        <button className="account-profile-btn">
          <svg width="25" height="25" viewBox="0 0 25 25" fill="none">
            <circle cx="12.5" cy="8" r="4" stroke="white" strokeWidth="2"/>
            <path d="M5 20C5 16 8 13 12.5 13C17 13 20 16 20 20" stroke="white" strokeWidth="2"/>
          </svg>
        </button>
      </header>

      <div className="account-content">
        <h2 className="account-title">Ваш аккаунт</h2>

        <div className="account-main">
          <div className="account-photo-section">
            <div className="account-photo-circle">
              <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
                <circle cx="60" cy="40" r="20" stroke="#8B8B8B" strokeWidth="6"/>
                <path d="M25 100C25 70 40 55 60 55C80 55 95 70 95 100" stroke="#8B8B8B" strokeWidth="6"/>
              </svg>
            </div>
            <button className="account-add-photo">
              <span className="account-add-icon">+</span>
              Добавить фото профиля
            </button>
          </div>

          <form className="account-form" onSubmit={handleSave}>
            <div className="account-field">
              <label className="account-field-label">Имя</label>
              <input
                type="text"
                className="account-field-input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>

            <div className="account-field">
              <label className="account-field-label">Фамилия</label>
              <input
                type="text"
                className="account-field-input"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>

            <div className="account-field">
              <label className="account-field-label">Почта</label>
              <input
                type="email"
                className="account-field-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="account-field">
              <label className="account-field-label">Пароль</label>
              <input
                type="password"
                className="account-field-input"
                placeholder="Оставьте пустым, чтобы не менять"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </form>
        </div>

        {message && <div className="account-message">{message}</div>}

        <button className="account-save-btn" onClick={handleSave}>
          Сохранить изменения
        </button>

        <button className="account-logout-btn" onClick={onLogout}>
          Выйти
        </button>
      </div>
    </div>
  )
}

