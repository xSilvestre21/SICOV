import { clsx } from 'clsx';

export function Input({ label, error, className, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-[#4b5757]">{label}</label>
      )}
      <input
        className={clsx(
          'w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors',
          'bg-white placeholder:text-gray-400',
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500'
            : 'border-[#b0b087] focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d]',
          'disabled:bg-[#e3e3d1] disabled:cursor-not-allowed',
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
