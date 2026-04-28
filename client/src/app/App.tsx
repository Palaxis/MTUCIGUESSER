import React, { Suspense, lazy, useMemo, useState } from 'react'
import { useAuth, useNavigation } from '../shared/hooks'
import HomePage from '../pages/HomePage'
import LoginPage from '../pages/LoginPage'
import RegistrationPage from '../pages/RegistrationPage'
import AccountPage from '../pages/AccountPage'
import { SeoHead, buildSeoConfig } from '../shared/seo/SeoHead'
import LeaderboardPage from '../pages/LeaderboardPage'

const Play = lazy(() => import('../pages/Play'))
const Admin = lazy(() => import('../pages/Admin'))
const DuelPage = lazy(() => import('../pages/DuelPage'))

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
  const seoConfig = useMemo(() => buildSeoConfig(currentPage, Boolean(user)), [currentPage, user])

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

  async function handleLogout() {
    try {
      await logout()
    } finally {
      navigateToHome()
    }
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
      <SeoHead config={seoConfig} />
      {currentPage === 'home' && (
        <HomePage
          user={user}
          onNavigateToHome={navigateToHome}
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
        <Suspense fallback={null}>
          <Play
            onGameComplete={handleGameComplete}
            user={user}
            onNavigateToHome={navigateToHome}
            onNavigateToAccount={navigateToAccount}
            onLogout={handleLogout}
          />
        </Suspense>
      )}

      {currentPage === 'play360' && (
        <Suspense fallback={null}>
          <Play
            mode="360"
            onGameComplete={handleGameComplete}
            user={user}
            onNavigateToHome={navigateToHome}
            onNavigateToAccount={navigateToAccount}
            onLogout={handleLogout}
          />
        </Suspense>
      )}

      {currentPage === 'admin' && (can('floors.create') || can('locations.create') || can('roles.manage')) && (
        <Suspense fallback={null}>
          <Admin />
        </Suspense>
      )}

      {currentPage === 'leaderboard' && (
        <LeaderboardPage
          user={user}
          userScore={gameScore || undefined}
          userRank={gameRank || undefined}
          isNewRecord={isNewRecord}
          previousBest={previousBest || undefined}
          onPlayAgain={handlePlayAgain}
          onNavigateToHome={navigateToHome}
          onNavigateToAccount={navigateToAccount}
          onLogout={handleLogout}
        />
      )}

      {currentPage === 'duel' && (
        <Suspense fallback={null}>
          <DuelPage
            user={user}
            onNavigateToHome={navigateToHome}
            onNavigateToLogin={navigateToLogin}
          />
        </Suspense>
      )}
    </>
  )
}

