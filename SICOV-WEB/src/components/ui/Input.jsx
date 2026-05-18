import { clsx } from 'clsx';
import { useTheme } from '../../contexts/ThemeContext';

export function Input({ label, error, className, ...props }) {
  const { isDark } = useTheme();

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className={`text-sm font-medium ${isDark ? 'text-[#d4e4d1]' : 'text-[#4b5757]'}`}>{label}</label>
      )}
      <input
        className={clsx(
          'w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors',
          isDark
            ? 'bg-[#1e2322] text-[#d4e4d1] placeholder:text-[#6b8a6e] border-[#3d4543] focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d] disabled:bg-[#2a2f2e] disabled:cursor-not-allowed'
            : 'bg-white text-[#4b5757] placeholder:text-gray-400 border-[#b0b087] focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d] disabled:bg-[#e3e3d1] disabled:cursor-not-allowed',
          error && 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500',
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
