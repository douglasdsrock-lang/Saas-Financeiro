'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('HomePage: State check...', { user: !!user, loading });
    if (!loading) {
      if (user) {
        console.log('HomePage: Redirecting to dashboard');
        router.push('/dashboard');
      } else {
        console.log('HomePage: Redirecting to login');
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <div className="text-accent font-bold text-xl">
        {loading ? 'Verificando Autenticação...' : 'Redirecionando...'}
      </div>
      <div className="text-text-secondary text-xs">
        Status: {loading ? 'Carregando' : 'Pronto'} | Usuário: {user ? 'Sim' : 'Não'}
      </div>
    </div>
  );
}
