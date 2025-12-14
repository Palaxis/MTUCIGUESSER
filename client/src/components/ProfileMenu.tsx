import React, { useState, useRef, useEffect } from 'react'
import './ProfileMenu.css'

interface ProfileMenuProps {
  onNavigateToAccount: () => void
  onLogout: () => void
}

export default function ProfileMenu({ onNavigateToAccount, onLogout }: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isOpen])

  return (
    <div className="profile-menu-container" ref={menuRef}>
      <button 
        className="profile-menu-btn" 
        onClick={() => setIsOpen(!isOpen)}
      >
        <svg width="25" height="25" viewBox="0 0 25 25" fill="none">
          <circle cx="12.5" cy="8" r="4" stroke="#372579" strokeWidth="2"/>
          <path d="M5 20C5 16 8 13 12.5 13C17 13 20 16 20 20" stroke="#372579" strokeWidth="2"/>
        </svg>
      </button>

      {isOpen && (
        <div className="profile-menu-dropdown">
          <div className="profile-menu-arrow"></div>
          <button 
            className="profile-menu-item profile-menu-item-account" 
            onClick={(e) => {
              e.stopPropagation()
              setIsOpen(false)
              onNavigateToAccount()
            }}
          >
            Аккаунт
          </button>
          <button 
            className="profile-menu-item profile-menu-item-logout" 
            onClick={(e) => {
              e.stopPropagation()
              setIsOpen(false)
              onLogout()
            }}
          >
            Выйти
          </button>
        </div>
      )}
    </div>
  )
}





