import React from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn("bg-panel border border-border rounded-2xl p-6 shadow-sm", className)}>
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
  const colorClasses: Record<string, string> = {
    accent: 'bg-accent/10 text-accent',
    red: 'bg-red-500/10 text-red-500',
    blue: 'bg-blue-500/10 text-blue-500',
    purple: 'bg-purple-500/10 text-purple-500',
    yellow: 'bg-yellow-500/10 text-yellow-500',
  };

  return (
    <Card className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center justify-between">
        <div className={cn("p-3 rounded-xl", colorClasses[color] || colorClasses.accent)}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <div className={cn(
            "text-xs font-bold px-2 py-1 rounded-lg",
            trend.isPositive ? "bg-accent/10 text-accent" : "bg-red-500/10 text-red-500"
          )}>
            {trend.isPositive ? '+' : '-'}{trend.value}%
          </div>
        )}
      </div>
      <div>
        <p className="text-sm text-text-secondary font-medium">{title}</p>
        <h3 className="text-2xl font-black mt-1">{value}</h3>
        {description && (
          <p className="text-xs text-text-secondary mt-2 font-medium">
            {description}
          </p>
        )}
      </div>
    </Card>
  );
}
