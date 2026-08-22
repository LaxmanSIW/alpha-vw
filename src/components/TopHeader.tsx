import { useState } from 'react'
import Icon from './Icon'
import IconButton from './ui/IconButton'
import type { DensityName, ModuleTab, ThemeName } from '../types'

interface TopHeaderProps {
  modules: ModuleTab[]
  activeModuleId: string
  onModuleChange: (id: string) => void
  theme: ThemeName
  onThemeToggle: () => void
  density: DensityName
  onDensityToggle: () => void
  onOpenAdmin?: () => void
  onOpenCalendars?: () => void
  onOpenSchedules?: () => void
}

/**
 * Application header: identity on the left, module-level navigation beside it.
 *
 * These tabs are the outer of two navigation levels -- switching one swaps the
 * entire viewpoint set in the bar below. They use an underline indicator rather
 * than a filled pill because a pill needs a radius to not look like a crude
 * block, and radius is unavailable.
 */
function TopHeader({
  modules,
  activeModuleId,
  onModuleChange,
  theme,
  onThemeToggle,
  density,
  onDensityToggle,
  onOpenAdmin,
  onOpenCalendars,
  onOpenSchedules,
}: TopHeaderProps) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)

  return (
    <header className="flex h-header shrink-0 items-stretch border-b border-border bg-surface">
      <div className="flex items-center gap-2 pr-4 pl-3">
        {/* Logo mark: overlapping squares, deliberately sharp-cornered */}
        <span aria-hidden="true" className="relative block size-4 shrink-0">
          <span className="absolute top-0 left-0 size-3 bg-primary" />
          <span className="absolute right-0 bottom-0 size-3 bg-accent" />
        </span>
        <span className="text-base font-semibold tracking-tight whitespace-nowrap text-text">
          Alpha VW
        </span>
      </div>

      <nav aria-label="Modules" className="flex items-stretch">
        {modules.map((module) => {
          const isActive = module.id === activeModuleId
          return (
            <button
              key={module.id}
              type="button"
              onClick={() => onModuleChange(module.id)}
              aria-current={isActive ? 'page' : undefined}
              className={[
                'px-3 text-sm transition-colors duration-75',
                isActive
                  ? 'border-b-2 border-primary font-semibold text-text'
                  : 'text-text-secondary hover:text-text',
              ].join(' ')}
            >
              {module.label}
            </button>
          )
        })}
      </nav>

      <div className="flex-1" />

      <div className="flex items-center gap-1.5 px-3">
        <IconButton
          icon="theme"
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          onClick={onThemeToggle}
          active={theme === 'dark'}
        />
        <IconButton
          icon="density"
          title={`Switch to ${
            density === 'compact' ? 'comfortable' : 'compact'
          } density`}
          onClick={onDensityToggle}
          active={density === 'comfortable'}
        />
        <span className="mx-1 h-4 w-px bg-border" />

        {/* Profile / Account Dropdown Trigger */}
        <div className="relative">
          <button
            type="button"
            title="Account Menu"
            onClick={() => setAccountMenuOpen((prev) => !prev)}
            className="flex items-center gap-1.5 px-2 py-1 text-sm text-text-secondary hover:bg-surface-hover hover:text-text transition-colors border border-transparent hover:border-border"
          >
            <span className="flex size-5 items-center justify-center bg-primary text-xs font-semibold text-white">
              LD
            </span>
            <span className="text-xs font-medium text-text">User / LD</span>
            <Icon name="chevron-down" size={12} />
          </button>

          {/* Profile Dropdown Menu */}
          {accountMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setAccountMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-50 w-60 border border-border bg-surface shadow-lg text-text py-1 text-xs divide-y divide-border">
                <div className="px-3 py-2 bg-surface-sunken">
                  <p className="font-semibold text-text">Lead Developer (LD)</p>
                  <p className="text-text-muted text-[11px]">admin@alphavw.io</p>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false)
                      onOpenCalendars?.()
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover text-text font-medium"
                  >
                    <Icon name="calendar" size={14} className="text-primary" />
                    <span>Calendar Manager (RBC)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false)
                      onOpenSchedules?.()
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover text-text font-medium"
                  >
                    <Icon name="calendar" size={14} className="text-accent" />
                    <span>Schedule Manager</span>
                  </button>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false)
                      onOpenAdmin?.()
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover text-primary font-semibold"
                  >
                    <Icon name="settings" size={14} />
                    <span>Admin Database Panel</span>
                  </button>
                </div>

                <div className="border-t border-border my-1" />

                <div className="px-3 py-1.5 text-text-muted text-[11px]">
                  Role: Administrator
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export default TopHeader
