import React from 'react'
import './Card.css'

export interface CardProps {
  children: React.ReactNode
  title?: string
  className?: string
}

export function Card({ children, title, className = '' }: CardProps) {
  const classes = ['ui-card', className].filter(Boolean).join(' ')

  return (
    <div className={classes}>
      {title && <h2 className="ui-card-title">{title}</h2>}
      {children}
    </div>
  )
}



