import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function handleSupabaseError(error: any, defaultMsg: string = 'Erro ao carregar dados.') {
  // Log full error details for debugging
  console.error('Supabase Error Details:', {
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
    error: error
  });

  if (error?.code === '42P01') {
    return 'Tabela não encontrada. Certifique-se de que as tabelas foram criadas no Supabase SQL Editor.';
  }

  if (error?.code === 'PGRST301') {
    return 'Erro de autenticação (JWT expirado ou inválido). Tente sair e entrar novamente.';
  }

  let msg = error?.message || defaultMsg;
  
  // Catch various forms of fetch/network errors
  const lowerMsg = String(msg).toLowerCase();
  if (lowerMsg.includes('failed to fetch') || lowerMsg.includes('network error') || lowerMsg.includes('load failed')) {
    return 'Não foi possível conectar ao Supabase. Verifique sua conexão e se as chaves API estão corretas.';
  }
  
  return msg;
}
