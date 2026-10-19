import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { exigirSessao } from '@/lib/api-auth';
import { validarCpf, formatarCpf, limparCpf, mascararCpf, mascararTelefone } from '@/lib/cpf';
import { registrarAuditoria } from '@/lib/audit';

// GET /api/competidores - Listar competidores com busca e mascaramento por perfil
export async function GET(request: NextRequest) {
  const auth = await exigirSessao(request, ['ADMIN', 'SECRETARIA', 'OPERADOR_PISTA', 'JUIZ']);
  if (!auth.autorizado) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const busca = searchParams.get('q') || '';
    const categoria = searchParams.get('categoria') || '';
    const apenasAtivos = searchParams.get('ativo') !== 'false';

    let sql = `SELECT * FROM competidores WHERE 1=1`;
    const params: any[] = [];
    let pIdx = 1;

    if (apenasAtivos) {
      sql += ` AND ativo = true`;
    }

    if (busca.trim()) {
      sql += ` AND (LOWER(nome) LIKE $${pIdx} OR LOWER(COALESCE(apelido_pista, '')) LIKE $${pIdx} OR regexp_replace(cpf, '[^0-9]', '', 'g') LIKE $${pIdx})`;
      params.push(`%${busca.toLowerCase().trim()}%`);
      pIdx++;
    }

    if (categoria.trim()) {
      sql += ` AND categoria = $${pIdx}`;
      params.push(categoria);
      pIdx++;
    }

    sql += ` ORDER BY nome ASC LIMIT 200`;

    const res = await query(sql, params);

    const podeVerDadosPessoais = auth.session.papel === 'ADMIN' || auth.session.papel === 'SECRETARIA';

    // Se for ADMIN ou SECRETARIA e houver busca específica, registra auditoria de acesso a dados
    if (podeVerDadosPessoais && busca.trim().length >= 3) {
      await registrarAuditoria({
        usuarioId: auth.session.id,
        usuarioNome: auth.session.nome,
        papel: auth.session.papel,
        acao: 'CONSULTAR_DADOS_PESSOAIS_COMPETIDORES',
        entidade: 'competidores',
        detalhes: { termoBusca: busca, totalRetornado: res.rowCount },
        motivo: 'Consulta de competidores na secretaria/administração',
      });
    }

    // Para Operador de Pista e Juiz: retornar APENAS campos mínimos de pista, sem dados pessoais
    if (!podeVerDadosPessoais) {
      const listaMinima = res.rows.map((c) => ({
        id: c.id,
        nome: c.nome,
        apelido_pista: c.apelido_pista || '',
        categoria: c.categoria || 'ABERTA',
        foto_url: c.foto_url || null,
        ativo: c.ativo,
      }));
      return NextResponse.json(listaMinima);
    }

    // Para ADMIN e SECRETARIA: retornar ficha completa
    const lista = res.rows.map((c) => ({
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
    }));

    return NextResponse.json(lista);
  } catch (error) {
    console.error('Erro ao listar competidores:', error);
    return NextResponse.json({ error: 'Erro ao buscar competidores' }, { status: 500 });
  }
}

// POST /api/competidores - Cadastrar novo competidor (validação de CPF único)
export async function POST(request: NextRequest) {
  const auth = await exigirSessao(request, ['ADMIN', 'SECRETARIA']);
  if (!auth.autorizado) return auth.response;

  try {
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
      ativo = true,
    } = body;

    if (!nome || nome.trim().length < 3) {
      return NextResponse.json({ error: 'Nome do competidor é obrigatório (mínimo 3 caracteres)' }, { status: 400 });
    }

    if (!cpf || !validarCpf(cpf)) {
      return NextResponse.json(
        { error: 'CPF inválido. Forneça um CPF válido com 11 dígitos e dígitos verificadores corretos.' },
        { status: 400 }
      );
    }

    const cpfLimpo = limparCpf(cpf);
    const cpfFormatado = formatarCpf(cpf);

    // Verificar unicidade de CPF
    const existeCpf = await query(
      `SELECT id, nome FROM competidores WHERE regexp_replace(cpf, '[^0-9]', '', 'g') = $1`,
      [cpfLimpo]
    );

    if (existeCpf.rowCount && existeCpf.rowCount > 0) {
      return NextResponse.json(
        { error: `Já existe um competidor cadastrado com este CPF (${existeCpf.rows[0].nome}).` },
        { status: 409 }
      );
    }

    const id = `comp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const insertRes = await query(
      `INSERT INTO competidores (
        id, nome, apelido_pista, cpf, cidade, uf, telefone, 
        categoria, foto_url, carteira_federacao, ativo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        id,
        nome.trim(),
        apelido_pista?.trim() || null,
        cpfFormatado,
        cidade?.trim() || null,
        uf?.trim()?.toUpperCase() || null,
        telefone?.trim() || null,
        categoria?.trim() || 'ABERTA',
        foto_url?.trim() || null,
        carteira_federacao?.trim() || null,
        ativo !== false,
      ]
    );

    const novo = insertRes.rows[0];

    await registrarAuditoria({
      usuarioId: auth.session.id,
      usuarioNome: auth.session.nome,
      papel: auth.session.papel,
      acao: 'CADASTRAR_COMPETIDOR',
      entidade: 'competidores',
      entidadeId: id,
      detalhes: { nome: novo.nome, cpf: formatarCpf(novo.cpf), categoria: novo.categoria },
      motivo: `Cadastro oficial de competidor por ${auth.session.nome}`,
    });

    return NextResponse.json({
      success: true,
      competidor: novo,
    }, { status: 201 });
  } catch (error) {
    console.error('Erro ao cadastrar competidor:', error);
    return NextResponse.json({ error: 'Erro interno ao cadastrar competidor' }, { status: 500 });
  }
}
