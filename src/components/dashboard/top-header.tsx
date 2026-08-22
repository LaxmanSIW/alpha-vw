'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Database,
  Calendar,
  Clock,
  Moon,
  Sun,
  PanelsTopLeft,
  Rows3,
  ChevronDown,
  LogOut,
  User,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useUIStore } from '@/lib/stores/ui-store'
import { useDashboardStore } from '@/lib/stores/dashboard-store'
import type { ModuleTab } from '@/lib/types'
import { cn } from '@/lib/utils'

interface TopHeaderProps {
  modules: ModuleTab[]
  activeModuleId: string
  onModuleChange: (id: string) => void
}

export default function TopHeader({ modules, activeModuleId, onModuleChange }: TopHeaderProps) {
  const theme = useUIStore((s) => s.theme)
  const density = useUIStore((s) => s.density)
  const toggleTheme = useUIStore((s) => s.toggleTheme)
  const toggleDensity = useUIStore((s) => s.toggleDensity)
  const openAdmin = useUIStore((s) => s.openAdmin)
  const openCalendarManager = useUIStore((s) => s.openCalendarManager)
  const openScheduleManager = useUIStore((s) => s.openScheduleManager)

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    window.addEventListener('pointerdown', handler)
    return () => window.removeEventListener('pointerdown', handler)
  }, [menuOpen])

  const ThemeIcon: LucideIcon = theme === 'light' ? Sun : Moon

  return (
    <header className="flex h-[var(--header-h)] shrink-0 items-center justify-between border-b border-border bg-surface px-3">
      {/* Left: brand + modules */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-1.5 pr-3 border-r border-border">
          <div className="size-5 bg-primary text-primary-foreground flex items-center justify-center font-semibold text-xs">
            α
          </div>
          <span className="font-semibold text-sm tracking-tight text-text">Alpha VW</span>
        </div>

        <nav aria-label="Modules" className="flex items-center gap-0.5">
          {modules.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onModuleChange(m.id)}
              className={cn(
                'px-2.5 h-[var(--control-h)] text-xs font-medium transition-colors',
                m.id === activeModuleId
                  ? 'bg-primary/10 text-primary border border-primary/30'
                  : 'text-text-muted hover:text-text hover:bg-surface-hover border border-transparent',
              )}
            >
              {m.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Right: tools + user */}
      <div className="flex items-center gap-1">
        <ToolButton icon={Database} title="Database Admin" onClick={openAdmin} />
        <ToolButton icon={Calendar} title="Calendars" onClick={openCalendarManager} />
        <ToolButton icon={Clock} title="Schedule Configurations" onClick={openScheduleManager} />
        <div className="w-px h-5 bg-border mx-1" aria-hidden />
        <ToolButton
          icon={density === 'compact' ? Rows3 : PanelsTopLeft}
          title={`Density: ${density}. Click to toggle.`}
          onClick={toggleDensity}
        />
        <ToolButton icon={ThemeIcon} title={`Theme: ${theme}. Click to toggle.`} onClick={toggleTheme} />

        <div className="w-px h-5 bg-border mx-1" aria-hidden />

        {/* Account dropdown */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 h-[var(--control-h)] px-2 hover:bg-surface-hover transition-colors"
          >
            <div className="size-5 bg-accent text-text-inverse flex items-center justify-center font-semibold text-[10px]">
              LD
            </div>
            <span className="text-xs font-medium text-text">LD</span>
            <ChevronDown size={12} strokeWidth={1.5} className="text-text-muted" />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-1 w-56 border border-border-strong bg-surface py-1 z-50"
            >
              <div className="px-3 py-2 border-b border-border">
                <div className="text-xs font-semibold text-text">Lead Developer (LD)</div>
                <div className="text-[11px] text-text-muted">admin@alphavw.io</div>
                <div className="text-[10px] text-text-muted mt-0.5">Administrator</div>
              </div>
              <button
                role="menuitem"
                type="button"
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text hover:bg-surface-hover"
              >
                <User size={12} strokeWidth={1.5} />
                Profile
              </button>
              <button
                role="menuitem"
                type="button"
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text hover:bg-surface-hover"
              >
                <LogOut size={12} strokeWidth={1.5} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function ToolButton({
  icon: Icon,
  title,
  onClick,
}: {
  icon: LucideIcon
  title: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="inline-flex items-center justify-center h-[var(--icon-btn)] w-[var(--icon-btn)] text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
    >
      <Icon size={14} strokeWidth={1.5} />
    </button>
  )
}
