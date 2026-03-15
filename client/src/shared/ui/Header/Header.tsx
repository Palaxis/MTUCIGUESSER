import React from 'react'
import './Header.css'
import { Logo } from '../Logo/Logo'
import { ProfileMenu } from '../ProfileMenu/ProfileMenu'

export type HeaderVariant = 'light' | 'dark'

export interface HeaderProps {
  variant?: HeaderVariant
  user?: any
  onNavigateToAccount?: () => void
  onLogout?: () => void
  onLogoClick?: () => void
  showLogo?: boolean
  children?: React.ReactNode
  className?: string
}

export function Header({
  variant = 'light',
  user,
  onNavigateToAccount,
  onLogout,
  onLogoClick,
  showLogo = true,
  children,
  className = ''
}: HeaderProps) {
  const classes = ['ui-header', `ui-header--${variant}`, className].filter(Boolean).join(' ')

  return (
    <header className={classes}>
      {showLogo && (
        <Logo variant={variant} size="medium" onClick={onLogoClick} />
      )}

      {children}

      {user && onNavigateToAccount && onLogout ? (
        <ProfileMenu
          variant={variant}
          onNavigateToAccount={onNavigateToAccount}
          onLogout={onLogout}
        />
      ) : (
        <button className="ui-header-profile-btn">
          <svg width="25" height="25" viewBox="0 0 25 25" fill="none">
            <circle cx="12.5" cy="8" r="4" stroke={variant === 'light' ? 'white' : '#372579'} strokeWidth="2" />
            <path
              d="M5 20C5 16 8 13 12.5 13C17 13 20 16 20 20"
              stroke={variant === 'light' ? 'white' : '#372579'}
              strokeWidth="2"
            />
          </svg>
        </button>
      )}
    </header>
  )
}



