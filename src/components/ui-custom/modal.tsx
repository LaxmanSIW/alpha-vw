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
  fullScreen?: boolean
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
  fullScreen = true,
}: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          // Enterprise flat design system — supports full screen dashboard layout or content-fit forms
          'bg-surface text-text border border-border-strong p-0 gap-0 overflow-hidden flex flex-col',
          fullScreen ? [
            'w-[calc(100vw-3rem)] h-[calc(100vh-3rem)] max-w-[calc(100vw-3rem)] max-h-[calc(100vh-3rem)]',
            size === 'sm' && 'sm:max-w-xl',
            size === 'md' && 'sm:max-w-3xl',
            size === 'lg' && 'sm:max-w-5xl',
            size === 'xl' && 'sm:max-w-[calc(100vw-3rem)]',
            size === '2xl' && 'sm:max-w-[calc(100vw-3rem)]',
          ] : [
            'w-[calc(100vw-3rem)] h-auto max-h-[85vh]',
            size === 'sm' && 'sm:max-w-xl',
            size === 'md' && 'sm:max-w-3xl',
            size === 'lg' && 'sm:max-w-5xl',
            size === 'xl' && 'sm:max-w-6xl',
            size === '2xl' && 'sm:max-w-7xl',
          ]
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
