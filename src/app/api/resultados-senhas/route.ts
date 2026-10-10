import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../lib/db';
import { validateRolePermission, validateUser } from '../../../lib/api-auth';

// GET /api/resultados-senhas - Listar resultados (opcionalmente filtrado por senha ou vaquejada)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const senhaId = searchParams.get('senhaId');
    const vaquejadaId = searchParams.get('vaquejadaId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let queryText = `
      SELECT rs.*,
             s.codigo as senha_codigo,
             v.codigo as vaquejada_codigo,
             u.nome as juiz_nome
      FROM resultados_senhas rs
      JOIN senhas s ON rs.senha_id = s.id
      JOIN vaquejadas v ON rs.vaquejada_id = v.id
      JOIN usuarios u ON rs.decisao_juiz = u.id
    `;
    const params: any[] = [];

    if (senhaId) {
      queryText += params.length ? ' WHERE rs.senha_id = $' + (params.length + 1) : ' WHERE rs.senha_id = $' + (params.length + 1);
      params.push(senhaId);
    }

    if (vaquejadaId) {
      queryText += params.length ? ' AND rs.vaquejada_id = $' + (params.length + 1) : ' WHERE rs.vaquejada_id = $' + (params.length + 1);
      params.push(vaquejadaId);
    }

    queryText += ' ORDER BY rs.criado_em DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const res = await query(queryText, params);
    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Erro ao listar resultados:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST /api/resultados-senhas - Registrar resultado de uma senha (decisão do juiz)
export async function POST(request: NextRequest) {
  try {
    // Verificar autorização (apenas JUIZ pode registrar resultados)
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role') as any;

    const permissionCheck = validateRolePermission(userRole, ['JUIZ']);
    if (!permissionCheck.isAuthorized) {
      return permissionCheck.response;
    }

    // Validar se o usuário existe e está ativo
    // Se userId for null, passar string vazia para evitar erro de tipo
    const userIdValue = userId !== null ? userId : '';
    const userValidation = await validateUser(userIdValue);
    if (!userValidation.isValid) {
      return userValidation.response;
    }

    const {
      senhaId,
      vaquejadaId,
      boi1Nota,
      boi2Nota,
      boi1Desclassificado,
      boi2Desclassificado,
      motivoDesclassificaoBoi1,
      motivoDesclassificaoBoi2,
      observacoesJuiz,
      videoContestacaoUrl
    } = await request.json();

    // Validações básicas
    if (!senhaId || !vaquejadaId) {
      return NextResponse.json(
        { error: 'ID da senha e ID da vaquejada são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se a senha existe
    const senhaCheck = await query('SELECT id FROM senhas WHERE id = $1', [senhaId]);
    if (senhaCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Senha não encontrada' },
        { status: 404 }
      );
    }

    // Verificar se a vaquejada existe
    const vaquejadaCheck = await query('SELECT id FROM vaquejadas WHERE id = $1', [vaquejadaId]);
    if (vaquejadaCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Vaquejada não encontrada' },
        { status: 404 }
      );
    }

    // Verificar se a senha já tem um resultado registrado para esta vaquejada
    const existingResult = await query(
      'SELECT id FROM resultados_senhas WHERE senha_id = $1 AND vaquejada_id = $2',
      [senhaId, vaquejadaId]
    );
    if (existingResult.rows.length > 0) {
      return NextResponse.json(
        { error: 'Já existe um resultado registrado para esta senha nesta vaquejada' },
        { status: 409 }
      );
    }

    const res = await query(
      `INSERT INTO resultados_senhas (
         senha_id, vaquejada_id, boi1_nota, boi2_nota,
         boi1_desclassificado, boi2_desclassificado,
         motivo_desclassificao_boi1, motivo_desclassificao_boi2,
         decisao_juiz, observacoes_juiz, video_contestacao_url
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        senhaId,
        vaquejadaId,
        boi1Nota,
        boi2Nota,
        boi1Desclassificado,
        boi2Desclassificado,
        motivoDesclassificaoBoi1,
        motivoDesclassificaoBoi2,
        userId, // O juiz que está fazendo a decisão (será null se não fornecido, mas já validamos acima)
        observacoesJuiz,
        videoContestacaoUrl
      ]
    );

    // Marcar a senha como usada
    await query(
      'UPDATE senhas SET status = $1, usada_em = CURRENT_TIMESTAMP WHERE id = $2',
      ['USADA', senhaId]
    );

    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (error) {
    console.error('Erro ao registrar resultado:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}