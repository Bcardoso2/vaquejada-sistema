import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { registrarAuditoria } from '@/lib/audit';
import crypto from 'crypto';

export async function POST(request: Request) {
  const client = await pool.connect();
  let vendaAuditada: {
    id: string;
    codigo: string;
    puxadorNome: string;
    esteiraNome: string;
    cavaloNome: string;
    formaPagamento: string;
    valorCentavos: number;
    canalVenda: string;
    secretarioNome: string;
    bois: string[];
  } | null = null;

  try {
    const body = await request.json();

    const codigoInformado = String(body.senhaCodigo || '').trim();
    const codigo = /^\d{1,3}$/.test(codigoInformado)
      ? codigoInformado.padStart(3, '0')
      : codigoInformado;

    const puxadorNome = String(body.puxadorNome || '').trim();
    const esteiraNome = String(body.esteiraNome || '').trim();
    const cavaloNome = String(body.cavaloNome || '').trim();
    const categoria = String(body.categoria || 'PROFISSIONAL').trim();
    const canalVenda = body.canalVenda === 'ANTECIPADA'
      ? 'ANTECIPADA'
      : 'PRESENCIAL';
    const formaPagamento = String(body.formaPagamento || '').toUpperCase();
    const secretarioNome = String(body.secretarioNome || 'Secretaria Geral').trim();
    const vaquejadaId = 'vq-2026-portal';
    const valorCentavos = Number(body.valorCentavos);

    if (!/^(0\d{2}|1\d{2}|200|8\d{2}|9\d{2})$/.test(codigo) ||
        Number(codigo) < 1 || Number(codigo) > 999 ||
        (Number(codigo) > 200 && Number(codigo) < 800)) {
      return NextResponse.json(
        { error: 'Selecione uma senha válida entre 001–200 ou 800–999.' },
        { status: 400 }
      );
    }

    if (!puxadorNome || !esteiraNome || !cavaloNome) {
      return NextResponse.json(
        { error: 'Informe puxador, esteira e nome do cavalo.' },
        { status: 400 }
      );
    }

    if (!['PIX', 'DINHEIRO', 'VALE'].includes(formaPagamento)) {
      return NextResponse.json(
        { error: 'Forma de pagamento inválida. Use PIX, dinheiro ou vale.' },
        { status: 400 }
      );
    }

    if (!Number.isSafeInteger(valorCentavos) || valorCentavos < 0) {
      return NextResponse.json(
        { error: 'Informe um valor válido para a venda.' },
        { status: 400 }
      );
    }

    await client.query('BEGIN');

    const senhaRes = await client.query(
      `SELECT s.*
         FROM senhas s
         JOIN kits k ON k.id = s.kit_id
        WHERE s.codigo = $1
          AND s.vaquejada_id = $2
          AND k.codigo = 'INV-INDIVIDUAL'
        FOR UPDATE OF s`,
      [codigo, vaquejadaId]
    );

    const senha = senhaRes.rows[0];

    if (!senha) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: `A senha ${codigo} não existe no inventário individual.` },
        { status: 404 }
      );
    }

    if (senha.estado_comercial !== 'DISPONIVEL') {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: `A senha ${codigo} já está ocupada ou foi vendida.` },
        { status: 409 }
      );
    }

    const boisRes = await client.query(
      'SELECT id FROM bois ORDER BY RANDOM() LIMIT 2'
    );

    if (boisRes.rows.length < 2) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'É necessário cadastrar pelo menos dois bois antes de vender.' },
        { status: 409 }
      );
    }

    const boi1 = boisRes.rows[0].id;
    const boi2 = boisRes.rows[1].id;

    const atualizacao = await client.query(
      `UPDATE senhas
          SET puxador_nome = $1,
              esteira_nome = $2,
              cavalo_nome = $3,
              categoria = $4,
              tipo_venda = 'SOLTEIRA',
              canal_venda = $5,
              estado_comercial = 'PAGA',
              valor_centavos = $6,
              boi1_id = $7,
              boi2_id = $8,
              usada_em = CURRENT_TIMESTAMP,
              atualizado_em = CURRENT_TIMESTAMP
        WHERE id = $9
          AND estado_comercial = 'DISPONIVEL'
        RETURNING id, codigo`,
      [
        puxadorNome, esteiraNome, cavaloNome, categoria, canalVenda,
        valorCentavos, boi1, boi2, senha.id
      ]
    );

    if (atualizacao.rowCount !== 1) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'Esta senha acabou de ser vendida por outro atendimento. Atualize a lista.' },
        { status: 409 }
      );
    }

    const pagamentoId = `pag-${crypto.randomUUID()}`;

    await client.query(
      `INSERT INTO pagamentos
         (id, senha_id, tipo, valor_centavos, status, comprovante_detalhes)
       VALUES ($1, $2, $3, $4, 'CONFIRMADO', $5)`,
      [
        pagamentoId,
        senha.id,
        formaPagamento,
        valorCentavos,
        `Venda presencial/antecipada; senha ${codigo}; secretaria: ${secretarioNome}`
      ]
    );

    const maxOrdemRes = await client.query(
      `SELECT COALESCE(MAX(ordem_mapa), 0) AS max_ordem
         FROM corridas_mapa
        WHERE vaquejada_id = $1`,
      [vaquejadaId]
    );

    let ordem = Number(maxOrdemRes.rows[0]?.max_ordem || 0);

    for (const [index, boiId] of [boi1, boi2].entries()) {
      ordem += 1;
      await client.query(
        `INSERT INTO corridas_mapa
           (id, vaquejada_id, senha_id, boi_id, boi_numero, tipo, ordem_mapa, estado)
         VALUES ($1, $2, $3, $4, $5, 'REGULAR', $6, 'NO_MAPA')`,
        [
          `cor-${crypto.randomUUID()}`,
          vaquejadaId,
          senha.id,
          boiId,
          index + 1,
          ordem
        ]
      );
    }

    vendaAuditada = {
      id: senha.id,
      codigo,
      puxadorNome,
      esteiraNome,
      cavaloNome,
      formaPagamento,
      valorCentavos,
      canalVenda,
      secretarioNome,
      bois: [boi1, boi2]
    };

    await client.query('COMMIT');

    await registrarAuditoria({
      usuarioNome: secretarioNome,
      papel: 'SECRETARIO',
      acao: 'VENDA_SENHA_INVENTARIO',
      entidade: 'senhas',
      entidadeId: senha.id,
      detalhes: vendaAuditada,
      motivo: `Venda da senha existente ${codigo}; pagamento ${formaPagamento}`
    });

    return NextResponse.json({
      success: true,
      tipo: 'SOLTEIRA',
      senha: {
        id: senha.id,
        codigo,
        puxadorNome,
        esteiraNome,
        cavaloNome,
        formaPagamento,
        valorCentavos,
        bois: [boi1, boi2]
      },
      mensagem: `Senha ${codigo} vendida com pagamento confirmado.`
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    console.error('Erro ao vender senha do inventário:', error);
    return NextResponse.json(
      { error: 'Não foi possível concluir a venda. Nenhuma confirmação deve ser presumida.' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
