import { NextRequest, NextResponse } from 'next/server';
import { parseInterInvoice } from '@/lib/pdf-parser';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'Nenhum arquivo enviado.' },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'O arquivo enviado deve ser um PDF.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const transactions = await parseInterInvoice(uint8Array);

    return NextResponse.json({ 
      success: true,
      count: transactions.length,
      transactions 
    }, { status: 200 });

  } catch (error: any) {
    console.error('Erro na API de upload de fatura:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao processar a fatura. Verifique o formato do arquivo.' },
      { status: 500 }
    );
  }
}
