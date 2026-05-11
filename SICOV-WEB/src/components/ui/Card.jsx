import { clsx } from 'clsx';

export function Card({ children, className, ...props }) {
  return (
    <div
      className={clsx(
        'bg-white rounded-xl border border-[#e3e3d1] shadow-sm',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }) {
  return (
    <div className={clsx('px-6 py-4 border-b border-[#e3e3d1]', className)}>
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
