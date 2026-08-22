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
  sm: 'w-[calc(100vw-3rem)] sm:max-w-xl h-[calc(100vh-3rem)] max-h-[calc(100vh-3rem)]',
  md: 'w-[calc(100vw-3rem)] sm:max-w-3xl h-[calc(100vh-3rem)] max-h-[calc(100vh-3rem)]',
  lg: 'w-[calc(100vw-3rem)] sm:max-w-5xl h-[calc(100vh-3rem)] max-h-[calc(100vh-3rem)]',
  xl: 'w-[calc(100vw-3rem)] sm:max-w-[calc(100vw-3rem)] h-[calc(100vh-3rem)] max-h-[calc(100vh-3rem)]',
  '2xl': 'w-[calc(100vw-3rem)] sm:max-w-[calc(100vw-3rem)] h-[calc(100vh-3rem)] max-h-[calc(100vh-3rem)]',
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
          // Enterprise full-viewport modal layout with uniform 1.5rem margin — maintains static dimensions across tab switches
          'bg-surface text-text border border-border-strong p-0 gap-0',
          'w-[calc(100vw-3rem)] h-[calc(100vh-3rem)] max-w-[calc(100vw-3rem)] max-h-[calc(100vh-3rem)] overflow-hidden flex flex-col',
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
