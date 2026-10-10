-- Schema Oficial do Sistema de Vaquejada
-- Banco de Dados: vaquejada_db (PostgreSQL 17)

-- Tabela de vaquejadas (eventos/competições)
CREATE TABLE IF NOT EXISTS vaquejadas (
  id VARCHAR(64) PRIMARY KEY,
  codigo VARCHAR(20) UNIQUE NOT NULL,
  nome VARCHAR(255) NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  local VARCHAR(255),
  status VARCHAR(32) DEFAULT 'AGENDADA', -- AGENDADA, EM_ANDAMENTO, FINALIZADA, CANCELADA
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de usuários (juizes, secretários, etc.)
CREATE TABLE IF NOT EXISTS usuarios (
  id VARCHAR(64) PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  papel VARCHAR(32) NOT NULL, -- JUIZ, SECRETARIO, ADMIN, etc.
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de kits (cada kit gera duas senhas independentes)
CREATE TABLE IF NOT EXISTS kits (
  id VARCHAR(64) PRIMARY KEY,
  vaquejada_id VARCHAR(64) NOT NULL REFERENCES vaquejadas(id) ON DELETE CASCADE,
  codigo VARCHAR(20) UNIQUE NOT NULL,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de senhas (cada kit gera duas senhas independentes, cada uma com dois bois)
CREATE TABLE IF NOT EXISTS senhas (
  id VARCHAR(64) PRIMARY KEY,
  kit_id VARCHAR(64) NOT NULL REFERENCES kits(id) ON DELETE CASCADE,
  codigo VARCHAR(20) UNIQUE NOT NULL,
  boi1_id VARCHAR(64),
  boi2_id VARCHAR(64),
  status VARCHAR(32) DEFAULT 'ATIVA', -- ATIVA, USADA, CANCELADA
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  usada_em TIMESTAMP WITH TIME ZONE
);

-- Tabela de bois
CREATE TABLE IF NOT EXISTS bois (
  id VARCHAR(64) PRIMARY KEY,
  numero_registro VARCHAR(50) UNIQUE,
  nome VARCHAR(100),
  categoria VARCHAR(32), -- NOVELHO, VAQUEADO, etc.
  peso_kg NUMERIC(5, 2),
  cor VARCHAR(32),
  observacoes TEXT,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de resultados das senhas (preservar histórico de resultados e decisões do juiz)
CREATE TABLE IF NOT EXISTS resultados_senhas (
  id VARCHAR(64) PRIMARY KEY,
  senha_id VARCHAR(64) NOT NULL REFERENCES senhas(id) ON DELETE CASCADE,
  vaquejada_id VARCHAR(64) NOT NULL REFERENCES vaquejadas(id) ON DELETE CASCADE,
  boi1_nota NUMERIC(3, 2),
  boi2_nota NUMERIC(3, 2),
  boi1_desclassificado BOOLEAN DEFAULT FALSE,
  boi2_desclassificado BOOLEAN DEFAULT FALSE,
  motivo_desclassificao_boi1 TEXT,
  motivo_desclassificao_boi2 TEXT,
  decisao_juiz VARCHAR(64) NOT NULL REFERENCES usuarios(id), -- ID do juiz que decidiu
  observacoes_juiz TEXT,
  video_contestacao_url TEXT, -- Para contestação de zero com vídeo anexado
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de bois de ouro (só entra no mapa geral após pagamento confirmado e autorização da secretaria)
CREATE TABLE IF NOT EXISTS bois_ouro (
  id VARCHAR(64) PRIMARY KEY,
  boi_id VARCHAR(64) UNIQUE NOT NULL REFERENCES bois(id) ON DELETE CASCADE,
  vaquejada_id VARCHAR(64) NOT NULL REFERENCES vaquejadas(id) ON DELETE CASCADE,
  valor NUMERIC(10, 2) NOT NULL,
  pago BOOLEAN DEFAULT FALSE,
  pagamento_confirmado_em TIMESTAMP WITH TIME ZONE,
  autorizado_por VARCHAR(64) REFERENCES usuarios(id), -- Secretário que autorizou
  autorizado_em TIMESTAMP WITH TIME ZONE,
  ativo BOOLEAN DEFAULT FALSE, -- Só vira true após pagamento e autorização
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de oportunidades (retorno gera nova oportunidade com outro boi)
CREATE TABLE IF NOT EXISTS oportunidades (
  id VARCHAR(64) PRIMARY KEY,
  vaquejada_id VARCHAR(64) NOT NULL REFERENCES vaquejadas(id) ON DELETE CASCADE,
  boi_id VARCHAR(64) NOT NULL REFERENCES bois(id) ON DELETE CASCADE,
  senha_origem_id VARCHAR(64) REFERENCES senhas(id), -- Senha que gerou esta oportunidade
  disponivel BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_senhas_kit_id ON senhas(kit_id);
CREATE INDEX IF NOT EXISTS idx_resultados_senha_id ON resultados_senhas(senha_id);
CREATE INDEX IF NOT EXISTS idx_resultados_vaquejada_id ON resultados_senhas(vaquejada_id);
CREATE INDEX IF NOT EXISTS idx_bois_ouro_vaquejada_id ON bois_ouro(vaquejada_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_vaquejada_id ON oportunidades(vaquejada_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_boi_id ON oportunidades(boi_id);