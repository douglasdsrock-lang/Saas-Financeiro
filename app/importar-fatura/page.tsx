import { FaturaUpload } from '@/components/fatura-upload';

export default function ImportarFaturaPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Importar Fatura</h1>
        <p className="text-gray-500">Faça o upload do PDF da sua fatura para ler e salvar os dados automaticamente.</p>
      </div>

      <FaturaUpload />
    </div>
  );
}
