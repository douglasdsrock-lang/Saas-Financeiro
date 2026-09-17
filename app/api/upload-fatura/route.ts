import { NextRequest, NextResponse } from 'next/server';
import { parseInterInvoice } from '@/lib/pdf-parser';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'Nenhum arquivo encontrado' },
        { status: 400 }
      );
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'O arquivo deve ser um PDF' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const transactions = await parseInterInvoice(buffer);

    return NextResponse.json({ transactions }, { status: 200 });
  } catch (error: any) {
    console.error('Erro na API de upload de fatura:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor ao processar fatura' },
      { status: 500 }
    );
  }
}
