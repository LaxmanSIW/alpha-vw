import Icon, { type IconName } from '../Icon'

interface IconButtonProps {
  icon: IconName
  /** Required: an icon-only control is unlabelled to a screen reader, and this
   * doubles as the native tooltip. */
  title: string
  onClick?: () => void
  active?: boolean
  disabled?: boolean
}

/**
 * Square icon button sized from --icon-btn so it retunes with the density
 * toggle. Hover is a flat surface tone step and the active state is a solid
 * fill -- there is no shadow or radius available to signal pressed-ness.
 */
function IconButton({ icon, title, onClick, active = false, disabled = false }: IconButtonProps) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex shrink-0 items-center justify-center border border-transparent',
        'size-icon-btn',
        'transition-colors duration-75',
        disabled
          ? 'cursor-not-allowed text-text-muted opacity-40'
          : active
            ? 'border-primary bg-primary text-text-inverse'
            : 'text-text-secondary hover:border-border-strong hover:bg-surface-hover hover:text-text',
      ].join(' ')}
    >
      <Icon name={icon} />
    </button>
  )
}

export default IconButton
