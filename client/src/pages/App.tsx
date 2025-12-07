import React, { useState, useEffect } from 'react'
import axios from 'axios'
import HomePage from './HomePage'
import LoginPage from './LoginPage'
import RegistrationPage from './RegistrationPage'
import AccountPage from './AccountPage'
import Play from './Play'
import Admin from './Admin'
import LeaderboardPage from './LeaderboardPage'

// Настройка axios для работы с сессиями
axios.defaults.withCredentials = true
axios.defaults.baseURL = 'http://localhost:3001'

type Page = 'home' | 'login' | 'register' | 'account' | 'play' | 'admin' | 'leaderboard'

interface User {
  id: number
  first_name: string
  last_name: string
  email: string
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home')
  const [user, setUser] = useState<User | null>(null)
  const [gameScore, setGameScore] = useState<number | null>(null)
  const [gameRank, setGameRank] = useState<number | null>(null)
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false)
  const [previousBest, setPreviousBest] = useState<number | null>(null)

  useEffect(() => {
    // Проверяем авторизацию при загрузке
    checkAuth()
  }, [])

  async function checkAuth() {
    try {
      const response = await axios.get('/api/auth/me')
      setUser(response.data)
    } catch (error) {
      // Пользователь не авторизован
      setUser(null)
    }
  }

  function handleLogin(userData: User) {
    setUser(userData)
    setCurrentPage('home')
  }

  function handleRegister(userData: User) {
    setUser(userData)
    setCurrentPage('home')
  }

  function handleLogout() {
    axios.post('/api/auth/logout').catch(() => {})
    setUser(null)
    setCurrentPage('home')
  }

  function handleUpdateUser(userData: User) {
    setUser(userData)
  }

  function handleGameComplete(score: number, rank?: number, newRecord?: boolean, prevBest?: number) {
    setGameScore(score)
    setGameRank(rank || null)
    setIsNewRecord(newRecord || false)
    setPreviousBest(prevBest || null)
    setCurrentPage('leaderboard')
  }

  function handlePlayAgain() {
    setGameScore(null)
    setGameRank(null)
    setIsNewRecord(false)
    setPreviousBest(null)
    setCurrentPage('play')
  }

  return (
    <>
      {currentPage === 'home' && (
        <HomePage
          user={user}
          onStartGame={() => setCurrentPage('play')}
          onNavigateToLogin={() => setCurrentPage('login')}
          onNavigateToRegister={() => setCurrentPage('register')}
          onNavigateToAccount={() => setCurrentPage('account')}
          onLogout={handleLogout}
          onNavigateToAdmin={() => setCurrentPage('admin')}
        />
      )}

      {currentPage === 'login' && (
        <LoginPage
          onLogin={handleLogin}
          onNavigateToRegister={() => setCurrentPage('register')}
        />
      )}

      {currentPage === 'register' && (
        <RegistrationPage
          onRegister={handleRegister}
          onNavigateToLogin={() => setCurrentPage('login')}
        />
      )}

      {currentPage === 'account' && user && (
        <AccountPage
          user={user}
          onLogout={handleLogout}
          onUpdate={handleUpdateUser}
        />
      )}

      {currentPage === 'play' && (
        <Play 
          onGameComplete={handleGameComplete} 
          user={user}
          onNavigateToAccount={() => setCurrentPage('account')}
          onLogout={handleLogout}
        />
      )}

      {currentPage === 'admin' && user?.email === 'admin@admin.com' && (
        <Admin />
      )}

      {currentPage === 'leaderboard' && (
        <LeaderboardPage
          user={user}
          userScore={gameScore || undefined}
          userRank={gameRank || undefined}
          isNewRecord={isNewRecord}
          previousBest={previousBest || undefined}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </>
  )
}
