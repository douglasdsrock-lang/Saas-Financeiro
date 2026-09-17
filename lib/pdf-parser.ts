import { extractText } from 'unpdf';

export interface InterTransaction {
  date: string;
  description: string;
  value: number;
}

// Mapeamento de meses em português para normalização
const MONTH_MAP: Record<string, string> = {
  jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06',
  jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12'
};

export async function parseInterInvoice(data: Uint8Array | ArrayBuffer | Buffer): Promise<InterTransaction[]> {
  try {
    // Garante Uint8Array
    const uint8Array = data instanceof Uint8Array ? data : new Uint8Array(data);
    
    // Extrai texto com merge de páginas
    const result = await extractText(uint8Array, { mergePages: true });
    const fullText = typeof result.text === 'string' ? result.text : (Array.isArray(result.text) ? result.text.join('\n') : '');
    
    if (!fullText || fullText.trim().length === 0) {
      throw new Error("O PDF não contém texto legível (pode ser uma imagem escaneada).");
    }

    const lines = fullText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const transactions: InterTransaction[] = [];

    // Padrão 1: Linha única completa (ex: "23 de abr. 2026 MP *ROMININSULFIL (Parcela 04 de 04) - R$ 97,44" ou "16/02/2026 COMPRA R$ 50,00")
    // Suporta: "23 de abr. 2026", "23 de abr 2026", "23/04/2026"
    const singleLineRegex = /^(\d{1,2}(?:\s+de\s+[a-zA-ZçÇ]{3,4}\.?\s+\d{4}|\/\d{2}\/\d{2,4}))\s+(.+?)(?:\s+-\s+|\s+)?(?:R\$\s*)?([\d.,]+)$/i;

    // Padrão 2: Data no início de linha
    const dateRegex = /^(\d{1,2}\s+de\s+[a-zA-ZçÇ]{3,4}\.?\s+\d{4}|\d{2}\/\d{2}\/\d{2,4})$/i;
    // Padrão de valor em R$
    const valueRegex = /^(?:R\$\s*)?([\d]{1,3}(?:\.[\d]{3})*,\d{2})$/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Ignora linhas de totais, limites, parcelamentos ou cabeçalhos
      if (
        line.toLowerCase().startsWith('total ') ||
        line.toLowerCase().startsWith('total cart') ||
        line.toLowerCase().includes('data de vencimento') ||
        line.toLowerCase().includes('fatura atual') ||
        line.toLowerCase().includes('pagamento mínimo') ||
        line.toLowerCase().includes('saldo total') ||
        line.toLowerCase().includes('saldo em aberto') ||
        line.toLowerCase().includes('despesas do mês')
      ) {
        continue;
      }

      // Tentativa 1: Linha única
      const singleMatch = line.match(singleLineRegex);
      if (singleMatch) {
        const rawDate = singleMatch[1].trim();
        const description = singleMatch[2].replace(/^-\s*/, '').replace(/\s*-\s*$/, '').trim();
        const rawVal = singleMatch[3].trim().replace(/\./g, '').replace(',', '.');
        const value = parseFloat(rawVal);

        if (!isNaN(value) && value > 0 && description.length > 1) {
          transactions.push({ date: rawDate, description, value });
          continue;
        }
      }

      // Tentativa 2: Linhas fragmentadas (comum em extrações de PDF onde data, desc e valor ficam em linhas separadas)
      const dateMatch = line.match(dateRegex);
      if (dateMatch && i + 1 < lines.length) {
        const rawDate = dateMatch[1].trim();
        let description = lines[i + 1].trim();
        let valIndex = i + 2;

        // Se a próxima linha for apenas "-" (beneficiário vazio), pula
        if (description === '-' && i + 2 < lines.length) {
          description = lines[i + 2].trim();
          valIndex = i + 3;
        }

        if (valIndex < lines.length) {
          const valMatch = lines[valIndex].match(valueRegex);
          if (valMatch) {
            const rawVal = valMatch[1].replace(/\./g, '').replace(',', '.');
            const value = parseFloat(rawVal);
            if (!isNaN(value) && value > 0 && !description.toLowerCase().includes('total')) {
              transactions.push({ date: rawDate, description, value });
              i = valIndex; // avança o cursor
            }
          }
        }
      }
    }

    return transactions;
  } catch (error: any) {
    console.error("Erro no parseInterInvoice:", error);
    throw new Error(error?.message || "Falha ao processar o arquivo PDF.");
  }
}
