import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { registrarAuditoria } from '@/lib/audit';
import crypto from 'crypto';

const uuidv4 = () => crypto.randomUUID();

// GET /api/secretaria/boi-ouro - Lista solicitações de Boi de Ouro
export async function GET() {
  try {
    const res = await query(
      `SELECT 
        bo.id, bo.boi_id, bo.vaquejada_id, bo.valor, bo.valor_centavos,
        bo.pago, bo.pagamento_confirmado_em, bo.referencia_pagamento,
        bo.estado, bo.autorizado_por, bo.autorizado_em, bo.ativo,
        bo.senha_origem_id, bo.corrida_gerada_id, bo.criado_em,
        s.codigo as senha_codigo, s.puxador_nome, s.esteira_nome,
        b.nome as boi_nome, b.numero_registro as boi_numero_registro
       FROM bois_ouro bo
       LEFT JOIN senhas s ON s.id = bo.senha_origem_id
       LEFT JOIN bois b ON b.id = bo.boi_id
       ORDER BY bo.criado_em DESC`
    );

    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Erro ao buscar bois de ouro:', error);
    return NextResponse.json({ error: 'Erro ao buscar bois de ouro' }, { status: 500 });
  }
}

// POST /api/secretaria/boi-ouro - Solicitar, confirmar pagamento e autorizar Boi de Ouro (RN-05, RN-06, CA-11 a CA-14)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { acao, senhaOrigemId, boiId, vaquejadaId = 'vq-2026-portal', boiOuroId, referenciaPagamento, usuarioPapel = 'SECRETARIO', usuarioNome = 'Secretaria Geral' } = body;

    // 1. Solicitar Boi de Ouro (RN-05)
    if (acao === 'SOLICITAR') {
      if (!senhaOrigemId) {
        return NextResponse.json({ error: 'Senha de origem é obrigatória' }, { status: 400 });
      }

      // Buscar boi especial ou sortear boi da vaquejada
      const boiAlvo = boiId || 'boi-ouro-01';
      const id = `bdo-${uuidv4().slice(0, 8)}`;

      await query(
        `INSERT INTO bois_ouro 
         (id, boi_id, vaquejada_id, valor, valor_centavos, pago, estado, ativo, senha_origem_id)
         VALUES ($1, $2, $3, 200.00, 20000, false, 'AGUARDANDO_PAGAMENTO', false, $4)`,
        [id, boiAlvo, vaquejadaId, senhaOrigemId]
      );

      await registrarAuditoria({
        usuarioNome,
        papel: usuarioPapel,
        acao: 'SOLICITACAO_BOI_OURO',
        entidade: 'bois_ouro',
        entidadeId: id,
        detalhes: { senhaOrigemId, valorCentavos: 20000 },
        motivo: 'Competidor solicitou boi de ouro vinculado à senha original'
      });

      return NextResponse.json({ 
        success: true, 
        id, 
        estado: 'AGUARDANDO_PAGAMENTO', 
        mensagem: 'Boi de ouro solicitado. Aguardando confirmação do pagamento.' 
      });
    }

    // 2. Confirmar Pagamento do Boi de Ouro (RN-06, CA-12)
    if (acao === 'PAGAR') {
      if (!boiOuroId) {
        return NextResponse.json({ error: 'ID do boi de ouro é obrigatório' }, { status: 400 });
      }

      await query(
        `UPDATE bois_ouro 
         SET pago = true, pagamento_confirmado_em = CURRENT_TIMESTAMP, 
             referencia_pagamento = $1, estado = 'PAGO_AGUARDANDO_AUTORIZACAO' 
         WHERE id = $2`,
        [referenciaPagamento || 'PIX-CONFIRMADO-MANUAL', boiOuroId]
      );

      await registrarAuditoria({
        usuarioNome,
        papel: usuarioPapel,
        acao: 'PAGAMENTO_BOI_OURO_CONFIRMADO',
        entidade: 'bois_ouro',
        entidadeId: boiOuroId,
        detalhes: { referenciaPagamento },
        motivo: 'Pagamento confirmado. Aguardando autorização explícita da secretaria.'
      });

      return NextResponse.json({ 
        success: true, 
        estado: 'PAGO_AGUARDANDO_AUTORIZACAO',
        mensagem: 'Pagamento confirmado! O boi continua fora do mapa até autorização da Secretaria (RN-06).'
      });
    }

    // 3. Autorização Exclusiva da Secretaria (RN-06, CA-11, CA-13, CA-14)
    if (acao === 'AUTORIZAR_SECRETARIA') {
      // CA-14: Operador tenta aprovar -> API rejeita por permissão insuficiente!
      if (usuarioPapel !== 'SECRETARIO' && usuarioPapel !== 'ADMIN') {
        return NextResponse.json({ 
          error: 'Permissão insuficiente. Somente o perfil de SECRETARIA ou ADMIN pode autorizar boi de ouro no mapa.' 
        }, { status: 403 });
      }

      const boRes = await query('SELECT * FROM bois_ouro WHERE id = $1', [boiOuroId]);
      if (boRes.rows.length === 0) {
        return NextResponse.json({ error: 'Boi de ouro não encontrado' }, { status: 404 });
      }
      const bdo = boRes.rows[0];

      // CA-11: Boi de ouro não pago não pode ser liberado no mapa!
      if (!bdo.pago) {
        return NextResponse.json({ 
          error: 'Boi de ouro não pode ser liberado no mapa sem pagamento confirmado (CA-11).' 
        }, { status: 400 });
      }

      // Impedir duplicidade no mapa (Seção 3.4)
      if (bdo.ativo || bdo.corrida_gerada_id) {
        return NextResponse.json({ error: 'Este boi de ouro já foi incluído no mapa anteriormente.' }, { status: 400 });
      }

      // Inserir no mapa geral (CA-13)
      const maxOrdemRes = await query(
        'SELECT COALESCE(MAX(ordem_mapa), 0) + 1 as prox_ordem FROM corridas_mapa WHERE vaquejada_id = $1',
        [bdo.vaquejada_id]
      );
      const proxOrdem = maxOrdemRes.rows[0].prox_ordem;
      const corridaId = `cor-bdo-${uuidv4().slice(0, 8)}`;

      await query(
        `INSERT INTO corridas_mapa 
         (id, vaquejada_id, senha_id, boi_id, boi_numero, tipo, ordem_mapa, estado)
         VALUES ($1, $2, $3, $4, 3, 'BOI_DE_OURO', $5, 'NO_MAPA')`,
        [corridaId, bdo.vaquejada_id, bdo.senha_origem_id, bdo.boi_id, proxOrdem]
      );

      // Atualizar status do Boi de Ouro
      await query(
        `UPDATE bois_ouro 
         SET estado = 'NO_MAPA', ativo = true, autorizado_por = $1, autorizado_em = CURRENT_TIMESTAMP, corrida_gerada_id = $2 
         WHERE id = $3`,
        [usuarioNome, corridaId, boiOuroId]
      );

      await registrarAuditoria({
        usuarioNome,
        papel: usuarioPapel,
        acao: 'AUTORIZACAO_BOI_OURO_MAPA',
        entidade: 'bois_ouro',
        entidadeId: boiOuroId,
        detalhes: { corridaGeradaId: corridaId, ordemMapa: proxOrdem },
        motivo: 'Secretaria aprovou a inclusão do boi de ouro pago no mapa de corridas'
      });

      return NextResponse.json({
        success: true,
        estado: 'NO_MAPA',
        corridaGeradaId: corridaId,
        ordemMapa: proxOrdem,
        mensagem: 'Boi de ouro autorizado com sucesso pela secretaria e inserido no mapa geral!'
      });
    }

    return NextResponse.json({ error: 'Ação não reconhecida' }, { status: 400 });
  } catch (error) {
    console.error('Erro na rota /api/secretaria/boi-ouro:', error);
    return NextResponse.json({ error: 'Erro interno ao processar boi de ouro' }, { status: 500 });
  }
}
