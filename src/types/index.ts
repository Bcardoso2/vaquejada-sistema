export interface Vaquejada {
  id: string;
  codigo: string;
  nome: string;
  data_inicio: string; // ISO date string
  data_fim: string; // ISO date string
  local?: string;
  status: 'AGENDADA' | 'EM_ANDAMENTO' | 'FINALIZADA' | 'CANCELADA';
  created_at: string;
  updated_at: string;
}

export interface Kit {
  id: string;
  vaquejada_id: string;
  codigo: string;
  criado_em: string;
}

export interface Senha {
  id: string;
  kit_id: string;
  codigo: string;
  boi1_id?: string;
  boi2_id?: string;
  status: 'ATIVA' | 'USADA' | 'CANCELADA';
  criado_em: string;
  usada_em?: string;
}

export interface Boi {
  id: string;
  numero_registro?: string;
  nome?: string;
  categoria?: string;
  peso_kg?: number;
  cor?: string;
  observacoes?: string;
  criado_em: string;
  atualizado_em: string;
}

export interface ResultadoSenha {
  id: string;
  senha_id: string;
  vaquejada_id: string;
  boi1_nota?: number;
  boi2_nota?: number;
  boi1_desclassificado: boolean;
  boi2_desclassificado: boolean;
  motivo_desclassificao_boi1?: string;
  motivo_desclassificao_boi2?: string;
  decisao_juiz: string; // ID do juiz
  observacoes_juiz?: string;
  video_contestacao_url?: string;
  criado_em: string;
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: 'ADMIN' | 'SECRETARIO' | 'JUIZ' | 'OPERADOR';
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface BoiOuRO {
  id: string;
  boi_id: string;
  vaquejada_id: string;
  valor: number;
  pago: boolean;
  pagamento_confirmado_em?: string;
  autorizado_por?: string;
  autorizado_em?: string;
  ativo: boolean;
  criado_em: string;
}

export interface Oportunidade {
  id: string;
  vaquejada_id: string;
  boi_id: string;
  senha_origem_id?: string;
  disponivel: boolean;
  criado_em: string;
}