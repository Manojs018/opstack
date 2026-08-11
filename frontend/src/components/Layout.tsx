import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  FileSpreadsheet,
  Receipt,
  PhoneCall,
  LogOut,
  Menu,
  X,
  User,
  Activity,
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const rawUser = localStorage.getItem('user');
  const user = rawUser ? JSON.parse(rawUser) : null;
  const role = user?.role || 'SALES';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const navItems = [
    {
      name: 'Dashboard',
      path: '/',
      icon: LayoutDashboard,
      roles: ['ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'],
    },
    {
      name: 'Customers (CRM)',
      path: '/customers',
      icon: Users,
      roles: ['ADMIN', 'SALES', 'ACCOUNTS'], // Accounts read-only
    },
    {
      name: 'Products & Stock',
      path: '/products',
      icon: Package,
      roles: ['ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'],
    },
    {
      name: 'Stock Movement Log',
      path: '/stock-movements',
      icon: Activity,
      roles: ['ADMIN', 'WAREHOUSE', 'ACCOUNTS'],
    },
    {
      name: 'Purchase Orders',
      path: '/purchase-orders',
      icon: ShoppingCart,
      roles: ['ADMIN', 'WAREHOUSE', 'ACCOUNTS'], // Accounts read-only, Warehouse manage
    },
    {
      name: 'Sales Challans',
      path: '/sales-challans',
      icon: FileSpreadsheet,
      roles: ['ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'], // Warehouse dispatches, accounts views, sales creates
    },
    {
      name: 'Invoices',
      path: '/invoices',
      icon: Receipt,
      roles: ['ADMIN', 'ACCOUNTS', 'SALES'], // Sales view, accounts manage
    },
    {
      name: 'CRM Follow-ups',
      path: '/followups',
      icon: PhoneCall,
      roles: ['ADMIN', 'SALES'], // Only Admin & Sales
    },
  ];

  const allowedNavItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <div className="min-h-screen flex bg-zinc-950 text-zinc-100">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-zinc-900/50 border-r border-zinc-800 p-4 shrink-0 justify-between">
        <div>
          {/* Logo / Brand */}
          <div className="flex items-center space-x-2 px-3 py-4 mb-6">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30">
              Ω
            </div>
            <span className="font-bold text-lg bg-gradient-to-r from-indigo-450 to-indigo-300 bg-clip-text text-transparent">
              Operations Portal
            </span>
          </div>

          {/* Nav Links */}
          <nav className="space-y-1">
            {allowedNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive
                      ? 'bg-indigo-600/90 text-white shadow-lg shadow-indigo-600/20'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
                    }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User profile & Logout */}
        <div className="border-t border-zinc-800 pt-4 space-y-4">
          <div className="flex items-center space-x-3 px-3">
            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 text-zinc-300">
              <User className="w-5 h-5" />
            </div>
            <div className="truncate">
              <p className="text-sm font-semibold text-zinc-200 truncate">{user?.name || 'User'}</p>
              <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/25">
                {role}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-rose-450 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header & Sidebar */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between h-16 bg-zinc-900 border-b border-zinc-800 px-4 shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30">
              Ω
            </div>
            <span className="font-bold text-lg bg-gradient-to-r from-indigo-400 to-indigo-300 bg-clip-text text-transparent">
              Ops Portal
            </span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg"
          >
            <Menu className="w-6 h-6" />
          </button>
        </header>

        {/* Mobile Menu Backdrop & Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            {/* Content drawer */}
            <div className="relative flex flex-col w-64 bg-zinc-900 border-r border-zinc-800 p-4 justify-between h-full z-10 animate-in slide-in-from-left duration-250">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-2 px-1">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30">
                      Ω
                    </div>
                    <span className="font-bold text-lg bg-gradient-to-r from-indigo-450 to-indigo-300 bg-clip-text text-transparent">
                      Ops Portal
                    </span>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <nav className="space-y-1">
                  {allowedNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.name}
                        to={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive
                            ? 'bg-indigo-600/90 text-white shadow-lg shadow-indigo-600/20'
                            : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                          }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>

              <div className="border-t border-zinc-800 pt-4 space-y-4">
                <div className="flex items-center space-x-3 px-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 text-zinc-300">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-200">{user?.name || 'User'}</p>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/25">
                      {role}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-rose-450 hover:bg-rose-500/10 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto p-4 md:p-8 bg-zinc-950">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
