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
}: TopHeaderProps) {
  return (
    <header className="flex h-header shrink-0 items-stretch border-b border-border bg-surface">
      <div className="flex items-center gap-2 pr-4 pl-3">
        {/* Logo mark: overlapping squares, deliberately sharp-cornered. Swap for
            the real asset when there is one -- keep it square-edged. */}
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
              // Selection and hover change text color only -- no underline, no
              // fill, no border. Nothing about the module tab's box may move or
              // gain an edge, so the header stays a single unbroken band.
              className={[
                'px-3 text-sm transition-colors duration-75',
                isActive
                  ? 'font-medium text-primary'
                  : 'text-text-secondary hover:text-text',
              ].join(' ')}
            >
              {module.label}
            </button>
          )
        })}
      </nav>

      <div className="flex-1" />

      <div className="flex items-center gap-0.5 pr-2">
        <IconButton
          icon="theme"
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          onClick={onThemeToggle}
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
        <button
          type="button"
          title="Account"
          className="flex items-center gap-1.5 px-1.5 text-sm text-text-secondary hover:bg-surface-hover hover:text-text"
        >
          <span className="flex size-5 items-center justify-center bg-surface-sunken text-xs font-semibold text-text-secondary">
            LD
          </span>
          <Icon name="chevron-down" size={12} />
        </button>
      </div>
    </header>
  )
}

export default TopHeader
