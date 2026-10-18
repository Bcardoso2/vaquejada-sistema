import { NextRequest, NextResponse } from 'next/server';
import { query, pool } from '../../../lib/db';
import { exigirSessao } from '../../../lib/api-auth';
import { registrarAuditoria } from '../../../lib/audit';

// GET /api/senhas - Listar senhas com detalhes operacionais e de vaqueiros
export async function GET(request: NextRequest) {
  const auth = await exigirSessao(request, ['SECRETARIA']);
  if (!auth.autorizado) return auth.response;
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
        b2.numero_registro as boi2_registro,
        cp.apelido_pista as puxador_apelido,
        ce.apelido_pista as esteira_apelido,
        cav.nome as cavalo_oficial_nome,
        cav.tipo as cavalo_tipo
      FROM senhas s 
      LEFT JOIN kits k ON s.kit_id = k.id
      LEFT JOIN bois b1 ON s.boi1_id = b1.id
      LEFT JOIN bois b2 ON s.boi2_id = b2.id
      LEFT JOIN competidores cp ON s.puxador_id = cp.id
      LEFT JOIN competidores ce ON s.esteira_id = ce.id
      LEFT JOIN cavalos cav ON s.cavalo_puxa_id = cav.id
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
  const auth = await exigirSessao(request, ['SECRETARIA']);
  if (!auth.autorizado) return auth.response;

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

    // Validação de Dupla Duplicada configurável (Item 5)
    if (puxadorNome && esteiraNome && puxadorNome !== 'Não informado' && esteiraNome !== 'Não informado') {
      const vaqConfig = await query(
        `SELECT COALESCE(permitir_dupla_multiplas_senhas, true) as permitir_multiplas 
         FROM vaquejadas 
         WHERE id = $1`,
        [vaquejadaId]
      );
      const permitirMultiplas = vaqConfig.rows[0]?.permitir_multiplas ?? true;

      if (!permitirMultiplas) {
        const duplaCheck = await query(
          `SELECT id, codigo 
           FROM senhas 
           WHERE LOWER(TRIM(puxador_nome)) = LOWER(TRIM($1))
             AND LOWER(TRIM(esteira_nome)) = LOWER(TRIM($2))
             AND categoria = $3
             AND (vaquejada_id = $4 OR vaquejada_id IS NULL)
             AND status = 'ATIVA'
             AND estado_comercial = 'PAGA'`,
          [puxadorNome, esteiraNome, categoria, vaquejadaId]
        );

        if (duplaCheck.rowCount && duplaCheck.rowCount > 0) {
          return NextResponse.json(
            {
              error: `Regra do evento: A dupla ${puxadorNome} & ${esteiraNome} já possui inscrição ativa nesta vaquejada na categoria ${categoria} (Senha ${duplaCheck.rows[0].codigo}).`
            },
            { status: 409 }
          );
        }
      }
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
  const auth = await exigirSessao(request, ['SECRETARIA']);
  if (!auth.autorizado) return auth.response;

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

    // Validação de Dupla Duplicada no PUT (Item 5)
    if (puxadorNome && esteiraNome && puxadorNome !== 'Não informado' && esteiraNome !== 'Não informado') {
      const duplaCheck = await query(
        `SELECT id, codigo 
         FROM senhas 
         WHERE LOWER(TRIM(puxador_nome)) = LOWER(TRIM($1))
           AND LOWER(TRIM(esteira_nome)) = LOWER(TRIM($2))
           AND categoria = $3
           AND (vaquejada_id = $4 OR vaquejada_id IS NULL)
           AND status = 'ATIVA'
           AND estado_comercial = 'PAGA'
           AND id != $5`,
        [puxadorNome, esteiraNome, categoria, antigaSenha.vaquejada_id, id]
      );

      if (duplaCheck.rowCount && duplaCheck.rowCount > 0) {
        return NextResponse.json(
          {
            error: `A dupla ${puxadorNome} & ${esteiraNome} já possui inscrição ativa nesta vaquejada na categoria ${categoria} (Senha ${duplaCheck.rows[0].codigo}).`
          },
          { status: 409 }
        );
      }
    }

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

// DELETE /api/senhas - Cancelamento com transação, validação de pista e auditoria
export async function DELETE(request: NextRequest) {
  const auth = await exigirSessao(request, ['SECRETARIA']);
  if (!auth.autorizado) return auth.response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const motivo = searchParams.get('motivo');
  const operadorNome = auth.session.nome;
  const role = auth.session.papel;
  const usuarioId = auth.session.id;

  if (!id) {
    return NextResponse.json({ error: 'ID da senha é obrigatório' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const senhaRes = await client.query('SELECT * FROM senhas WHERE id = $1 FOR UPDATE', [id]);
    if (senhaRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Senha não encontrada' }, { status: 404 });
    }
    const senha = senhaRes.rows[0];

    // Verificar corridas associadas na pista
    const corridasRes = await client.query(
      'SELECT id, ordem_mapa, boi_numero, estado, estado_julgamento FROM corridas_mapa WHERE senha_id = $1',
      [id]
    );
    const corridas = corridasRes.rows;

    const temCorridaEmExecucao = corridas.some((c: any) => c.estado === 'EM_EXECUCAO');
    if (temCorridaEmExecucao) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'Não é possível cancelar uma senha cuja corrida está EM_EXECUCAO na pista.' },
        { status: 409 }
      );
    }

    const temCorridaConcluida = corridas.some((c: any) => c.estado === 'CONCLUIDA');
    if (temCorridaConcluida) {
      if (role !== 'ADMIN') {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: 'Apenas administradores possuem autorização para cancelar senhas com corridas já concluídas na pista.' },
          { status: 403 }
        );
      }

      if (!motivo || motivo.trim().length < 5 || motivo.trim() === 'Cancelamento formal de inscrição') {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: 'Para cancelar uma senha com corridas já concluídas na pista, o administrador deve informar um motivo/justificativa detalhado (mínimo 5 caracteres).' },
          { status: 400 }
        );
      }
    }

    const motivoFinal = motivo?.trim() || 'Cancelamento formal de inscrição';

    // 1. Atualizar senha para CANCELADA
    await client.query(
      `UPDATE senhas 
       SET status = 'CANCELADA', estado_comercial = 'CANCELADA', atualizado_em = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [id]
    );

    // 2. Desativar/Remover corridas associadas em corridas_mapa que ainda não foram concluídas
    const corridasCanceladasRes = await client.query(
      `UPDATE corridas_mapa 
       SET estado = 'CANCELADA', estado_julgamento = 'ANULADO', concluida_em = CURRENT_TIMESTAMP
       WHERE senha_id = $1 AND estado != 'CONCLUIDA'
       RETURNING id, ordem_mapa, boi_numero, estado`,
      [id]
    );

    // 3. Estorno financeiro: Atualizar pagamentos associados para ESTORNADO se houver
    const pagamentosAtualizados = await client.query(
      `UPDATE pagamentos
       SET status = 'ESTORNADO'
       WHERE senha_id = $1 AND status = 'CONFIRMADO'
       RETURNING id, valor_centavos`,
      [id]
    );

    // Se a senha estava paga mas não havia registro em pagamentos, registrar estorno explícito
    if (pagamentosAtualizados.rowCount === 0 && senha.estado_comercial === 'PAGA' && (senha.valor_centavos || 0) > 0) {
      await client.query(
        `INSERT INTO pagamentos (id, senha_id, tipo, valor_centavos, status, comprovante_detalhes)
         VALUES ($1, $2, 'ESTORNO', $3, 'ESTORNADO', $4)`,
        [
          `estorno-${crypto.randomUUID().slice(0, 8)}`,
          id,
          senha.valor_centavos,
          `Estorno gerado por cancelamento de senha: ${motivoFinal}`
        ]
      );
    }

    await client.query('COMMIT');

    // 4. Registrar na auditoria
    await registrarAuditoria({
      usuarioId,
      usuarioNome: operadorNome,
      papel: role,
      acao: temCorridaConcluida ? 'CANCELAR_SENHA_COM_CORRIDA_CONCLUIDA' : 'CANCELAR_SENHA_COM_MAPA',
      entidade: 'senhas',
      entidadeId: id,
      detalhes: {
        codigo: senha.codigo,
        puxador: senha.puxador_nome,
        temCorridaConcluida,
        corridasDesativadas: corridasCanceladasRes.rows,
        totalCorridasDesativadas: corridasCanceladasRes.rowCount,
        estornoFinanceiro: pagamentosAtualizados.rowCount ? pagamentosAtualizados.rows : 'Estorno avulso gerado',
      },
      motivo: motivoFinal,
    });

    return NextResponse.json({
      success: true,
      message: `Senha ${senha.codigo} cancelada com sucesso.${temCorridaConcluida ? ' (Atenção: Senha continha corrida concluída cancelada por ADMIN).' : ''} ${corridasCanceladasRes.rowCount} corrida(s) foram retiradas da fila do mapa de pista.`,
      corridasCanceladas: corridasCanceladasRes.rowCount,
      temCorridaConcluida,
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    console.error('Erro ao cancelar senha:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha interna ao cancelar senha' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}