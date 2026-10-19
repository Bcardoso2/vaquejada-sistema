import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { exigirSessao } from '@/lib/api-auth';
import { registrarAuditoria } from '@/lib/audit';

// GET /api/baterias - Listar baterias da vaquejada ativa com progresso
export async function GET(request: NextRequest) {
  const auth = await exigirSessao(request, ['ADMIN', 'SECRETARIA', 'OPERADOR_PISTA', 'JUIZ']);
  if (!auth.autorizado) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const vaquejadaId = searchParams.get('vaquejada_id') || 'vq-2026-portal';

    const bateriasRes = await query(
      `SELECT 
        b.id, b.vaquejada_id, b.numero, b.categoria, b.tamanho_maximo, b.status,
        b.criada_em, b.iniciada_em, b.fechada_em,
        COUNT(cm.id) as total_corridas,
        COUNT(CASE WHEN cm.estado = 'CONCLUIDA' THEN 1 END) as corridas_concluidas,
        COUNT(CASE WHEN cm.estado = 'EM_EXECUCAO' THEN 1 END) as corridas_em_execucao,
        COUNT(CASE WHEN cm.tipo_entrada = 'RETARDATARIA' THEN 1 END) as total_retardatarias,
        COUNT(CASE WHEN cm.tipo_entrada = 'RETORNO' THEN 1 END) as total_retornos
       FROM baterias b
       LEFT JOIN corridas_mapa cm ON cm.bateria_id = b.id
       WHERE b.vaquejada_id = $1
       GROUP BY b.id
       ORDER BY b.numero ASC`,
      [vaquejadaId]
    );

    return NextResponse.json(bateriasRes.rows);
  } catch (error) {
    console.error('Erro ao listar baterias:', error);
    return NextResponse.json({ error: 'Erro ao carregar baterias' }, { status: 500 });
  }
}

