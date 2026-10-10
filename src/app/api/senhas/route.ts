import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../lib/db';
import { validateRolePermission } from '../../../lib/api-auth';
import { registrarAuditoria } from '../../../lib/audit';

// GET /api/senhas - Listar senhas com detalhes operacionais e de vaqueiros
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kitId = searchParams.get('kitId');
    const status = searchParams.get('status');
    const categoria = searchParams.get('categoria');
    const tipoVenda = searchParams.get('tipoVenda');
    const busca = searchParams.get('busca');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    let queryText = `
      SELECT 
        s.*, 
        k.codigo as kit_codigo,
        b1.nome as boi1_nome,
        b1.numero_registro as boi1_registro,
        b2.nome as boi2_nome,
        b2.numero_registro as boi2_registro
      FROM senhas s 
      LEFT JOIN kits k ON s.kit_id = k.id
      LEFT JOIN bois b1 ON s.boi1_id = b1.id
      LEFT JOIN bois b2 ON s.boi2_id = b2.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (kitId) {
      params.push(kitId);
      queryText += ` AND s.kit_id = $${params.length}`;
    }

    if (status && status !== 'TODOS') {
      params.push(status);
      queryText += ` AND s.status = $${params.length}`;
    }

    if (categoria && categoria !== 'TODAS') {
      params.push(categoria);
      queryText += ` AND s.categoria = $${params.length}`;
    }

    if (tipoVenda && tipoVenda !== 'TODOS') {
      params.push(tipoVenda);
      queryText += ` AND s.tipo_venda = $${params.length}`;
    }

    if (busca && busca.trim()) {
      params.push(`%${busca.trim()}%`);
      queryText += ` AND (
        s.codigo ILIKE $${params.length} OR 
        s.puxador_nome ILIKE $${params.length} OR 
        s.esteira_nome ILIKE $${params.length} OR
        k.codigo ILIKE $${params.length}
      )`;
    }

    params.push(limit, offset);
    queryText += ` ORDER BY s.criado_em DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const res = await query(queryText, params);
    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Erro ao listar senhas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor ao buscar senhas' },
      { status: 500 }
    );
  }
}

// POST /api/senhas - Criar nova senha avulsa ou associada
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      kitId, 
      codigo, 
      boi1Id, 
      boi2Id, 
      puxadorNome, 
      esteiraNome, 
      categoria = 'ABERTA', 
      tipoVenda = 'SOLTEIRA', 
      canalVenda = 'PRESENCIAL', 
      valorCentavos = 35000,
      vaquejadaId = 'vq-2026-portal'
    } = body;

    if (!codigo) {
      return NextResponse.json(
        { error: 'Código da senha é obrigatório' },
        { status: 400 }
      );
    }

    let finalKitId = kitId;
    if (!finalKitId) {
      const kitCheck = await query('SELECT id FROM kits LIMIT 1');
      finalKitId = kitCheck.rows[0]?.id || 'kit-default';
    }

    const res = await query(
      `INSERT INTO senhas (
        id, kit_id, vaquejada_id, codigo, boi1_id, boi2_id, 
        status, puxador_nome, esteira_nome, categoria, 
        tipo_venda, canal_venda, estado_comercial, valor_centavos
      ) VALUES (
        $1, $2, $3, $4, $5, $6, 
        'ATIVA', $7, $8, $9, 
        $10, $11, 'PAGA', $12
      ) RETURNING *`,
      [
        `sn-${Date.now().toString(36)}`,
        finalKitId,
        vaquejadaId,
        codigo,
        boi1Id || null,
        boi2Id || null,
        puxadorNome || 'Não informado',
        esteiraNome || 'Não informado',
        categoria,
        tipoVenda,
        canalVenda,
        valorCentavos
      ]
    );

    await registrarAuditoria({
      usuarioNome: 'Gestor Operacional',
      papel: 'ADMIN',
      acao: 'CRIAR_SENHA',
      entidade: 'senhas',
      entidadeId: res.rows[0].id,
      detalhes: { codigo, puxadorNome, categoria },
      motivo: 'Cadastro manual de senha pelo gestor'
    });

    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (error) {
    console.error('Erro ao criar senha:', error);
    return NextResponse.json(
      { error: 'Erro ao criar senha' },
      { status: 500 }
    );
  }
}

// PUT /api/senhas - Atualizar dados operacionais da senha (Vaqueiros, Bois, Categoria, Status)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const id = body.id || new URL(request.url).searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID da senha é obrigatório' }, { status: 400 });
    }

    const senhaCheck = await query('SELECT * FROM senhas WHERE id = $1', [id]);
    if (senhaCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Senha não encontrada' },
        { status: 404 }
      );
    }

    const antigaSenha = senhaCheck.rows[0];

    const {
      puxadorNome = antigaSenha.puxador_nome,
      esteiraNome = antigaSenha.esteira_nome,
      categoria = antigaSenha.categoria,
      status = antigaSenha.status,
      estadoComercial = antigaSenha.estado_comercial,
      boi1Id = antigaSenha.boi1_id,
      boi2Id = antigaSenha.boi2_id,
      motivoAlteracao = 'Ajuste operacional de rotina'
    } = body;

    const res = await query(
      `UPDATE senhas
       SET puxador_nome = $1,
           esteira_nome = $2,
           categoria = $3,
           status = $4,
           estado_comercial = $5,
           boi1_id = $6,
           boi2_id = $7,
           atualizado_em = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [puxadorNome, esteiraNome, categoria, status, estadoComercial, boi1Id || null, boi2Id || null, id]
    );

    await registrarAuditoria({
      usuarioNome: 'Gestor Operacional',
      papel: 'ADMIN',
      acao: 'ATUALIZAR_SENHA',
      entidade: 'senhas',
      entidadeId: id,
      detalhes: { 
        codigo: antigaSenha.codigo,
        antes: { puxador: antigaSenha.puxador_nome, esteira: antigaSenha.esteira_nome, categoria: antigaSenha.categoria, status: antigaSenha.status },
        depois: { puxador: puxadorNome, esteira: esteiraNome, categoria, status }
      },
      motivo: motivoAlteracao
    });

    return NextResponse.json(res.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar senha:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar senha' },
      { status: 500 }
    );
  }
}

// DELETE /api/senhas - Cancelamento com auditoria
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID da senha é obrigatório' }, { status: 400 });
    }

    const res = await query(
      `UPDATE senhas 
       SET status = 'CANCELADA', estado_comercial = 'CANCELADA', atualizado_em = CURRENT_TIMESTAMP 
       WHERE id = $1 RETURNING *`,
      [id]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Senha não encontrada' }, { status: 404 });
    }

    await registrarAuditoria({
      usuarioNome: 'Gestor Operacional',
      papel: 'ADMIN',
      acao: 'CANCELAR_SENHA',
      entidade: 'senhas',
      entidadeId: id,
      detalhes: { codigo: res.rows[0].codigo },
      motivo: 'Cancelamento formal de senha pelo gestor'
    });

    return NextResponse.json({ success: true, message: 'Senha cancelada com sucesso' });
  } catch (error) {
    console.error('Erro ao cancelar senha:', error);
    return NextResponse.json({ error: 'Erro ao cancelar senha' }, { status: 500 });
  }
}