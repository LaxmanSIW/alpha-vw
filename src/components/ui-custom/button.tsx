'use client'

import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover border border-primary',
  secondary: 'bg-surface text-text border border-border-strong hover:bg-surface-hover',
  ghost: 'bg-transparent text-text border border-transparent hover:bg-surface-hover',
  danger: 'bg-danger-fg text-text-inverse hover:bg-danger-fg/90 border border-danger-fg',
}

const SIZES: Record<Size, string> = {
  sm: 'h-[var(--control-h)] px-2 text-xs',
  md: 'h-[var(--control-h)] px-3 text-xs',
  lg: 'h-9 px-4 text-sm',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'md', disabled, ...rest }, ref) => (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-[var(--focus)] focus-visible:outline-offset-1',
        VARIANTS[variant],
        SIZES[size],
        disabled && 'opacity-40 cursor-not-allowed',
        className,
      )}
      {...rest}
    />
  ),
)
Button.displayName = 'Button'

export default Button
