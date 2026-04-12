'use client';

import React, { useState } from 'react';
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
  Users
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

interface SidebarLayoutProps {
  children: React.ReactNode;
}

export default function SidebarLayout({ children }: SidebarLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { signOut, user } = useAuth();

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'Entradas', icon: TrendingUp, path: '/entradas' },
    { name: 'Saídas', icon: TrendingDown, path: '/saidas' },
    { name: 'Investimentos', icon: Wallet, path: '/investimentos' },
    { name: 'Cadastros', icon: PlusCircle, path: '/cadastros' },
  ];

  const NavContent = () => (
    <div className="flex flex-col h-full py-8 px-6">
      <div className="flex items-center gap-3 mb-12 px-2">
        <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center text-white shadow-lg shadow-accent/20">
          <Wallet className="w-6 h-6" />
        </div>
        <span className="text-xl font-black tracking-tight">SaaS Financeiro</span>
      </div>

      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            onClick={() => setIsMobileMenuOpen(false)}
            className={cn(
              "flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium",
              pathname === item.path 
                ? "bg-accent text-white shadow-lg shadow-accent/10" 
                : "text-text-secondary hover:bg-neutral-800 hover:text-white"
            )}
          >
            <item.icon className="w-5 h-5" />
            {item.name}
          </Link>
        ))}
      </nav>

      <div className="mt-auto pt-8 border-t border-border space-y-4">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-neutral-800 rounded-full flex items-center justify-center text-accent font-bold">
            {user?.email?.[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{user?.email?.split('@')[0]}</p>
            <p className="text-xs text-text-secondary truncate">{user?.email}</p>
          </div>
        </div>
        <button 
          onClick={signOut}
          className="flex items-center gap-3 px-4 py-3.5 rounded-2xl w-full text-red-500 hover:bg-red-500/10 transition-all font-medium"
        >
          <LogOut className="w-5 h-5" />
          Sair
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-72 h-screen sticky top-0 bg-panel border-r border-border">
        <NavContent />
      </aside>

      {/* Mobile Sidebar */}
      <div className={cn(
        "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden transition-all duration-300",
        isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        <aside className={cn(
          "w-72 h-full bg-panel border-r border-border transition-transform duration-300",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <NavContent />
        </aside>
      </div>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden h-16 bg-panel border-b border-border flex items-center justify-between px-6 sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <Wallet className="w-6 h-6 text-accent" />
            <span className="font-black">SaaS Financeiro</span>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 hover:bg-neutral-800 rounded-lg text-text-secondary"
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
