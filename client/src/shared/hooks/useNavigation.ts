import { useState } from 'react'

export type Page = 'home' | 'login' | 'register' | 'account' | 'play' | 'play360' | 'admin' | 'leaderboard' | 'duel'

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
    navigateToPlay360: () => setCurrentPage('play360'),
    navigateToAdmin: () => setCurrentPage('admin'),
    navigateToLeaderboard: () => setCurrentPage('leaderboard'),
    navigateToDuel: () => setCurrentPage('duel')
  }
}
