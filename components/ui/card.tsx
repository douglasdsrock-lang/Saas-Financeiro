import React from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn("backdrop-blur-xl bg-panel/30 border border-white/[0.04] rounded-3xl p-4 sm:p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] transition-all duration-300 hover:border-white/[0.08] hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.8)] hover:-translate-y-0.5", className)}>
      {children}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  color?: string;
  description?: string;
}

export function StatCard({ title, value, icon: Icon, trend, className, color = 'accent', description }: StatCardProps) {
  const containerColors: Record<string, string> = {
    accent: 'bg-accent/[0.06] border border-accent/20 text-accent shadow-[0_0_15px_-3px_rgba(16,185,129,0.1)]',
    red: 'bg-red-500/[0.06] border border-red-500/20 text-red-500 shadow-[0_0_15px_-3px_rgba(239,68,68,0.1)]',
    blue: 'bg-blue-500/[0.06] border border-blue-500/20 text-blue-500 shadow-[0_0_15px_-3px_rgba(59,130,246,0.1)]',
    purple: 'bg-purple-500/[0.06] border border-purple-500/20 text-purple-500 shadow-[0_0_15px_-3px_rgba(168,85,247,0.1)]',
    yellow: 'bg-yellow-500/[0.06] border border-yellow-500/20 text-yellow-500 shadow-[0_0_15px_-3px_rgba(245,158,11,0.1)]',
  };

  const iconGlows: Record<string, string> = {
    accent: 'drop-shadow-[0_0_6px_rgba(16,185,129,0.4)]',
    red: 'drop-shadow-[0_0_6px_rgba(239,68,68,0.4)]',
    blue: 'drop-shadow-[0_0_6px_rgba(59,130,246,0.4)]',
    purple: 'drop-shadow-[0_0_6px_rgba(168,85,247,0.4)]',
    yellow: 'drop-shadow-[0_0_6px_rgba(245,158,11,0.4)]',
  };

  return (
    <Card className={cn("flex flex-col gap-4 relative overflow-hidden group", className)}>
      <div className="absolute top-0 right-0 w-24 h-24 bg-white/[0.01] rounded-full blur-2xl -mr-8 -mt-8 group-hover:bg-white/[0.02] transition-colors" />
      <div className="flex items-center justify-between">
        <div className={cn("p-3.5 rounded-2xl transition-all duration-300", containerColors[color] || containerColors.accent)}>
          <Icon className={cn("w-5 h-5", iconGlows[color] || iconGlows.accent)} />
        </div>
        {trend && (
          <div className={cn(
            "text-xs font-bold px-2.5 py-1 rounded-xl backdrop-blur-md",
            trend.isPositive ? "bg-accent/10 text-accent border border-accent/10" : "bg-red-500/10 text-red-500 border border-red-500/10"
          )}>
            {trend.isPositive ? '+' : '-'}{trend.value}%
          </div>
        )}
      </div>
      <div>
        <p className="text-xs text-text-secondary font-bold uppercase tracking-wider">{title}</p>
        <h3 className="text-xl sm:text-2xl lg:text-3xl font-display font-black tracking-tight mt-1.5 text-white">{value}</h3>
        {description && (
          <p className="text-[11px] text-text-secondary mt-2.5 font-medium flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-accent/40" />
            {description}
          </p>
        )}
      </div>
    </Card>
  );
}
