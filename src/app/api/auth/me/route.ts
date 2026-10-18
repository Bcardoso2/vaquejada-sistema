import { NextRequest, NextResponse } from 'next/server';
import { obterSessaoDoRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await obterSessaoDoRequest(request);
  if (!session) {
    return NextResponse.json({ authenticated: false, usuario: null }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    usuario: session,
  });
}
