import { useEffect, useRef, useState } from 'react'
import Icon from '../Icon'

export interface DropdownOption {
  id: string
  label: string
}

interface DropdownProps {
  label: string
  options: DropdownOption[]
  selectedId?: string
  onSelect?: (id: string) => void
}

/**
 * Flat dropdown. The menu is a solid surface with a strong border and no
 * shadow -- separation from the content beneath comes from the opaque fill plus
 * the 1px edge, which is the shadowless substitute for elevation.
 */
function Dropdown({ label, options, selectedId, onSelect }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Close on outside click and on Escape. Without a backdrop element to catch
  // clicks (a backdrop would need a scrim, which is too heavy for a menu),
  // a document listener is the way to do this.
  useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as globalThis.Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={[
          'inline-flex h-control items-center gap-1.5 border px-2 text-sm',
          'transition-colors duration-75',
          open
            ? 'border-border-strong bg-surface-hover text-text'
            : 'border-border-strong bg-surface text-text-secondary hover:bg-surface-hover hover:text-text',
        ].join(' ')}
      >
        <span>{label}</span>
        <Icon name="chevron-down" size={12} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-px min-w-44 border border-border-strong bg-surface py-0.5"
        >
          {options.map((option) => {
            const isSelected = option.id === selectedId
            return (
              <button
                key={option.id}
                type="button"
                role="menuitemradio"
                aria-checked={isSelected}
                onClick={() => {
                  onSelect?.(option.id)
                  setOpen(false)
                }}
                className={[
                  'flex w-full items-center justify-between gap-3 px-2.5 text-left text-sm',
                  'h-row transition-colors duration-75',
                  isSelected
                    ? 'bg-surface-selected font-medium text-text'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text',
                ].join(' ')}
              >
                <span>{option.label}</span>
                {/* A 2px bar rather than a checkmark glyph: it aligns with the
                    active-tab indicator used elsewhere, so "selected" looks the
                    same everywhere in the app. */}
                {isSelected && <span className="h-3 w-0.5 bg-primary" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Dropdown
