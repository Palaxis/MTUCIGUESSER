import React from 'react'
import './Input.css'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  fullWidth?: boolean
}

export function Input({
  label,
  error,
  fullWidth = true,
  className = '',
  ...props
}: InputProps) {
  const classes = [
    'ui-input',
    fullWidth && 'ui-input--full-width',
    error && 'ui-input--error',
    className
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="ui-input-wrapper">
      {label && <label className="ui-input-label">{label}</label>}
      <input className={classes} {...props} />
      {error && <div className="ui-input-error">{error}</div>}
    </div>
  )
}


