import { clsx } from 'clsx';
import { useTheme } from '../../contexts/ThemeContext';

export function Card({ children, className, ...props }) {
  const { isDark } = useTheme();
  return (
    <div
      className={clsx(
        'rounded-xl border shadow-sm',
        isDark
          ? 'bg-[#2a2f2e] border-[#3d4543]'
          : 'bg-white border-[#e3e3d1]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }) {
  const { isDark } = useTheme();
  return (
    <div className={clsx(
      'px-6 py-4 border-b',
      isDark ? 'border-[#3d4543]' : 'border-[#e3e3d1]',
      className,
    )}>
      {children}
    </div>
  );
}

export function CardBody({ children, className }) {
  return (
    <div className={clsx('px-6 py-4', className)}>
      {children}
    </div>
  );
}
