import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { extrairIpCliente } from '@/lib/auth';

// Cache em memória curto no servidor (1.5 segundos) para aliviar o banco
let cacheMemoria: { timestamp: number; payload: any } | null = null;
const CACHE_TTL_MS = 1500;

// Rate limit simples por IP na memória: máx 60 reqs / min por IP
const rateLimitIpMap = new Map<string, { count: number; resetEm: number }>();

// GET /api/placar - Endpoint PÚBLICO somente leitura para o telão do evento
// 1. Suporta cache curto (1-2s) no servidor
// 2. Rate limit por IP
// 3. Token opcional via URL ?t=... configurável por PLACAR_TOKEN
export async function GET(request: NextRequest) {
  try {
    const ip = extrairIpCliente(request);
    const agora = Date.now();

    // 1. Rate Limit por IP (60 requisições por minuto)
    const ipData = rateLimitIpMap.get(ip) || { count: 0, resetEm: agora + 60000 };
    if (agora > ipData.resetEm) {
      ipData.count = 0;
      ipData.resetEm = agora + 60000;
    }
    ipData.count++;
    rateLimitIpMap.set(ip, ipData);

    if (ipData.count > 60) {
      return NextResponse.json(
        { error: 'Limite de requisições ao telão excedido para este IP. Aguarde um momento.' },
        { status: 429, headers: { 'Retry-After': '5' } }
      );
    }

    // 2. Validação de Token opcional configurável por PLACAR_TOKEN
    const placarTokenConfigurado = process.env.PLACAR_TOKEN;
    if (placarTokenConfigurado && placarTokenConfigurado.trim().length > 0) {
      const url = new URL(request.url);
      const tokenFornecido = url.searchParams.get('t') || request.headers.get('x-placar-token');
      if (!tokenFornecido || tokenFornecido.trim() !== placarTokenConfigurado.trim()) {
        return NextResponse.json(
          { error: 'Acesso ao telão protegido por token. Parâmetro ?t=TOKEN obrigatório.' },
          { status: 401 }
        );
      }
    }

    // 3. Checar cache em memória curto (1.5s)
    if (cacheMemoria && agora - cacheMemoria.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cacheMemoria.payload, {
        headers: {
          'Cache-Control': 'public, s-maxage=2, stale-while-revalidate=1',
          'X-Cache': 'HIT',
        },
      });
    }

    // 4. Vaquejada ativa
    const vqRes = await query(
      `SELECT id, nome, local, status, data_inicio, data_fim, tempo_cancela_segundos 
       FROM vaquejadas 
       WHERE status = 'EM_ANDAMENTO' OR status = 'ABERTA' 
       ORDER BY created_at DESC 
       LIMIT 1`
    );

    const vaquejada = vqRes.rows[0] || { nome: 'Grande Vaquejada Portal', local: 'Parque de Vaquejada' };
    const vaquejadaId = vaquejada.id || 'vq-2026-portal';

    // 5. Dupla correndo na pista AGORA (EM_EXECUCAO ou CHAMADA)
    const pistaRes = await query(
      `SELECT 
        cm.id as corrida_id, cm.boi_numero, cm.estado, cm.resultado_final,
        cm.chamada_em,
        s.codigo as senha_codigo, s.categoria,
        s.puxador_nome, s.esteira_nome, s.cavalo_nome,
        comp_pux.apelido_pista as puxador_apelido,
        comp_est.apelido_pista as esteira_apelido,
        cav.nome as cavalo_oficial_nome,
        b.numero as bateria_numero
       FROM corridas_mapa cm
       JOIN senhas s ON cm.senha_id = s.id
       LEFT JOIN competidores comp_pux ON s.puxador_id = comp_pux.id
       LEFT JOIN competidores comp_est ON s.esteira_id = comp_est.id
       LEFT JOIN cavalos cav ON s.cavalo_puxa_id = cav.id
       LEFT JOIN baterias b ON cm.bateria_id = b.id
       WHERE cm.vaquejada_id = $1 AND (cm.estado = 'EM_EXECUCAO' OR cm.estado = 'CHAMADA')
       ORDER BY cm.chamada_em DESC NULLS LAST, cm.ordem_mapa ASC
       LIMIT 1`,
      [vaquejadaId]
    );

    const corridaAtual = pistaRes.rows[0] || null;

    // 6. Próximas duplas na fila de espera (A SEGUIR)
    const filaRes = await query(
      `SELECT 
        cm.id as corrida_id, cm.ordem_na_bateria, cm.ordem_mapa, cm.boi_numero,
        s.codigo as senha_codigo, s.categoria,
        s.puxador_nome, s.esteira_nome, s.cavalo_nome,
        comp_pux.apelido_pista as puxador_apelido,
        comp_est.apelido_pista as esteira_apelido,
        cav.nome as cavalo_oficial_nome,
        b.numero as bateria_numero
       FROM corridas_mapa cm
       JOIN senhas s ON cm.senha_id = s.id
       LEFT JOIN competidores comp_pux ON s.puxador_id = comp_pux.id
       LEFT JOIN competidores comp_est ON s.esteira_id = comp_est.id
       LEFT JOIN cavalos cav ON s.cavalo_puxa_id = cav.id
       LEFT JOIN baterias b ON cm.bateria_id = b.id
       WHERE cm.vaquejada_id = $1 AND cm.estado = 'EM_ESPERA'
       ORDER BY b.numero ASC, cm.ordem_na_bateria ASC, cm.ordem_mapa ASC
       LIMIT 4`,
      [vaquejadaId]
    );

    // 7. Últimos resultados julgados (CONCLUIDA)
    const ultimosRes = await query(
      `SELECT 
        cm.id as corrida_id, cm.boi_numero, cm.resultado_final, cm.concluida_em,
        s.codigo as senha_codigo, s.categoria,
        s.puxador_nome, s.esteira_nome,
        comp_pux.apelido_pista as puxador_apelido,
        comp_est.apelido_pista as esteira_apelido
       FROM corridas_mapa cm
       JOIN senhas s ON cm.senha_id = s.id
       LEFT JOIN competidores comp_pux ON s.puxador_id = comp_pux.id
       LEFT JOIN competidores comp_est ON s.esteira_id = comp_est.id
       WHERE cm.vaquejada_id = $1 AND cm.estado = 'CONCLUIDA'
       ORDER BY cm.concluida_em DESC NULLS LAST, cm.criado_em DESC
       LIMIT 6`,
      [vaquejadaId]
    );

    const payload = {
      vaquejada: {
        nome: vaquejada.nome,
        local: vaquejada.local,
        tempoCancela: vaquejada.tempo_cancela_segundos || 30,
      },
      corridaAtual,
      proximasCorridas: filaRes.rows,
      ultimosResultados: ultimosRes.rows,
      atualizadoEm: new Date().toISOString(),
    };

    cacheMemoria = { timestamp: agora, payload };

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=2, stale-while-revalidate=1',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('Erro ao gerar dados do placar/telão:', error);
    return NextResponse.json({ error: 'Erro ao carregar dados do telão' }, { status: 500 });
  }
}
