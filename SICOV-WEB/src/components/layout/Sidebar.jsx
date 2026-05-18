import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  BarChart3,
  ShoppingCart,
  FileText,
  Users,
  Package,
  Truck,
  DollarSign,
  Settings,
  LogOut,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

const navItems = [
  { to: '/',            label: 'Início',       icon: LayoutDashboard },
  { to: '/dashboard',   label: 'Dashboard',    icon: BarChart3 },
  { to: '/orders',      label: 'Pedidos',      icon: ShoppingCart },
  { to: '/quotations',  label: 'Orçamentos',   icon: FileText },
  { to: '/commissions', label: 'Comissões',    icon: DollarSign },
  { to: '/clients',     label: 'Clientes',     icon: Users },
  { to: '/products',    label: 'Produtos',     icon: Package },
  { to: '/suppliers',   label: 'Fornecedores', icon: Truck, adminOnly: true },
  { to: '/users',       label: 'Representantes', icon: Users, adminOnly: true },
  { to: '/settings',    label: 'Configurações', icon: Settings, adminOnly: true },
];

export function Sidebar({ open, onClose }) {
  const { user, logout, isAdmin } = useAuth();
  const { isDark } = useTheme();

  const items = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <>
      {/* Overlay mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={clsx(
          'fixed top-0 left-0 h-full w-64 z-30 flex flex-col',
          'text-white transition-transform duration-300',
          'lg:translate-x-0 lg:static lg:z-auto',
          isDark ? 'bg-[#1a1f1e]' : 'bg-[#4b5757]',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo */}
        <div className={clsx(
          'flex items-center justify-between px-6 py-5 border-b',
          isDark ? 'border-[#3d4543]' : 'border-white/10',
        )}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#58706d] flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="text-xl font-bold tracking-wide">SICOV</span>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-white/60 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {items.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? isDark ? 'bg-[#58706d]/30 text-[#a8d4a0]' : 'bg-white/15 text-white'
                        : isDark ? 'text-[#9cb3a0] hover:bg-[#58706d]/20 hover:text-[#d4e4d1]' : 'text-white/70 hover:bg-white/10 hover:text-white',
                    )
                  }
                >
                  <Icon size={18} />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* User info + logout */}
        <div className={clsx(
          'px-4 py-4 border-t',
          isDark ? 'border-[#3d4543]' : 'border-white/10',
        )}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-[#7c8a6e] flex items-center justify-center text-sm font-bold">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className={clsx('text-xs capitalize', isDark ? 'text-[#6b8a6e]' : 'text-white/50')}>{user?.profile}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className={clsx(
              'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors',
              isDark ? 'text-[#9cb3a0] hover:bg-[#58706d]/20 hover:text-[#d4e4d1]' : 'text-white/70 hover:bg-white/10 hover:text-white',
            )}
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
