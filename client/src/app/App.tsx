import React, { useState } from 'react'
import { useAuth, useNavigation } from '../shared/hooks'
import { gameApi } from '../shared/api'
import HomePage from '../pages/HomePage'
import LoginPage from '../pages/LoginPage'
import RegistrationPage from '../pages/RegistrationPage'
import AccountPage from '../pages/AccountPage'
import Play from '../pages/Play'
import Admin from '../pages/Admin'
import LeaderboardPage from '../pages/LeaderboardPage'
import DuelPage from '../pages/DuelPage'

export default function App() {
  const { user, login, register, logout, updateUser, can } = useAuth()
  const {
    currentPage,
    navigateToHome,
    navigateToLogin,
    navigateToRegister,
    navigateToAccount,
    navigateToPlay,
    navigateToPlay360,
    navigateToAdmin,
    navigateToLeaderboard,
    navigateToDuel
  } = useNavigation()

  const [gameScore, setGameScore] = useState<number | null>(null)
  const [gameRank, setGameRank] = useState<number | null>(null)
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false)
  const [previousBest, setPreviousBest] = useState<number | null>(null)

  async function handleLogin(email: string, password: string) {
    try {
      await login(email, password)
      navigateToHome()
    } catch (error) {
      throw error // Пробрасываем ошибку для обработки в LoginPage
    }
  }

  async function handleRegister(email: string, password: string, firstName: string, lastName: string) {
    try {
      await register(email, password, firstName, lastName)
      navigateToHome()
    } catch (error) {
      throw error // Пробрасываем ошибку для обработки в RegistrationPage
    }
  }

  function handleLogout() {
    logout()
    navigateToHome()
  }

  async function handleGameComplete(score: number, rank?: number, newRecord?: boolean, prevBest?: number) {
    setGameScore(score)
    setGameRank(rank || null)
    setIsNewRecord(newRecord || false)
    setPreviousBest(prevBest || null)
    navigateToLeaderboard()
  }

  function handlePlayAgain() {
    setGameScore(null)
    setGameRank(null)
    setIsNewRecord(false)
    setPreviousBest(null)
    navigateToPlay()
  }

  return (
    <>
      {currentPage === 'home' && (
        <HomePage
          user={user}
          onStartGame={navigateToPlay}
          onNavigateToLogin={navigateToLogin}
          onNavigateToRegister={navigateToRegister}
          onNavigateToAccount={navigateToAccount}
          onLogout={handleLogout}
          onNavigateToAdmin={navigateToAdmin}
          onNavigateToDuel={navigateToDuel}
          onStartGame360={navigateToPlay360}
          canAccessAdmin={can('floors.create') || can('locations.create') || can('roles.manage')}
        />
      )}

      {currentPage === 'login' && (
        <LoginPage
          onLogin={handleLogin}
          onNavigateToRegister={navigateToRegister}
        />
      )}

      {currentPage === 'register' && (
        <RegistrationPage
          onRegister={handleRegister}
          onNavigateToLogin={navigateToLogin}
        />
      )}

      {currentPage === 'account' && user && (
        <AccountPage
          user={user}
          onLogout={handleLogout}
          onUpdate={updateUser}
          onNavigateToHome={navigateToHome}
        />
      )}

      {currentPage === 'play' && (
        <Play
          onGameComplete={handleGameComplete}
          user={user}
          onNavigateToAccount={navigateToAccount}
          onLogout={handleLogout}
        />
      )}

      {currentPage === 'play360' && (
        <Play
          mode="360"
          onGameComplete={handleGameComplete}
          user={user}
          onNavigateToAccount={navigateToAccount}
          onLogout={handleLogout}
        />
      )}

      {currentPage === 'admin' && (can('floors.create') || can('locations.create') || can('roles.manage')) && (
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
          onNavigateToAccount={navigateToAccount}
          onLogout={handleLogout}
        />
      )}

      {currentPage === 'duel' && (
        <DuelPage
          user={user}
          onNavigateToHome={navigateToHome}
          onNavigateToLogin={navigateToLogin}
        />
      )}
    </>
  )
}

