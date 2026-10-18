import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { registrarAuditoria } from '@/lib/audit';
import crypto from 'crypto';

// GET /api/secretaria/vendas - Lista senhas disponíveis para venda na secretaria
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const vaquejadaId = searchParams.get('vaquejadaId') || 'vq-2026-portal';

    const res = await pool.query(
      `SELECT 
        s.id,
        s.codigo,
        s.kit_id,
        s.vaquejada_id,
        s.categoria,
        s.tipo_venda,
        s.canal_venda,
        s.estado_comercial,
        s.valor_centavos,
        s.status,
        k.codigo as kit_codigo,
        CASE
          WHEN s.codigo ~ '^(\\d+)' THEN
            CASE WHEN (SUBSTRING(s.codigo FROM '^(\\d+)')::int) < 500 THEN 'BAIXA' ELSE 'ALTA' END
          WHEN s.codigo ~ 'SN-(\\d+)' THEN
            CASE WHEN (SUBSTRING(s.codigo FROM 'SN-(\\d+)')::int) < 50 THEN 'BAIXA' ELSE 'ALTA' END
          ELSE 'REGULAR'
        END as classificacao
       FROM senhas s
       LEFT JOIN kits k ON k.id = s.kit_id
       WHERE (s.vaquejada_id = $1 OR s.vaquejada_id IS NULL)
         AND s.status != 'CANCELADA'
         AND s.estado_comercial IN ('DISPONIVEL', 'RASCUNHO', 'AGUARDANDO_PAGAMENTO')
       ORDER BY s.codigo ASC`,
      [vaquejadaId]
    );

    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Erro ao listar senhas disponíveis:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar senhas disponíveis para venda' },
      { status: 500 }
    );
  }
}

