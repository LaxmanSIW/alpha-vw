'use client'

import { type SelectHTMLAttributes, forwardRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  isRequired?: boolean
  infoTooltip?: { description: string; codeUsage?: string }
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, isRequired, infoTooltip, id, children, ...rest }, ref) => {
    const selectId = id || `select-${label?.replace(/\s+/g, '-').toLowerCase()}`
    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <div className="flex items-center justify-between">
            <label htmlFor={selectId} className="text-[11px] font-medium text-text-muted flex items-center gap-1">
              <span>{label}</span>
              {isRequired && <span className="text-danger-fg font-bold" title="Required field">*</span>}
            </label>
            {infoTooltip && (
              <div className="relative group flex items-center">
                <span className="cursor-help text-[10px] font-semibold text-primary/80 bg-primary/10 hover:bg-primary/20 rounded-full px-1.5 py-0.2">
                  i
                </span>
                <div className="absolute right-0 top-6 z-50 hidden group-hover:block w-64 p-2.5 bg-surface-sunken border border-border rounded shadow-xl text-[11px] text-text space-y-1.5 pointer-events-none">
                  <div>
                    <strong className="text-primary block text-[10px] uppercase tracking-wider font-mono">Purpose</strong>
                    <p className="text-text-secondary leading-tight">{infoTooltip.description}</p>
                  </div>
                  {infoTooltip.codeUsage && (
                    <div>
                      <strong className="text-primary block text-[10px] uppercase tracking-wider font-mono">Codebase Usage</strong>
                      <p className="text-text-muted text-[10px] leading-tight font-mono">{infoTooltip.codeUsage}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
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
