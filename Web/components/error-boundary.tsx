'use client';

import React from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const isSupabaseError = this.state.error?.message?.includes('Supabase configuration is missing') || 
                             this.state.error?.message?.includes('Failed to fetch');

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-panel border border-border rounded-2xl p-8 text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500">
              <AlertCircle className="w-8 h-8" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Ops! Algo deu errado</h2>
              <p className="text-text-secondary">
                {isSupabaseError 
                  ? 'Não foi possível conectar ao banco de dados. Verifique as chaves API do Supabase no painel de Secrets.'
                  : 'Ocorreu um erro inesperado ao carregar a aplicação.'}
              </p>
            </div>

            <div className="bg-black/20 p-4 rounded-xl text-left overflow-auto max-h-32">
              <code className="text-xs text-red-400 break-all">
                {this.state.error?.message}
              </code>
            </div>

            <button 
              onClick={() => window.location.reload()}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <RefreshCcw className="w-4 h-4" />
              Tentar Novamente
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
