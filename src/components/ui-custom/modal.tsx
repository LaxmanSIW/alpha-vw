'use client'

import { type ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  children: ReactNode
  footer?: ReactNode
  hideCloseButton?: boolean
}

const SIZE_MAP: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
  '2xl': 'sm:max-w-6xl',
}

export default function Modal({
  open,
  onOpenChange,
  title,
  description,
  size = 'md',
  children,
  footer,
  hideCloseButton = false,
}: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          // Override shadcn defaults to use our enterprise tokens (flat, no shadow, no radius)
          'bg-surface text-text border border-border-strong p-0 gap-0',
          'max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col',
          SIZE_MAP[size],
        )}
        showCloseButton={false}
      >
        <DialogHeader className="px-4 py-3 border-b border-border shrink-0">
          <DialogTitle className="text-sm font-semibold text-text">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-xs text-text-muted mt-0.5">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto">
          {children}
        </div>

        {footer && (
          <div className="px-4 py-3 border-t border-border shrink-0 flex items-center justify-end gap-2">
            {footer}
          </div>
        )}

        {!hideCloseButton && (
          <DialogClose
            aria-label="Close"
            className="absolute top-3 right-3 inline-flex items-center justify-center size-6 text-text-muted hover:text-text hover:bg-surface-hover"
          >
            <X size={14} strokeWidth={1.5} />
          </DialogClose>
        )}
      </DialogContent>
    </Dialog>
  )
}
