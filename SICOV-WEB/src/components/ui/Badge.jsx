import { clsx } from 'clsx';

const variants = {
  active:    'bg-emerald-100 text-emerald-700',
  inactive:  'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-100 text-red-600',
  pending:   'bg-amber-100 text-amber-700',
  sent:      'bg-blue-100 text-blue-700',
  default:   'bg-[#e3e3d1] text-[#4b5757]',
};

export function Badge({ children, variant = 'default', className }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        variants[variant] ?? variants.default,
        className,
      )}
    >
      {children}
    </span>
  );
}
