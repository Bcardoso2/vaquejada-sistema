import { NextRequest, NextResponse } from 'next/server';
import { DELETE as deleteHandler, PUT as putHandler } from '../route';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// DELETE /api/senhas/[id]
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const url = new URL(request.url);
  url.searchParams.set('id', id);
  const newReq = new NextRequest(url.toString(), {
    method: 'DELETE',
    headers: request.headers,
  });
  return deleteHandler(newReq);
}

// PUT /api/senhas/[id]
export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json();
  const url = new URL(request.url);
  url.searchParams.set('id', id);
  const newReq = new NextRequest(url.toString(), {
    method: 'PUT',
    headers: request.headers,
    body: JSON.stringify({ ...body, id }),
  });
  return putHandler(newReq);
}
