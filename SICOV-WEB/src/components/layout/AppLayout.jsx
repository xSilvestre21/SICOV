import { useState, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { useTheme } from '../../contexts/ThemeContext';

function PageLoader() {
  return <div className="flex items-center justify-center h-32"><div className="animate-spin w-6 h-6 border-2 border-[#58706d] border-t-transparent rounded-full" /></div>;
}

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isDark } = useTheme();

  return (
    <div className={`flex h-dvh overflow-hidden ${isDark ? 'bg-[#1e2322]' : 'bg-[#f5f5ee]'}`}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar mobile */}
        <header className={`lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 py-3 border-b shrink-0 ${isDark ? 'bg-[#2a2f2e] border-[#3d4543]' : 'bg-white border-[#e3e3d1]'}`}>
          <button
            onClick={() => setSidebarOpen(true)}
            className={isDark ? 'text-[#d4e4d1] hover:text-white' : 'text-[#4b5757] hover:text-[#58706d]'}
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-[#58706d] flex items-center justify-center">
              <span className="text-white font-bold text-xs">S</span>
            </div>
            <span className={`font-bold ${isDark ? 'text-[#d4e4d1]' : 'text-[#4b5757]'}`}>SICOV</span>
          </div>
        </header>

        {/* Conteúdo da página */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
