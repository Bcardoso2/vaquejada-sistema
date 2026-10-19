import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { exigirSessao } from '@/lib/api-auth';
import { validarCpf, formatarCpf, limparCpf, mascararCpf, mascararTelefone } from '@/lib/cpf';
import { registrarAuditoria } from '@/lib/audit';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/competidores/[id] - Detalhes e HISTÓRICO COMPLETO do competidor
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await exigirSessao(request, ['ADMIN', 'SECRETARIA', 'OPERADOR_PISTA', 'JUIZ']);
  if (!auth.autorizado) return auth.response;

  try {
    const { id } = await context.params;

    const compRes = await query('SELECT * FROM competidores WHERE id = $1', [id]);
    if (compRes.rowCount === 0) {
      return NextResponse.json({ error: 'Competidor não encontrado' }, { status: 404 });
    }

    const c = compRes.rows[0];
    const podeVerDadosPessoais = auth.session.papel === 'ADMIN' || auth.session.papel === 'SECRETARIA';

    // 1. Buscar histórico de senhas em que atuou (como puxador ou esteireiro)
    const senhasRes = await query(
      `SELECT 
        s.id, s.codigo, s.status, s.categoria, s.estado_comercial, s.criado_em,
        s.puxador_nome, s.esteira_nome, s.cavalo_nome,
        v.nome as vaquejada_nome,
        k.codigo as numero_kit,
        CASE WHEN s.puxador_id = $1 THEN 'PUXADOR' ELSE 'ESTEIREIRO' END as papel_dupla
       FROM senhas s
       LEFT JOIN vaquejadas v ON s.vaquejada_id = v.id
       LEFT JOIN kits k ON s.kit_id = k.id
       WHERE s.puxador_id = $1 OR s.esteira_id = $1
       ORDER BY s.criado_em DESC`,
      [id]
    );

    // 2. Buscar histórico de corridas de pista e resultados
    const corridasRes = await query(
      `SELECT 
        cm.id as corrida_id, cm.senha_id, cm.boi_numero, cm.estado as status_corrida,
        cm.chamada_em, cm.concluida_em,
        s.codigo as senha_codigo,
        COALESCE(cm.resultado_final, rs.decisao_juiz) as resultado_final
       FROM corridas_mapa cm
       JOIN senhas s ON cm.senha_id = s.id
       LEFT JOIN resultados_senhas rs ON rs.senha_id = s.id
       WHERE s.puxador_id = $1 OR s.esteira_id = $1
       ORDER BY cm.criado_em DESC`,
      [id]
    );

    // 3. Calcular estatísticas de performance
    const totalCorridas = corridasRes.rows.filter(
      (r) => r.status_corrida === 'CONCLUIDA' || r.resultado_final
    ).length;
    const totalBoisValidos = corridasRes.rows.filter((r) => r.resultado_final === 'VALEU').length;
    const totalBoisZero = corridasRes.rows.filter((r) => r.resultado_final === 'ZERO').length;
    const aproveitamento = totalCorridas > 0 ? Math.round((totalBoisValidos / totalCorridas) * 100) : 0;

    // Registrar auditoria se acessou dados pessoais completos
    if (podeVerDadosPessoais) {
      await registrarAuditoria({
        usuarioId: auth.session.id,
        usuarioNome: auth.session.nome,
        papel: auth.session.papel,
        acao: 'CONSULTAR_HISTORICO_COMPETIDOR',
        entidade: 'competidores',
        entidadeId: id,
        detalhes: { nome: c.nome, totalSenhas: senhasRes.rowCount, totalCorridas },
        motivo: `Visualização de ficha e histórico do competidor por ${auth.session.nome}`,
      });
    }

    const competidor = podeVerDadosPessoais
      ? {
          id: c.id,
          nome: c.nome,
          apelido_pista: c.apelido_pista || '',
          cpf: formatarCpf(c.cpf),
          cidade: c.cidade || '',
          uf: c.uf || '',
          telefone: c.telefone || '',
          categoria: c.categoria || 'ABERTA',
          foto_url: c.foto_url || null,
          carteira_federacao: c.carteira_federacao || null,
          ativo: c.ativo,
          criado_em: c.criado_em,
          atualizado_em: c.atualizado_em,
        }
      : {
          id: c.id,
          nome: c.nome,
          apelido_pista: c.apelido_pista || '',
          categoria: c.categoria || 'ABERTA',
          foto_url: c.foto_url || null,
          ativo: c.ativo,
        };

    return NextResponse.json({
      competidor,
      estatisticas: {
        totalSenhas: senhasRes.rowCount,
        totalCorridas,
        totalBoisValidos,
        totalBoisZero,
        aproveitamentoPercentual: aproveitamento,
      },
      historicoSenhas: senhasRes.rows,
      historicoCorridas: corridasRes.rows,
    });
  } catch (error) {
    console.error('Erro ao consultar competidor:', error);
    return NextResponse.json({ error: 'Erro ao carregar dados do competidor' }, { status: 500 });
  }
}

