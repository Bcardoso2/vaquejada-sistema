import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { exigirSessao } from '@/lib/api-auth';
import { registrarAuditoria } from '@/lib/audit';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/cavalos/[id] - Detalhes e histórico de corridas do cavalo
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await exigirSessao(request, ['ADMIN', 'SECRETARIA', 'OPERADOR_PISTA', 'JUIZ']);
  if (!auth.autorizado) return auth.response;

  try {
    const { id } = await context.params;

    const cavRes = await query('SELECT * FROM cavalos WHERE id = $1', [id]);
    if (cavRes.rowCount === 0) {
      return NextResponse.json({ error: 'Cavalo não encontrado' }, { status: 404 });
    }

    const cavaloRaw = cavRes.rows[0];
    const podeVerDadosCompletos = auth.session.papel === 'ADMIN' || auth.session.papel === 'SECRETARIA';

    const cavalo = podeVerDadosCompletos
      ? cavaloRaw
      : {
          id: cavaloRaw.id,
          nome: cavaloRaw.nome,
          tipo: cavaloRaw.tipo,
          ativo: cavaloRaw.ativo,
        };

    // Buscar histórico de senhas em que atuou
    const senhasRes = await query(
      `SELECT s.id, s.codigo, s.categoria, s.status, s.criado_em, s.puxador_nome, s.esteira_nome,
              v.nome as vaquejada_nome
       FROM senhas s
       LEFT JOIN vaquejadas v ON s.vaquejada_id = v.id
       WHERE s.cavalo_puxa_id = $1 OR s.cavalo_esteira_id = $1
       ORDER BY s.criado_em DESC`,
      [id]
    );

    return NextResponse.json({
      cavalo,
      totalSenhas: senhasRes.rowCount,
      senhas: senhasRes.rows,
    });
  } catch (error) {
    console.error('Erro ao consultar cavalo:', error);
    return NextResponse.json({ error: 'Erro ao carregar dados do animal' }, { status: 500 });
  }
}

// PUT /api/cavalos/[id] - Atualizar dados do cavalo
export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await exigirSessao(request, ['ADMIN', 'SECRETARIA']);
  if (!auth.autorizado) return auth.response;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const { nome, tipo, proprietario, registro, chip, ativo } = body;

    const cavExiste = await query('SELECT * FROM cavalos WHERE id = $1', [id]);
    if (cavExiste.rowCount === 0) {
      return NextResponse.json({ error: 'Cavalo não encontrado' }, { status: 404 });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let pIdx = 1;

    if (nome && nome.trim().length >= 2) {
      updates.push(`nome = $${pIdx++}`);
      values.push(nome.trim());
    }

    if (tipo) {
      const tiposValidos = ['PUXA', 'ESTEIRA', 'AMBOS'];
      const tipoNormalizado = tipo.toUpperCase().trim();
      if (!tiposValidos.includes(tipoNormalizado)) {
        return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
      }
      updates.push(`tipo = $${pIdx++}`);
      values.push(tipoNormalizado);
    }

    if (proprietario !== undefined) {
      updates.push(`proprietario = $${pIdx++}`);
      values.push(proprietario?.trim() || null);
    }

    if (registro !== undefined) {
      updates.push(`registro = $${pIdx++}`);
      values.push(registro?.trim() || null);
    }

    if (chip !== undefined) {
      updates.push(`chip = $${pIdx++}`);
      values.push(chip?.trim() || null);
    }

    if (typeof ativo === 'boolean') {
      updates.push(`ativo = $${pIdx++}`);
      values.push(ativo);
    }

    if (updates.length === 0) {
      return NextResponse.json({ message: 'Nenhuma alteração informada' });
    }

    updates.push(`atualizado_em = CURRENT_TIMESTAMP`);
    values.push(id);

    const res = await query(
      `UPDATE cavalos 
       SET ${updates.join(', ')} 
       WHERE id = $${pIdx} 
       RETURNING *`,
      values
    );

    await registrarAuditoria({
      usuarioId: auth.session.id,
      usuarioNome: auth.session.nome,
      papel: auth.session.papel,
      acao: 'ATUALIZAR_CAVALO',
      entidade: 'cavalos',
      entidadeId: id,
      detalhes: { alteracoes: body },
      motivo: `Atualização de cavalo por ${auth.session.nome}`,
    });

    return NextResponse.json({
      success: true,
      cavalo: res.rows[0],
    });
  } catch (error) {
    console.error('Erro ao atualizar cavalo:', error);
    return NextResponse.json({ error: 'Erro interno ao atualizar cavalo' }, { status: 500 });
  }
}

// DELETE /api/cavalos/[id] - Desativar cavalo
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await exigirSessao(request, ['ADMIN', 'SECRETARIA']);
  if (!auth.autorizado) return auth.response;

  try {
    const { id } = await context.params;

    const res = await query(
      `UPDATE cavalos 
       SET ativo = false, atualizado_em = CURRENT_TIMESTAMP 
       WHERE id = $1 
       RETURNING id, nome`,
      [id]
    );

    if (res.rowCount === 0) {
      return NextResponse.json({ error: 'Cavalo não encontrado' }, { status: 404 });
    }

    await registrarAuditoria({
      usuarioId: auth.session.id,
      usuarioNome: auth.session.nome,
      papel: auth.session.papel,
      acao: 'DESATIVAR_CAVALO',
      entidade: 'cavalos',
      entidadeId: id,
      detalhes: { nome: res.rows[0].nome },
      motivo: `Cavalo desativado por ${auth.session.nome}`,
    });

    return NextResponse.json({
      success: true,
      message: `Animal "${res.rows[0].nome}" desativado com sucesso.`,
    });
  } catch (error) {
    console.error('Erro ao desativar cavalo:', error);
    return NextResponse.json({ error: 'Erro ao desativar cavalo' }, { status: 500 });
  }
}
