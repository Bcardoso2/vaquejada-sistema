import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { exigirSessao } from '@/lib/api-auth';
import { registrarAuditoria } from '@/lib/audit';

// GET /api/cavalos - Listar cavalos com busca e filtros
export async function GET(request: NextRequest) {
  const auth = await exigirSessao(request, ['ADMIN', 'SECRETARIA', 'OPERADOR_PISTA', 'JUIZ']);
  if (!auth.autorizado) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const busca = searchParams.get('q') || '';
    const tipo = searchParams.get('tipo') || '';
    const apenasAtivos = searchParams.get('ativo') !== 'false';

    let sql = `SELECT * FROM cavalos WHERE 1=1`;
    const params: any[] = [];
    let pIdx = 1;

    if (apenasAtivos) {
      sql += ` AND ativo = true`;
    }

    if (busca.trim()) {
      sql += ` AND (LOWER(nome) LIKE $${pIdx} OR LOWER(COALESCE(proprietario, '')) LIKE $${pIdx} OR LOWER(COALESCE(registro, '')) LIKE $${pIdx} OR LOWER(COALESCE(chip, '')) LIKE $${pIdx})`;
      params.push(`%${busca.toLowerCase().trim()}%`);
      pIdx++;
    }

    if (tipo.trim()) {
      sql += ` AND (tipo = $${pIdx} OR tipo = 'AMBOS')`;
      params.push(tipo.toUpperCase());
      pIdx++;
    }

    sql += ` ORDER BY nome ASC LIMIT 200`;

    const res = await query(sql, params);
    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Erro ao listar cavalos:', error);
    return NextResponse.json({ error: 'Erro ao buscar cavalos' }, { status: 500 });
  }
}

// POST /api/cavalos - Cadastrar novo cavalo oficial
export async function POST(request: NextRequest) {
  const auth = await exigirSessao(request, ['ADMIN', 'SECRETARIA']);
  if (!auth.autorizado) return auth.response;

  try {
    const body = await request.json();
    const { nome, tipo = 'PUXA', proprietario, registro, chip, ativo = true } = body;

    if (!nome || nome.trim().length < 2) {
      return NextResponse.json({ error: 'Nome do animal é obrigatório (mínimo 2 caracteres)' }, { status: 400 });
    }

    const tiposValidos = ['PUXA', 'ESTEIRA', 'AMBOS'];
    const tipoNormalizado = (tipo || 'PUXA').toUpperCase().trim();
    if (!tiposValidos.includes(tipoNormalizado)) {
      return NextResponse.json({ error: 'Tipo de cavalo deve ser PUXA, ESTEIRA ou AMBOS' }, { status: 400 });
    }

    const id = `cav-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const res = await query(
      `INSERT INTO cavalos (id, nome, tipo, proprietario, registro, chip, ativo)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        id,
        nome.trim(),
        tipoNormalizado,
        proprietario?.trim() || null,
        registro?.trim() || null,
        chip?.trim() || null,
        ativo !== false,
      ]
    );

    const novo = res.rows[0];

    await registrarAuditoria({
      usuarioId: auth.session.id,
      usuarioNome: auth.session.nome,
      papel: auth.session.papel,
      acao: 'CADASTRAR_CAVALO',
      entidade: 'cavalos',
      entidadeId: id,
      detalhes: { nome: novo.nome, tipo: novo.tipo, proprietario: novo.proprietario },
      motivo: `Cadastro oficial de cavalo por ${auth.session.nome}`,
    });

    return NextResponse.json({
      success: true,
      cavalo: novo,
    }, { status: 201 });
  } catch (error) {
    console.error('Erro ao cadastrar cavalo:', error);
    return NextResponse.json({ error: 'Erro interno ao cadastrar cavalo' }, { status: 500 });
  }
}
