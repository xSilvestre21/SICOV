import { Construction } from 'lucide-react';

export function PlaceholderPage({ title }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#e3e3d1] flex items-center justify-center">
        <Construction size={28} className="text-[#7c8a6e]" />
      </div>
      <div>
        <h1 className="text-xl font-bold text-[#4b5757]">{title}</h1>
        <p className="text-sm text-[#7c8a6e] mt-1">Esta página está em desenvolvimento.</p>
      </div>
    </div>
  );
}
