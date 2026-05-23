'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  PlusCircle,
  CreditCard,
  Target,
  Users,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

interface SidebarLayoutProps {
  children: React.ReactNode;
}

export default function SidebarLayout({ children }: SidebarLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const pathname = usePathname();
  const { signOut, user } = useAuth();

  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved === 'true') {
      setIsCollapsed(true);
    }
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'Entradas', icon: TrendingUp, path: '/entradas' },
    { name: 'Saídas', icon: TrendingDown, path: '/saidas' },
    { name: 'Investimentos', icon: Wallet, path: '/investimentos' },
    { name: 'Cadastros', icon: PlusCircle, path: '/cadastros' },
  ];

  const NavContent = ({ forceExpand = false }: { forceExpand?: boolean }) => {
    // Only collapse if we are mounted and isCollapsed is active, and forceExpand is false
    const collapsed = isMounted && isCollapsed && !forceExpand;

    return (
      <div className={cn("flex flex-col h-full py-8 transition-all duration-300", collapsed ? "px-3" : "px-6")}>
        <div className={cn("flex items-center mb-12 px-2 transition-all duration-300", collapsed ? "flex-col gap-4 justify-center" : "justify-between")}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-accent to-emerald-400 rounded-xl flex items-center justify-center text-white shadow-lg shadow-accent/20 relative group transition-all shrink-0">
              <Wallet className="w-5.5 h-5.5" />
            </div>
            {!collapsed && (
              <span className="text-xl font-display font-black tracking-tight bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent whitespace-nowrap animate-fade-in">
                SaaS Financeiro
              </span>
            )}
          </div>
          
          <button 
            onClick={toggleCollapse}
            className={cn(
              "p-2 hover:bg-white/5 rounded-xl text-text-secondary hover:text-white transition-all cursor-pointer hidden lg:flex items-center justify-center border border-transparent hover:border-white/[0.04]",
              collapsed ? "mt-2" : ""
            )}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 space-y-1.5">
          {menuItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "flex items-center transition-all duration-300 font-medium relative group",
                  collapsed 
                    ? cn("justify-center w-12 h-12 mx-auto rounded-2xl border", 
                         isActive 
                           ? "bg-accent/15 border-accent/20 text-white shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)]" 
                           : "text-text-secondary hover:bg-white/[0.02] hover:text-white border-transparent")
                    : cn("gap-3 px-4 py-3.5",
                         isActive 
                           ? "bg-gradient-to-r from-accent/12 to-accent/[0.01] border-l-2 border-accent text-white rounded-r-xl rounded-l-none" 
                           : "text-text-secondary hover:bg-white/[0.02] hover:text-white rounded-xl")
                )}
              >
                <item.icon className={cn("w-5 h-5 transition-transform duration-300 shrink-0", isActive ? "text-accent scale-105 animate-pulse" : "text-text-secondary group-hover:text-white")} />
                {!collapsed && <span>{item.name}</span>}
                
                {/* Collapsed Tooltip */}
                {collapsed && (
                  <div className="absolute left-16 bg-neutral-950/95 border border-white/[0.08] backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-xl opacity-0 translate-x-2 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap shadow-2xl z-50">
                    {item.name}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-6 border-t border-white/[0.04] space-y-4">
          {collapsed ? (
            <div className="relative group mx-auto flex justify-center">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/20 to-emerald-500/10 border border-accent/20 flex items-center justify-center text-accent font-bold text-sm shadow-inner cursor-pointer">
                {user?.email?.[0].toUpperCase() || 'U'}
              </div>
              <div className="absolute left-16 bottom-0 bg-neutral-950/95 border border-white/[0.08] backdrop-blur-md text-white text-xs font-semibold px-3 py-2 rounded-xl opacity-0 translate-x-2 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap shadow-2xl z-50 flex flex-col gap-0.5">
                <span className="font-bold text-white">{user?.email?.split('@')[0] || 'Usuário'}</span>
                <span className="text-[10px] text-text-secondary">{user?.email || 'usuario@email.com'}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/[0.04] rounded-2xl">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent/20 to-emerald-500/10 border border-accent/20 flex items-center justify-center text-accent font-bold text-sm shadow-inner">
                {user?.email?.[0].toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate font-display">{user?.email?.split('@')[0] || 'Usuário'}</p>
                <p className="text-xs text-text-secondary truncate">{user?.email || 'usuario@email.com'}</p>
              </div>
            </div>
          )}

          <button 
            onClick={signOut}
            className={cn(
              "flex items-center justify-center rounded-xl text-red-400/80 hover:text-red-400 hover:bg-red-500/[0.06] border border-transparent hover:border-red-500/10 transition-all font-medium cursor-pointer relative group",
              collapsed ? "w-12 h-12 mx-auto" : "gap-2 px-4 py-3 w-full text-sm"
            )}
            title={collapsed ? "Sair da conta" : undefined}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Sair da conta</span>}
            
            {collapsed && (
              <div className="absolute left-16 bg-neutral-950/95 border border-white/[0.08] backdrop-blur-md text-red-400 text-xs font-bold px-3 py-1.5 rounded-xl opacity-0 translate-x-2 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap shadow-2xl z-50">
                Sair da conta
              </div>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden lg:block h-screen sticky top-0 bg-panel/30 backdrop-blur-xl border-r border-white/[0.04] transition-all duration-300 ease-in-out shrink-0 overflow-x-hidden overflow-y-auto",
        isMounted && isCollapsed ? "w-20" : "w-72"
      )}>
        <NavContent forceExpand={false} />
      </aside>

      {/* Mobile Sidebar */}
      <div className={cn(
        "fixed inset-0 z-50 bg-black/70 backdrop-blur-md lg:hidden transition-all duration-300",
        isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        <aside className={cn(
          "w-72 h-full bg-panel/40 backdrop-blur-2xl border-r border-white/[0.04] transition-transform duration-300",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <NavContent forceExpand={true} />
        </aside>
      </div>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden h-16 bg-panel/40 backdrop-blur-lg border-b border-white/[0.04] flex items-center justify-between px-6 sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <Wallet className="w-6 h-6 text-accent" />
            <span className="font-display font-black tracking-tight">SaaS Financeiro</span>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 hover:bg-white/[0.05] rounded-xl text-text-secondary hover:text-white transition-all cursor-pointer"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </header>

        <div className="p-6 lg:px-8 lg:py-10 max-w-[1800px] mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
