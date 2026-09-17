import { extractText } from 'unpdf';

export interface InterTransaction {
  date: string;
  description: string;
  value: number;
}

export async function parseInterInvoice(pdfBuffer: Uint8Array | ArrayBuffer): Promise<InterTransaction[]> {
  try {
    const { text } = await extractText(pdfBuffer);
    
    // Divide o texto por quebra de linha
    const fullText = Array.isArray(text) ? text.join('\n') : (text || '');
    const lines = fullText.split('\n');
    const transactions: InterTransaction[] = [];

    // Regex para pegar linhas de transação como:
    // "16 de fev. 2026 SHOPEE *ClubedaBorrach (Parcela 06 de 06) - R$ 73,41"
    const transactionRegex = /^(\d{2}\sde\s[a-zA-ZçÇ]{3,5}\.?\s\d{4})\s+(.+?)(?:\s+-\s+|\s+)R\$\s+([\d,.]+)$/;

    for (const line of lines) {
      const match = line.trim().match(transactionRegex);
      if (match) {
        const rawDate = match[1].trim();
        const description = match[2].trim();
        let rawValue = match[3].trim();

        // Converte valor no formato brasileiro (1.234,56) para float (1234.56)
        rawValue = rawValue.replace(/\./g, '').replace(',', '.');
        const value = parseFloat(rawValue);

        if (!isNaN(value)) {
          transactions.push({
            date: rawDate,
            description,
            value
          });
        }
      }
    }

    return transactions;
  } catch (error) {
    console.error("Erro ao fazer parse do PDF do Inter:", error);
    throw new Error("Não foi possível extrair os dados da fatura. Verifique se o arquivo é um PDF válido do Banco Inter.");
  }
}
