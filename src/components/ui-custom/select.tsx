'use client'

import { type SelectHTMLAttributes, forwardRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, id, children, ...rest }, ref) => {
    const selectId = id || `select-${label?.replace(/\s+/g, '-').toLowerCase()}`
    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <label htmlFor={selectId} className="text-[11px] font-medium text-text-muted">
            {label}
          </label>
        )}
        <div className="relative w-full">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              'w-full h-[var(--control-h)] pl-2 pr-7 text-xs bg-surface border border-border-strong text-text appearance-none',
              'focus:border-primary focus:outline-none',
              className,
            )}
            {...rest}
          >
            {children}
          </select>
          <ChevronDown size={12} strokeWidth={1.5} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted" />
        </div>
      </div>
    )
  },
)
Select.displayName = 'Select'

export default Select
