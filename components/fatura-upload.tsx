'use client';

import { useState } from 'react';
import { UploadCloud, FileText, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { InterTransaction } from '@/lib/pdf-parser';

export function FaturaUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [transactions, setTransactions] = useState<InterTransaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setTransactions(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload-fatura', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao processar arquivo');
      }

      setTransactions(data.transactions);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-8 text-center transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
        <UploadCloud className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">Importar Fatura (Banco Inter)</h3>
        <p className="text-sm text-gray-500 mb-6">
          Arraste o arquivo PDF ou clique para selecionar
        </p>
        
        <input
          type="file"
          id="fatura-upload"
          accept="application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />
        <label 
          htmlFor="fatura-upload" 
          className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 bg-slate-900 text-white hover:bg-slate-900/90 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-50/90"
        >
          {file ? 'Trocar Arquivo' : 'Selecionar PDF'}
        </label>

        {file && (
          <div className="mt-4 flex items-center justify-center text-sm text-primary">
            <FileText className="w-4 h-4 mr-2" />
            {file.name}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 p-4 rounded-lg flex items-start">
          <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {file && !transactions && (
        <button 
          onClick={handleUpload} 
          disabled={isUploading}
          className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 bg-slate-900 text-white hover:bg-slate-900/90 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-50/90"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processando Fatura...
            </>
          ) : (
            'Extrair Transações'
          )}
        </button>
      )}

      {transactions && (
        <div className="bg-white dark:bg-gray-900 border rounded-xl overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center text-green-600">
              <CheckCircle2 className="w-5 h-5 mr-2" />
              <span className="font-medium">Extração Concluída</span>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-500 block">
                {transactions.length} transações encontradas
              </span>
              <span className="text-sm font-bold text-red-600">
                Total: R$ {transactions.reduce((acc, tx) => acc + (Number(tx.value) || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800/50 sticky top-0">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {transactions.map((tx, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{tx.date}</td>
                    <td className="px-4 py-3">{tx.description}</td>
                    <td className="px-4 py-3 text-right font-medium text-red-600">
                      R$ {tx.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              {transactions.length > 0 && (
                <tfoot className="sticky bottom-0 bg-gray-50 dark:bg-gray-800/90 border-t font-semibold">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-right text-gray-500">
                      Total da Fatura:
                    </td>
                    <td className="px-4 py-3 text-right text-red-600 font-bold">
                      R$ {transactions.reduce((acc, tx) => acc + (Number(tx.value) || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
            {transactions.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                Nenhuma transação encontrada. Verifique se o formato é do Banco Inter.
              </div>
            )}
          </div>

          {transactions.length > 0 && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t">
              <button className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 bg-green-600 text-white hover:bg-green-700">
                Salvar Transações no Sistema (R$ {transactions.reduce((acc, tx) => acc + (Number(tx.value) || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