// PUT /api/competidores/[id] - Atualizar dados do competidor
export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await exigirSessao(request, ['ADMIN', 'SECRETARIA']);
  if (!auth.autorizado) return auth.response;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const {
      nome,
      apelido_pista,
      cpf,
      cidade,
      uf,
      telefone,
      categoria,
      foto_url,
      carteira_federacao,
      ativo,
    } = body;

    const compExiste = await query('SELECT * FROM competidores WHERE id = $1', [id]);
    if (compExiste.rowCount === 0) {
      return NextResponse.json({ error: 'Competidor não encontrado' }, { status: 404 });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let pIdx = 1;

    if (nome && nome.trim().length >= 3) {
      updates.push(`nome = $${pIdx++}`);
      values.push(nome.trim());
    }

    if (apelido_pista !== undefined) {
      updates.push(`apelido_pista = $${pIdx++}`);
      values.push(apelido_pista?.trim() || null);
    }

    if (cpf) {
      if (!validarCpf(cpf)) {
        return NextResponse.json({ error: 'CPF inválido.' }, { status: 400 });
      }
      const cpfLimpo = limparCpf(cpf);
      const existeOutro = await query(
        `SELECT id FROM competidores WHERE regexp_replace(cpf, '[^0-9]', '', 'g') = $1 AND id != $2`,
        [cpfLimpo, id]
      );
      if (existeOutro.rowCount && existeOutro.rowCount > 0) {
        return NextResponse.json({ error: 'Este CPF já pertence a outro competidor.' }, { status: 409 });
      }
      updates.push(`cpf = $${pIdx++}`);
      values.push(formatarCpf(cpf));
    }

    if (cidade !== undefined) {
      updates.push(`cidade = $${pIdx++}`);
      values.push(cidade?.trim() || null);
    }

    if (uf !== undefined) {
      updates.push(`uf = $${pIdx++}`);
      values.push(uf?.trim()?.toUpperCase() || null);
    }

    if (telefone !== undefined) {
      updates.push(`telefone = $${pIdx++}`);
      values.push(telefone?.trim() || null);
    }

    if (categoria !== undefined) {
      updates.push(`categoria = $${pIdx++}`);
      values.push(categoria?.trim() || 'ABERTA');
    }

    if (foto_url !== undefined) {
      updates.push(`foto_url = $${pIdx++}`);
      values.push(foto_url?.trim() || null);
    }

    if (carteira_federacao !== undefined) {
      updates.push(`carteira_federacao = $${pIdx++}`);
      values.push(carteira_federacao?.trim() || null);
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

    const updateSql = `
      UPDATE competidores 
      SET ${updates.join(', ')} 
      WHERE id = $${pIdx} 
      RETURNING *
    `;

    const resUpdate = await query(updateSql, values);
    const atualizado = resUpdate.rows[0];

    await registrarAuditoria({
      usuarioId: auth.session.id,
      usuarioNome: auth.session.nome,
      papel: auth.session.papel,
      acao: 'ATUALIZAR_COMPETIDOR',
      entidade: 'competidores',
      entidadeId: id,
      detalhes: { alteracoes: body },
      motivo: `Atualização de cadastro de competidor por ${auth.session.nome}`,
    });

    return NextResponse.json({
      success: true,
      competidor: atualizado,
    });
  } catch (error) {
    console.error('Erro ao atualizar competidor:', error);
    return NextResponse.json({ error: 'Erro interno ao atualizar competidor' }, { status: 500 });
  }
}

// DELETE /api/competidores/[id] - Desativar competidor
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await exigirSessao(request, ['ADMIN', 'SECRETARIA']);
  if (!auth.autorizado) return auth.response;

  try {
    const { id } = await context.params;

    const res = await query(
      `UPDATE competidores 
       SET ativo = false, atualizado_em = CURRENT_TIMESTAMP 
       WHERE id = $1 
       RETURNING id, nome`,
      [id]
    );

    if (res.rowCount === 0) {
      return NextResponse.json({ error: 'Competidor não encontrado' }, { status: 404 });
    }

    await registrarAuditoria({
      usuarioId: auth.session.id,
      usuarioNome: auth.session.nome,
      papel: auth.session.papel,
      acao: 'DESATIVAR_COMPETIDOR',
      entidade: 'competidores',
      entidadeId: id,
      detalhes: { nome: res.rows[0].nome },
      motivo: `Competidor desativado por ${auth.session.nome}`,
    });

    return NextResponse.json({
      success: true,
      message: `Competidor "${res.rows[0].nome}" desativado com sucesso.`,
    });
  } catch (error) {
    console.error('Erro ao desativar competidor:', error);
    return NextResponse.json({ error: 'Erro ao desativar competidor' }, { status: 500 });
  }
}
