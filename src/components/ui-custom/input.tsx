'use client'

import { type InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, id, ...rest }, ref) => {
    const inputId = id || `input-${label?.replace(/\s+/g, '-').toLowerCase()}`
    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <label htmlFor={inputId} className="text-[11px] font-medium text-text-muted">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full h-[var(--control-h)] px-2 text-xs bg-surface border border-border-strong text-text',
            'placeholder:text-text-muted',
            'focus:border-primary focus:outline-none',
            error && 'border-danger-fg',
            className,
          )}
          {...rest}
        />
        {hint && !error && <p className="text-[10px] text-text-muted">{hint}</p>}
        {error && <p className="text-[10px] text-danger-fg">{error}</p>}
      </div>
    )
  },
)
Input.displayName = 'Input'

export default Input
