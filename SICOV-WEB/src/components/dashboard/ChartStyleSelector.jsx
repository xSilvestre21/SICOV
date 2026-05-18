import { clsx } from 'clsx';

/**
 * ChartStyleSelector — reusable component that renders icon buttons
 * for switching between available chart styles without triggering data re-fetch.
 *
 * @param {Object} props
 * @param {Array<{id: string, label: string, icon: React.ElementType}>} props.styles
 *   Available chart styles. Each object must have an `id`, a `label` (used for
 *   accessibility/tooltip), and an `icon` (a Lucide icon component or any React component).
 * @param {string} props.activeStyle - The `id` of the currently active style.
 * @param {(styleId: string) => void} props.onChange - Callback invoked with the new
 *   style id when the user selects a different style. Does NOT trigger data re-fetch.
 * @param {string} [props.className] - Optional additional class names for the container.
 */
export function ChartStyleSelector({ styles, activeStyle, onChange, className }) {
  return (
    <div
      className={clsx(
        'inline-flex items-center gap-1 rounded-lg bg-[#e3e3d1]/50 p-1',
        className,
      )}
      role="group"
      aria-label="Seletor de estilo de gráfico"
    >
      {styles.map(({ id, label, icon: Icon }) => {
        const isActive = id === activeStyle;

        return (
          <button
            key={id}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={isActive}
            onClick={() => {
              if (!isActive) {
                onChange(id);
              }
            }}
            className={clsx(
              'inline-flex items-center justify-center rounded-md p-1.5',
              'transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58706d] focus-visible:ring-offset-1',
              isActive
                ? 'bg-[#58706d] text-white shadow-sm'
                : 'text-[#4b5757] hover:bg-[#e3e3d1]',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
