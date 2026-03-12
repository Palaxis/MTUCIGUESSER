import React, { useState } from 'react'
import { Button, Input, Logo, Card } from '../shared/ui'
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
  const [loading, setLoading] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await onRegister(email, password, firstName, lastName)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка регистрации')
    } finally {
      setLoading(false)
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
        <Logo variant="dark" size="medium" />
      </div>

      <div className="register-content">
        <Card title="Давайте знакомиться">
          <form onSubmit={handleRegister}>
            {error && <div className="register-error">{error}</div>}

            <Input
              type="text"
              placeholder="Введите имя"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />

            <Input
              type="text"
              placeholder="Введите фамилию"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />

            <Input
              type="email"
              placeholder="Введите вашу почту"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              type="password"
              placeholder="Введите пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button 
              type="submit" 
              variant="primary" 
              size="large" 
              disabled={loading}
              style={{ margin: '30px auto 0', display: 'block' }}
            >
              {loading ? 'Создание...' : 'Создать аккаунт'}
            </Button>
          </form>
        </Card>

        <div className="register-login-link">
          <span>Уже есть аккаунт?</span>
          <Button variant="secondary" size="large" onClick={onNavigateToLogin}>
            Войти
          </Button>
        </div>
      </div>
    </div>
  )
}

