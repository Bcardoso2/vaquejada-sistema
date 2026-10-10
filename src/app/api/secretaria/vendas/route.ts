import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { registrarAuditoria } from '@/lib/audit';
import crypto from 'crypto';

const uuidv4 = () => crypto.randomUUID();

// POST /api/secretaria/vendas - Emissão de Kits e Senhas Solteiras (RN-01, RN-02, CA-01, CA-02)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      tipoVenda, // 'KIT' ou 'SOLTEIRA'
      canalVenda, // 'PRESENCIAL' ou 'ANTECIPADA'
      puxadorNome,
      esteiraNome,
      categoria,
      vaquejadaId = 'vq-2026-portal',
      valorCentavos,
      secretarioNome = 'Secretaria Geral'
    } = body;

    if (!puxadorNome || !esteiraNome) {
      return NextResponse.json({ error: 'Puxador e Esteira são obrigatórios' }, { status: 400 });
    }

    // Buscar bois disponíveis para alocar (2 bois por senha)
    const boisRes = await query('SELECT id FROM bois ORDER BY RANDOM() LIMIT 4');
    const bois = boisRes.rows.map((r: any) => r.id);
    const boi1 = bois[0] || 'boi-101';
    const boi2 = bois[1] || 'boi-102';
    const boi3 = bois[2] || 'boi-103';
    const boi4 = bois[3] || 'boi-104';

    const timestampCode = Math.floor(1000 + Math.random() * 9000);

    // Pegar última ordem do mapa
    const maxOrdemRes = await query(
      'SELECT COALESCE(MAX(ordem_mapa), 0) as max_ordem FROM corridas_mapa WHERE vaquejada_id = $1',
      [vaquejadaId]
    );
    let ordemAtual = maxOrdemRes.rows[0].max_ordem;

    if (tipoVenda === 'KIT') {
      // RN-01: "Um kit contém duas senhas independentes, cada uma com duas oportunidades iniciais (quatro no total)."
      const kitId = `kit-${uuidv4().slice(0, 8)}`;
      const kitCodigo = `KIT-${timestampCode}`;

      await query(
        `INSERT INTO kits (id, vaquejada_id, codigo) VALUES ($1, $2, $3)`,
        [kitId, vaquejadaId, kitCodigo]
      );

      // Senha 1 do Kit
      const s1Id = `sn-${uuidv4().slice(0, 8)}`;
      const s1Codigo = `SN-${timestampCode}-A`;
      await query(
        `INSERT INTO senhas 
         (id, kit_id, vaquejada_id, codigo, boi1_id, boi2_id, status, puxador_nome, esteira_nome, categoria, tipo_venda, canal_venda, estado_comercial, valor_centavos)
         VALUES ($1, $2, $3, $4, $5, $6, 'ATIVA', $7, $8, $9, 'KIT', $10, 'PAGA', $11)`,
        [s1Id, kitId, vaquejadaId, s1Codigo, boi1, boi2, puxadorNome, esteiraNome, categoria || 'ABERTA', canalVenda || 'PRESENCIAL', valorCentavos || 60000]
      );

      // Inserir os 2 bois da Senha 1 no Mapa Geral
      ordemAtual++;
      await query(
        `INSERT INTO corridas_mapa (id, vaquejada_id, senha_id, boi_id, boi_numero, tipo, ordem_mapa, estado)
         VALUES ($1, $2, $3, $4, 1, 'REGULAR', $5, 'NO_MAPA')`,
        [`cor-${uuidv4().slice(0, 8)}`, vaquejadaId, s1Id, boi1, ordemAtual]
      );
      ordemAtual++;
      await query(
        `INSERT INTO corridas_mapa (id, vaquejada_id, senha_id, boi_id, boi_numero, tipo, ordem_mapa, estado)
         VALUES ($1, $2, $3, $4, 2, 'REGULAR', $5, 'NO_MAPA')`,
        [`cor-${uuidv4().slice(0, 8)}`, vaquejadaId, s1Id, boi2, ordemAtual]
      );

      // Senha 2 do Kit (Independente - RN-02)
      const s2Id = `sn-${uuidv4().slice(0, 8)}`;
      const s2Codigo = `SN-${timestampCode}-B`;
      await query(
        `INSERT INTO senhas 
         (id, kit_id, vaquejada_id, codigo, boi1_id, boi2_id, status, puxador_nome, esteira_nome, categoria, tipo_venda, canal_venda, estado_comercial, valor_centavos)
         VALUES ($1, $2, $3, $4, $5, $6, 'ATIVA', $7, $8, $9, 'KIT', $10, 'PAGA', $11)`,
        [s2Id, kitId, vaquejadaId, s2Codigo, boi3, boi4, puxadorNome, esteiraNome, categoria || 'ABERTA', canalVenda || 'PRESENCIAL', valorCentavos || 60000]
      );

      // Inserir os 2 bois da Senha 2 no Mapa Geral
      ordemAtual++;
      await query(
        `INSERT INTO corridas_mapa (id, vaquejada_id, senha_id, boi_id, boi_numero, tipo, ordem_mapa, estado)
         VALUES ($1, $2, $3, $4, 1, 'REGULAR', $5, 'NO_MAPA')`,
        [`cor-${uuidv4().slice(0, 8)}`, vaquejadaId, s2Id, boi3, ordemAtual]
      );
      ordemAtual++;
      await query(
        `INSERT INTO corridas_mapa (id, vaquejada_id, senha_id, boi_id, boi_numero, tipo, ordem_mapa, estado)
         VALUES ($1, $2, $3, $4, 2, 'REGULAR', $5, 'NO_MAPA')`,
        [`cor-${uuidv4().slice(0, 8)}`, vaquejadaId, s2Id, boi4, ordemAtual]
      );

      await registrarAuditoria({
        usuarioNome: secretarioNome,
        papel: 'SECRETARIO',
        acao: 'VENDA_KIT_DUPLO',
        entidade: 'kits',
        entidadeId: kitId,
        detalhes: { kitCodigo, senhas: [s1Codigo, s2Codigo], canalVenda, puxadorNome },
        motivo: `Venda de Kit realizada pela secretaria (${canalVenda})`
      });

      return NextResponse.json({
        success: true,
        tipo: 'KIT',
        kit: { id: kitId, codigo: kitCodigo },
        senhas: [
          { id: s1Id, codigo: s1Codigo, bois: [boi1, boi2] },
          { id: s2Id, codigo: s2Codigo, bois: [boi3, boi4] }
        ],
        totalBoisLiberadosNoMapa: 4,
        mensagem: 'Kit vendido com sucesso! 2 senhas independentes geradas com 4 bois inseridos no mapa.'
      });
    } else {
      // SENHA SOLTEIRA (RN-01, CA-02)
      const kitAvulsoId = `kit-solt-${uuidv4().slice(0, 8)}`;
      await query(
        `INSERT INTO kits (id, vaquejada_id, codigo) VALUES ($1, $2, $3)`,
        [kitAvulsoId, vaquejadaId, `AVULSO-${timestampCode}`]
      );

      const sId = `sn-${uuidv4().slice(0, 8)}`;
      const sCodigo = `SOLT-${timestampCode}`;
      await query(
        `INSERT INTO senhas 
         (id, kit_id, vaquejada_id, codigo, boi1_id, boi2_id, status, puxador_nome, esteira_nome, categoria, tipo_venda, canal_venda, estado_comercial, valor_centavos)
         VALUES ($1, $2, $3, $4, $5, $6, 'ATIVA', $7, $8, $9, 'SOLTEIRA', $10, 'PAGA', $11)`,
        [sId, kitAvulsoId, vaquejadaId, sCodigo, boi1, boi2, puxadorNome, esteiraNome, categoria || 'ABERTA', canalVenda || 'PRESENCIAL', valorCentavos || 35000]
      );

      // Inserir os 2 bois da Senha Solteira no Mapa Geral
      ordemAtual++;
      await query(
        `INSERT INTO corridas_mapa (id, vaquejada_id, senha_id, boi_id, boi_numero, tipo, ordem_mapa, estado)
         VALUES ($1, $2, $3, $4, 1, 'REGULAR', $5, 'NO_MAPA')`,
        [`cor-${uuidv4().slice(0, 8)}`, vaquejadaId, sId, boi1, ordemAtual]
      );
      ordemAtual++;
      await query(
        `INSERT INTO corridas_mapa (id, vaquejada_id, senha_id, boi_id, boi_numero, tipo, ordem_mapa, estado)
         VALUES ($1, $2, $3, $4, 2, 'REGULAR', $5, 'NO_MAPA')`,
        [`cor-${uuidv4().slice(0, 8)}`, vaquejadaId, sId, boi2, ordemAtual]
      );

      await registrarAuditoria({
        usuarioNome: secretarioNome,
        papel: 'SECRETARIO',
        acao: 'VENDA_SENHA_SOLTEIRA',
        entidade: 'senhas',
        entidadeId: sId,
        detalhes: { sCodigo, canalVenda, puxadorNome },
        motivo: `Venda de Senha Solteira realizada pela secretaria (${canalVenda})`
      });

      return NextResponse.json({
        success: true,
        tipo: 'SOLTEIRA',
        senha: { id: sId, codigo: sCodigo, bois: [boi1, boi2] },
        totalBoisLiberadosNoMapa: 2,
        mensagem: 'Senha solteira vendida com sucesso! 2 bois inseridos no mapa.'
      });
    }
  } catch (error) {
    console.error('Erro ao emitir venda de senha:', error);
    return NextResponse.json({ error: 'Erro ao emitir venda de senha' }, { status: 500 });
  }
}
