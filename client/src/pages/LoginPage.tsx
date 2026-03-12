import React, { useState } from 'react'
import { Button, Input, Logo, Card } from '../shared/ui'
import './LoginPage.css'

interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<void>
  onNavigateToRegister: () => void
}

export default function LoginPage({ onLogin, onNavigateToRegister }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await onLogin(email, password)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка входа')
    } finally {
      setLoading(false)
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
        <Logo variant="dark" size="medium" />
      </div>

      <div className="login-content">
        <Card title="Вход">
          <form onSubmit={handleLogin}>
            {error && <div className="login-error">{error}</div>}

            <Input
              type="text"
              label="Почта"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@mtuci.ru"
              required
            />

            <Input
              type="password"
              label="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />

            <Button type="submit" variant="primary" size="medium" disabled={loading} style={{ margin: '30px auto 0', display: 'block' }}>
              {loading ? 'Вход...' : 'Войти'}
            </Button>
          </form>
        </Card>

        <div className="login-register-link">
          <span>Нет аккаунта?</span>
          <Button
            type="button"
            variant="secondary"
            size="large"
            onClick={onNavigateToRegister}
          >
            Создать аккаунт
          </Button>
        </div>
      </div>
    </div>
  )
}