// POST /api/baterias - Gerenciar baterias (Gerar, Fechar, Encaixar)
export async function POST(request: NextRequest) {
  const auth = await exigirSessao(request, ['ADMIN', 'OPERADOR_PISTA']);
  if (!auth.autorizado) return auth.response;

  try {
    const body = await request.json();
    const { acao, vaquejada_id = 'vq-2026-portal', tamanho_bateria, bateria_id, corrida_id, tipo = 'RETARDATARIA' } = body;

    // ACAO 1: GERAR BATERIAS AUTOMATICAMENTE
    if (acao === 'GERAR') {
      const tamanho = parseInt(tamanho_bateria || '15', 10);
      if (tamanho < 3 || tamanho > 50) {
        return NextResponse.json({ error: 'Tamanho da bateria deve ser entre 3 e 50 duplas' }, { status: 400 });
      }

      // Buscar todas as corridas da vaquejada ordenadas
      const corridasRes = await query(
        `SELECT id FROM corridas_mapa 
         WHERE vaquejada_id = $1 
         ORDER BY ordem_mapa ASC, criado_em ASC`,
        [vaquejada_id]
      );

      if (corridasRes.rowCount === 0) {
        return NextResponse.json({ error: 'Nenhuma corrida encontrada para agrupar em baterias' }, { status: 400 });
      }

      // Remover baterias antigas desta vaquejada para reestruturar
      await query(`UPDATE corridas_mapa SET bateria_id = NULL, ordem_na_bateria = NULL WHERE vaquejada_id = $1`, [vaquejada_id]);
      await query(`DELETE FROM baterias WHERE vaquejada_id = $1`, [vaquejada_id]);

      const totalCorridas = corridasRes.rowCount || 0;
      const totalBaterias = Math.ceil(totalCorridas / tamanho);

      for (let b = 1; b <= totalBaterias; b++) {
        const bId = `bat-${b}-${vaquejada_id}`;
        const statusBateria = b === 1 ? 'EM_ANDAMENTO' : 'ABERTA';

        await query(
          `INSERT INTO baterias (id, vaquejada_id, numero, tamanho_maximo, status, iniciada_em)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [bId, vaquejada_id, b, tamanho, statusBateria, b === 1 ? new Date() : null]
        );

        // Associar o lote de corridas à bateria
        const inicio = (b - 1) * tamanho;
        const fim = Math.min(inicio + tamanho, totalCorridas);

        for (let i = inicio; i < fim; i++) {
          const corrida = corridasRes.rows[i];
          const ordemNaBateria = (i - inicio) + 1;
          await query(
            `UPDATE corridas_mapa 
             SET bateria_id = $1, ordem_na_bateria = $2, tipo_entrada = 'REGULAR'
             WHERE id = $3`,
            [bId, ordemNaBateria, corrida.id]
          );
        }
      }

      // Atualizar vaquejada com o tamanho padrão
      await query(`UPDATE vaquejadas SET tamanho_bateria_padrao = $1 WHERE id = $2`, [tamanho, vaquejada_id]);

      await registrarAuditoria({
        usuarioId: auth.session.id,
        usuarioNome: auth.session.nome,
        papel: auth.session.papel,
        acao: 'GERAR_BATERIAS',
        entidade: 'baterias',
        detalhes: { vaquejadaId: vaquejada_id, totalCorridas, totalBaterias, tamanho },
        motivo: `Geração automática de ${totalBaterias} baterias de ${tamanho} duplas`,
      });

      return NextResponse.json({
        mensagem: `${totalBaterias} baterias geradas com sucesso para ${totalCorridas} corridas.`,
        totalBaterias,
        totalCorridas,
      });
    }

    // ACAO 2: FECHAR BATERIA ATUAL E AVANÇAR
    if (acao === 'FECHAR') {
      if (!bateria_id) return NextResponse.json({ error: 'ID da bateria é obrigatório' }, { status: 400 });

      const batExiste = await query(`SELECT * FROM baterias WHERE id = $1`, [bateria_id]);
      if (batExiste.rowCount === 0) return NextResponse.json({ error: 'Bateria não encontrada' }, { status: 404 });

      const batAtual = batExiste.rows[0];

      // Marcar como FECHADA
      await query(
        `UPDATE baterias SET status = 'FECHADA', fechada_em = CURRENT_TIMESTAMP WHERE id = $1`,
        [bateria_id]
      );

      // Abrir a próxima bateria se existir
      const proxNumero = batAtual.numero + 1;
      const proxBat = await query(
        `UPDATE baterias 
         SET status = 'EM_ANDAMENTO', iniciada_em = CURRENT_TIMESTAMP 
         WHERE vaquejada_id = $1 AND numero = $2 
         RETURNING id, numero`,
        [batAtual.vaquejada_id, proxNumero]
      );

      await registrarAuditoria({
        usuarioId: auth.session.id,
        usuarioNome: auth.session.nome,
        papel: auth.session.papel,
        acao: 'FECHAR_BATERIA',
        entidade: 'baterias',
        entidadeId: bateria_id,
        detalhes: { bateriaNumero: batAtual.numero, proximaBateria: proxBat.rows[0]?.numero || null },
        motivo: `Fechamento da Bateria ${batAtual.numero} pelo operador`,
      });

      return NextResponse.json({
        mensagem: `Bateria ${batAtual.numero} fechada com sucesso.`,
        proximaBateria: proxBat.rows[0] || null,
      });
    }

    // ACAO 3: ENCAIXAR RETARDATARIA OU BOI DE RETORNO NA BATERIA
    if (acao === 'ENCAIXAR') {
      if (!bateria_id || !corrida_id) {
        return NextResponse.json({ error: 'bateria_id e corrida_id são obrigatórios' }, { status: 400 });
      }

      // Buscar maior ordem_na_bateria atual
      const maxOrdemRes = await query(
        `SELECT COALESCE(MAX(ordem_na_bateria), 0) as max_ordem 
         FROM corridas_mapa WHERE bateria_id = $1`,
        [bateria_id]
      );
      const novaOrdem = parseInt(maxOrdemRes.rows[0].max_ordem, 10) + 1;

      await query(
        `UPDATE corridas_mapa 
         SET bateria_id = $1, ordem_na_bateria = $2, tipo_entrada = $3, estado = 'EM_ESPERA'
         WHERE id = $4`,
        [bateria_id, novaOrdem, tipo, corrida_id]
      );

      await registrarAuditoria({
        usuarioId: auth.session.id,
        usuarioNome: auth.session.nome,
        papel: auth.session.papel,
        acao: `ENCAIXAR_${tipo}`,
        entidade: 'corridas_mapa',
        entidadeId: corrida_id,
        detalhes: { bateriaId: bateria_id, tipo, novaOrdem },
        motivo: `Encaixe de ${tipo} na ordem ${novaOrdem} da bateria`,
      });

      return NextResponse.json({
        mensagem: `Corrida encaixada com sucesso na bateria como ${tipo} na posição ${novaOrdem}.`,
        novaOrdem,
      });
    }

    return NextResponse.json({ error: 'Ação não reconhecida (use GERAR, FECHAR ou ENCAIXAR)' }, { status: 400 });
  } catch (error) {
    console.error('Erro na gestão de baterias:', error);
    return NextResponse.json({ error: 'Erro ao processar ação de baterias' }, { status: 500 });
  }
}
