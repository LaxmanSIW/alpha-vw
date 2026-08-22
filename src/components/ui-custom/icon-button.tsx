'use client'

import { forwardRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface IconButtonProps {
  icon: LucideIcon
  title: string
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  size?: number
  className?: string
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon: Icon, title, onClick, active = false, disabled = false, size = 14, className }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        title={title}
        aria-label={title}
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center border border-transparent rounded transition-colors',
          'h-[var(--icon-btn)] w-[var(--icon-btn)]',
          active
            ? 'bg-primary/10 text-primary'
            : 'bg-transparent text-text hover:bg-surface-hover',
          disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent',
          className,
        )}
      >
        <Icon size={size} strokeWidth={1.5} />
      </button>
    )
  },
)
IconButton.displayName = 'IconButton'

export default IconButton
