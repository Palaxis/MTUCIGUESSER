import { useState } from 'react'

export type Page = 'home' | 'login' | 'register' | 'account' | 'play' | 'admin' | 'leaderboard' | 'duel'

export function useNavigation() {
  const [currentPage, setCurrentPage] = useState<Page>('home')

  return {
    currentPage,
    navigateTo: setCurrentPage,
    navigateToHome: () => setCurrentPage('home'),
    navigateToLogin: () => setCurrentPage('login'),
    navigateToRegister: () => setCurrentPage('register'),
    navigateToAccount: () => setCurrentPage('account'),
    navigateToPlay: () => setCurrentPage('play'),
    navigateToAdmin: () => setCurrentPage('admin'),
    navigateToLeaderboard: () => setCurrentPage('leaderboard'),
    navigateToDuel: () => setCurrentPage('duel')
  }
}
