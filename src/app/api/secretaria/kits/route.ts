import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { exigirSessao } from '@/lib/api-auth';

interface SenhaRow {
  id: string;
  codigo: string;
  kit_id: string | null;
  kit_codigo: string | null;
  vaquejada_id: string | null;
  categoria: string;
  estado_comercial: string;
  valor_centavos: number | null;
  status: string;
}

export interface KitMontado {
  id: string;
  codigo: string;
  numero: number | null;
  status: 'DISPONIVEL' | 'VENDIDO' | 'PARCIAL' | 'BLOQUEADO';
  valorCentavos: number;
  categoria: string;
  senhaBaixa: {
    id: string;
    codigo: string;
    numero: number | null;
    estado_comercial: string;
    disponivel: boolean;
  };
  senhaAlta: {
    id: string;
    codigo: string;
    numero: number | null;
    estado_comercial: string;
    disponivel: boolean;
  };
}

function extrairNumero(cod: string): number | null {
  const m = String(cod).match(/(\d+)\s*$/) ?? String(cod).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

const ESTADOS_DISPONIVEIS = ['DISPONIVEL', 'RASCUNHO', 'AGUARDANDO_PAGAMENTO'];
const ESTADOS_VENDIDOS = ['PAGA', 'VENDIDA', 'UTILIZADA', 'CANCELADA'];

// GET /api/secretaria/kits - Lista kits pareados de senhas (Baixa + Alta) com lógica híbrida
export async function GET(request: NextRequest) {
  const auth = await exigirSessao(request, ['SECRETARIA']);
  if (!auth.autorizado) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const vaquejadaId = searchParams.get('vaquejadaId') || 'vq-2026-portal';

    // 1. Buscar todas as senhas da vaquejada
    const resSenhas = await pool.query(
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
        k.codigo as kit_codigo
       FROM senhas s
       LEFT JOIN kits k ON k.id = s.kit_id
       WHERE (s.vaquejada_id = $1 OR s.vaquejada_id IS NULL)
         AND s.status != 'CANCELADA'
       ORDER BY s.codigo ASC`,
      [vaquejadaId]
    );

    const todasSenhas: SenhaRow[] = resSenhas.rows;

    const kitsMontados: KitMontado[] = [];
    const senhasProcessadas = new Set<string>();

    // 2. Passo 1 do Híbrido: Agrupar por kit_id se houver senhas compartilhando o mesmo kit_id
    const porKitId = new Map<string, SenhaRow[]>();
    for (const s of todasSenhas) {
      if (s.kit_id) {
        const lista = porKitId.get(s.kit_id) || [];
        lista.push(s);
        porKitId.set(s.kit_id, lista);
      }
    }

    for (const [kitId, grupo] of porKitId.entries()) {
      if (grupo.length === 2) {
        // Ordena para que a de menor número (ou código) seja a Baixa e a maior seja a Alta
        const ordenadas = [...grupo].sort((a, b) => {
          const numA = extrairNumero(a.codigo) ?? 0;
          const numB = extrairNumero(b.codigo) ?? 0;
          if (numA !== numB) return numA - numB;
          return a.codigo.localeCompare(b.codigo);
        });

        const sBaixa = ordenadas[0];
        const sAlta = ordenadas[1];

        const baixaLivre = ESTADOS_DISPONIVEIS.includes(sBaixa.estado_comercial);
        const altaLivre = ESTADOS_DISPONIVEIS.includes(sAlta.estado_comercial);

        let statusKit: KitMontado['status'] = 'BLOQUEADO';
        if (baixaLivre && altaLivre) statusKit = 'DISPONIVEL';
        else if (!baixaLivre && !altaLivre) statusKit = 'VENDIDO';
        else statusKit = 'PARCIAL';

        const numBaixa = extrairNumero(sBaixa.codigo);
        const numAlta = extrairNumero(sAlta.codigo);
        const valorTotal = (sBaixa.valor_centavos || 30000) + (sAlta.valor_centavos || 30000);

        kitsMontados.push({
          id: kitId,
          codigo: sBaixa.kit_codigo || `KIT-${sBaixa.codigo}`,
          numero: numBaixa,
          status: statusKit,
          valorCentavos: valorTotal,
          categoria: sBaixa.categoria || 'PROFISSIONAL',
          senhaBaixa: {
            id: sBaixa.id,
            codigo: sBaixa.codigo,
            numero: numBaixa,
            estado_comercial: sBaixa.estado_comercial,
            disponivel: baixaLivre,
          },
          senhaAlta: {
            id: sAlta.id,
            codigo: sAlta.codigo,
            numero: numAlta,
            estado_comercial: sAlta.estado_comercial,
            disponivel: altaLivre,
          },
        });

        senhasProcessadas.add(sBaixa.id);
        senhasProcessadas.add(sAlta.id);
      }
    }

    // 3. Passo 2 do Híbrido: Senhas restantes - Pareamento automático por faixa ou correspondência
    const senhasRestantes = todasSenhas.filter((s) => !senhasProcessadas.has(s.id));

    // Mapa de número -> senha
    const mapPorNumero = new Map<number, SenhaRow>();
    const semNumero: SenhaRow[] = [];

    for (const s of senhasRestantes) {
      const n = extrairNumero(s.codigo);
      if (n !== null) {
        mapPorNumero.set(n, s);
      } else {
        semNumero.push(s);
      }
    }

    // Tenta parear senhas baixas (1 a 500) com altas (800+ ou offset comum)
    const numeros = Array.from(mapPorNumero.keys()).sort((a, b) => a - b);
    const baixasCandidatas = numeros.filter((n) => n <= 500);

    for (const nBaixa of baixasCandidatas) {
      const sBaixa = mapPorNumero.get(nBaixa);
      if (!sBaixa || senhasProcessadas.has(sBaixa.id)) continue;

      // Possíveis números da senha alta parceira:
      // Padrão 1: n + 800 (ex: 1 <-> 801, 20 <-> 820)
      // Padrão 2: n + 799 (ex: 1 <-> 800, 20 <-> 819)
      // Padrão 3: n + 500
      const candidatosAlta = [nBaixa + 800, nBaixa + 799, nBaixa + 500];
      let sAlta: SenhaRow | undefined;
      let numAltaEncontrado: number | null = null;

      for (const cand of candidatosAlta) {
        const achou = mapPorNumero.get(cand);
        if (achou && !senhasProcessadas.has(achou.id)) {
          sAlta = achou;
          numAltaEncontrado = cand;
          break;
        }
      }

      if (sAlta) {
        const baixaLivre = ESTADOS_DISPONIVEIS.includes(sBaixa.estado_comercial);
        const altaLivre = ESTADOS_DISPONIVEIS.includes(sAlta.estado_comercial);

        let statusKit: KitMontado['status'] = 'BLOQUEADO';
        if (baixaLivre && altaLivre) statusKit = 'DISPONIVEL';
        else if (!baixaLivre && !altaLivre) statusKit = 'VENDIDO';
        else statusKit = 'PARCIAL';

        const valorTotal = (sBaixa.valor_centavos || 30000) + (sAlta.valor_centavos || 30000);

        kitsMontados.push({
          id: `kit-par-${sBaixa.codigo}-${sAlta.codigo}`,
          codigo: `KIT #${String(nBaixa).padStart(3, '0')}`,
          numero: nBaixa,
          status: statusKit,
          valorCentavos: valorTotal,
          categoria: sBaixa.categoria || 'PROFISSIONAL',
          senhaBaixa: {
            id: sBaixa.id,
            codigo: sBaixa.codigo,
            numero: nBaixa,
            estado_comercial: sBaixa.estado_comercial,
            disponivel: baixaLivre,
          },
          senhaAlta: {
            id: sAlta.id,
            codigo: sAlta.codigo,
            numero: numAltaEncontrado,
            estado_comercial: sAlta.estado_comercial,
            disponivel: altaLivre,
          },
        });

        senhasProcessadas.add(sBaixa.id);
        senhasProcessadas.add(sAlta.id);
      }
    }

    // 4. Se restarem senhas solteiras que não formaram par, incluir como senhas avulsas
    for (const s of todasSenhas) {
      if (!senhasProcessadas.has(s.id)) {
        const n = extrairNumero(s.codigo);
        const livre = ESTADOS_DISPONIVEIS.includes(s.estado_comercial);
        kitsMontados.push({
          id: `kit-avulso-${s.id}`,
          codigo: `SENHA ${s.codigo}`,
          numero: n,
          status: livre ? 'DISPONIVEL' : 'VENDIDO',
          valorCentavos: s.valor_centavos || 30000,
          categoria: s.categoria || 'PROFISSIONAL',
          senhaBaixa: {
            id: s.id,
            codigo: s.codigo,
            numero: n,
            estado_comercial: s.estado_comercial,
            disponivel: livre,
          },
          senhaAlta: {
            id: s.id,
            codigo: s.codigo,
            numero: n,
            estado_comercial: s.estado_comercial,
            disponivel: livre,
          },
        });
      }
    }

    // Ordenar os kits montados por número
    kitsMontados.sort((a, b) => {
      const nA = a.numero ?? 99999;
      const nB = b.numero ?? 99999;
      if (nA !== nB) return nA - nB;
      return a.codigo.localeCompare(b.codigo);
    });

    const totais = {
      total: kitsMontados.length,
      disponiveis: kitsMontados.filter((k) => k.status === 'DISPONIVEL').length,
      vendidos: kitsMontados.filter((k) => k.status === 'VENDIDO').length,
      parciais: kitsMontados.filter((k) => k.status === 'PARCIAL').length,
    };

    return NextResponse.json({
      kits: kitsMontados,
      totais,
    });
  } catch (error) {
    console.error('Erro ao buscar kits de senhas para secretaria:', error);
    return NextResponse.json(
      { error: 'Erro ao listar kits de senhas para venda' },
      { status: 500 }
    );
  }
}