// POST /api/secretaria/vendas - Realiza venda de senha ou kit completo com validações
export async function POST(request: Request) {
  const client = await pool.connect();

  try {
    const body = await request.json();

    const senhaCodigoRaw = String(body.senhaCodigo || body.codigo || '').trim();
    const senhaId = body.senhaId ? String(body.senhaId).trim() : null;

    if (!senhaCodigoRaw && !senhaId) {
      return NextResponse.json(
        { error: 'Código ou identificador da senha é obrigatório.' },
        { status: 400 }
      );
    }

    const puxadorNome = String(body.puxadorNome || '').trim();
    const esteiraNome = String(body.esteiraNome || '').trim();
    const cavaloNome = String(body.cavaloNome || '').trim();
    const categoria = String(body.categoria || 'PROFISSIONAL').trim().toUpperCase();
    const canalVenda = body.canalVenda === 'ANTECIPADA' ? 'ANTECIPADA' : 'PRESENCIAL';
    const formaPagamento = String(body.formaPagamento || 'PIX').toUpperCase();
    const secretarioNome = String(body.secretarioNome || 'Secretaria Geral').trim();
    const vaquejadaId = String(body.vaquejadaId || 'vq-2026-portal').trim();
    const valorCentavosInformado = Number(body.valorCentavos);

    if (!puxadorNome) {
      return NextResponse.json(
        { error: 'O nome do puxador é obrigatório.' },
        { status: 400 }
      );
    }
    if (!esteiraNome) {
      return NextResponse.json(
        { error: 'O nome do esteireiro é obrigatório.' },
        { status: 400 }
      );
    }
    if (!cavaloNome) {
      return NextResponse.json(
        { error: 'O nome do cavalo é obrigatório.' },
        { status: 400 }
      );
    }

    if (!['PIX', 'DINHEIRO', 'CARTAO', 'VALE'].includes(formaPagamento)) {
      return NextResponse.json(
        { error: 'Forma de pagamento inválida. Aceitos: PIX, DINHEIRO, CARTAO ou VALE.' },
        { status: 400 }
      );
    }

    await client.query('BEGIN');

    // 1. Validação de Dupla Duplicada configurável por Vaquejada (Padrão = Permitir)
    const vaqConfig = await client.query(
      `SELECT COALESCE(permitir_dupla_multiplas_senhas, true) as permitir_multiplas 
       FROM vaquejadas 
       WHERE id = $1`,
      [vaquejadaId]
    );
    const permitirMultiplas = vaqConfig.rows[0]?.permitir_multiplas ?? true;

    if (!permitirMultiplas) {
      const duplaExistente = await client.query(
        `SELECT s.id, s.codigo 
         FROM senhas s
         WHERE LOWER(TRIM(s.puxador_nome)) = LOWER($1)
           AND LOWER(TRIM(s.esteira_nome)) = LOWER($2)
           AND s.categoria = $3
           AND s.vaquejada_id = $4
           AND s.status = 'ATIVA'
           AND s.estado_comercial = 'PAGA'`,
        [puxadorNome, esteiraNome, categoria, vaquejadaId]
      );

      if (duplaExistente.rowCount && duplaExistente.rowCount > 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          {
            error: `Regra do evento: A dupla ${puxadorNome} & ${esteiraNome} já possui uma inscrição ativa nesta vaquejada na categoria ${categoria} (Senha ${duplaExistente.rows[0].codigo}).`
          },
          { status: 409 }
        );
      }
    }

    // 2. Localizar a senha informada
    let queryBusca = `
      SELECT s.*, k.codigo as kit_codigo
      FROM senhas s
      LEFT JOIN kits k ON k.id = s.kit_id
      WHERE (s.vaquejada_id = $1 OR s.vaquejada_id IS NULL)
    `;
    const paramsBusca: any[] = [vaquejadaId];

    if (senhaId) {
      paramsBusca.push(senhaId);
      queryBusca += ` AND s.id = $${paramsBusca.length}`;
    } else {
      // Tenta pelo código exato ou com padding de zeros
      const codComPad = /^\d+$/.test(senhaCodigoRaw) ? senhaCodigoRaw.padStart(3, '0') : senhaCodigoRaw;
      paramsBusca.push(senhaCodigoRaw, codComPad);
      queryBusca += ` AND (s.codigo = $${paramsBusca.length - 1} OR s.codigo = $${paramsBusca.length})`;
    }

    queryBusca += ` FOR UPDATE OF s`;

    const senhaPrincipalRes = await client.query(queryBusca, paramsBusca);

    if (senhaPrincipalRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: `Senha com código "${senhaCodigoRaw}" não encontrada no evento.` },
        { status: 404 }
      );
    }

    const senhaPrincipal = senhaPrincipalRes.rows[0];

    // Verificar se já está vendida
    if (['PAGA', 'VENDIDA', 'UTILIZADA', 'CANCELADA'].includes(senhaPrincipal.estado_comercial)) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: `A senha ${senhaPrincipal.codigo} não está disponível para venda (Estado atual: ${senhaPrincipal.estado_comercial}).` },
        { status: 409 }
      );
    }

    // 3. Se a senha pertence a um kit, buscar as demais senhas do mesmo kit
    let senhasDoProcesso: any[] = [senhaPrincipal];
    if (senhaPrincipal.kit_id) {
      const outrasSenhasKit = await client.query(
        `SELECT s.*, k.codigo as kit_codigo
         FROM senhas s
         LEFT JOIN kits k ON k.id = s.kit_id
         WHERE s.kit_id = $1 AND s.id != $2
         FOR UPDATE OF s`,
        [senhaPrincipal.kit_id, senhaPrincipal.id]
      );

      for (const outSenha of outrasSenhasKit.rows) {
        if (['PAGA', 'VENDIDA', 'UTILIZADA', 'CANCELADA'].includes(outSenha.estado_comercial)) {
          await client.query('ROLLBACK');
          return NextResponse.json(
            { error: `A senha parceira do kit (${outSenha.codigo}) já está ocupada ou cancelada. O kit não pode ser vendido.` },
            { status: 409 }
          );
        }
        senhasDoProcesso.push(outSenha);
      }
    }

    // 4. Buscar bois suficientes para todas as senhas (2 bois por senha)
    const boisNecessarios = senhasDoProcesso.length * 2;
    const boisRes = await client.query(
      `SELECT id, nome, numero_registro FROM bois ORDER BY RANDOM() LIMIT $1`,
      [Math.max(boisNecessarios, 2)]
    );

    if (boisRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'Não há bois cadastrados no sistema para alocação de pista.' },
        { status: 409 }
      );
    }

    const listaBois = boisRes.rows;
    const valorUnitarioCentavos = Number.isSafeInteger(valorCentavosInformado) && valorCentavosInformado > 0
      ? Math.round(valorCentavosInformado / senhasDoProcesso.length)
      : (senhaPrincipal.valor_centavos || 30000);

    const senhasVendidas: any[] = [];
    const todosBoisAlocados: string[] = [];

    // 5. Atualizar cada senha e gerar corridas no mapa
    for (let i = 0; i < senhasDoProcesso.length; i++) {
      const s = senhasDoProcesso[i];
      const boi1 = listaBois[(i * 2) % listaBois.length].id;
      const boi2 = listaBois[(i * 2 + 1) % listaBois.length].id;
      todosBoisAlocados.push(boi1, boi2);

      await client.query(
        `UPDATE senhas
         SET puxador_nome = $1,
             esteira_nome = $2,
             cavalo_nome = $3,
             categoria = $4,
             canal_venda = $5,
             estado_comercial = 'PAGA',
             status = 'ATIVA',
             valor_centavos = $6,
             boi1_id = $7,
             boi2_id = $8,
             usada_em = CURRENT_TIMESTAMP,
             atualizado_em = CURRENT_TIMESTAMP,
             vaquejada_id = $9
         WHERE id = $10`,
        [
          puxadorNome,
          esteiraNome,
          cavaloNome,
          categoria,
          canalVenda,
          valorUnitarioCentavos,
          boi1,
          boi2,
          vaquejadaId,
          s.id,
        ]
      );

      senhasVendidas.push({
        id: s.id,
        codigo: s.codigo,
        puxadorNome,
        esteiraNome,
        cavaloNome,
        categoria,
        valorCentavos: valorUnitarioCentavos,
        boi1,
        boi2,
      });

      // Gerar corridas correspondentes no mapa
      const maxOrdemRes = await client.query(
        `SELECT COALESCE(MAX(ordem_mapa), 0) AS max_ordem
         FROM corridas_mapa
         WHERE vaquejada_id = $1`,
        [vaquejadaId]
      );
      let ordem = Number(maxOrdemRes.rows[0]?.max_ordem || 0);

      for (const [idx, boiId] of [boi1, boi2].entries()) {
        ordem += 1;
        await client.query(
          `INSERT INTO corridas_mapa
             (id, vaquejada_id, senha_id, boi_id, boi_numero, tipo, ordem_mapa, estado)
           VALUES ($1, $2, $3, $4, $5, 'REGULAR', $6, 'NO_MAPA')`,
          [
            `cor-${crypto.randomUUID()}`,
            vaquejadaId,
            s.id,
            boiId,
            idx + 1,
            ordem,
          ]
        );
      }
    }

    // 6. Registrar pagamento total
    const valorTotalCentavos = valorUnitarioCentavos * senhasDoProcesso.length;
    const pagamentoId = `pag-${crypto.randomUUID()}`;

    await client.query(
      `INSERT INTO pagamentos
         (id, senha_id, tipo, valor_centavos, status, comprovante_detalhes)
       VALUES ($1, $2, $3, $4, 'CONFIRMADO', $5)`,
      [
        pagamentoId,
        senhasVendidas[0].id,
        formaPagamento,
        valorTotalCentavos,
        `Venda emitida na secretaria por ${secretarioNome}; Senhas: ${senhasVendidas.map(s => s.codigo).join(', ')}`,
      ]
    );

    await client.query('COMMIT');

    // 7. Log de Auditoria
    await registrarAuditoria({
      usuarioNome: secretarioNome,
      papel: 'SECRETARIO',
      acao: senhasVendidas.length > 1 ? 'VENDA_KIT_SENHAS' : 'VENDA_SENHA_AVULSA',
      entidade: 'senhas',
      entidadeId: senhasVendidas[0].id,
      detalhes: {
        senhas: senhasVendidas.map(s => s.codigo),
        puxador: puxadorNome,
        esteira: esteiraNome,
        cavalo: cavaloNome,
        formaPagamento,
        valorTotalCentavos,
      },
      motivo: `Venda registrada na secretaria (${formaPagamento})`,
    });

    return NextResponse.json({
      success: true,
      tipo: senhasVendidas.length > 1 ? 'KIT' : 'SOLTEIRA',
      totalSenhas: senhasVendidas.length,
      senhas: senhasVendidas,
      mensagem: `Venda da senha/kit ${senhasVendidas.map(s => s.codigo).join(' e ')} confirmada com sucesso!`,
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    console.error('Erro ao processar venda na secretaria:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao processar venda' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}