import React from 'react'
import './Logo.css'

export type LogoVariant = 'light' | 'dark'
export type LogoSize = 'small' | 'medium' | 'large'

export interface LogoProps {
  variant?: LogoVariant
  size?: LogoSize
  showText?: boolean
  onClick?: () => void
  className?: string
}

export function Logo({
  variant = 'dark',
  size = 'medium',
  showText = true,
  onClick,
  className = ''
}: LogoProps) {
  const logoSrc = variant === 'light' ? '/mtuci-logo-white.svg' : '/mtuci-logo-darkblue.svg'

  const classes = [
    'ui-logo',
    `ui-logo--${size}`,
    `ui-logo--${variant}`,
    onClick && 'ui-logo--clickable',
    className
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} onClick={onClick}>
      <img src={logoSrc} alt="MTUCI" className="ui-logo-icon" />
      {showText && <h1 className="ui-logo-text">MTUCI Guesser</h1>}
    </div>
  )
}


