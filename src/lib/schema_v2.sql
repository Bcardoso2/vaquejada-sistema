-- Schema v2: Alinhamento Oficial com os Requisitos do Sistema de Vaquejada (PDF)
-- Compatível com PostgreSQL 17

-- 1. Tabela de Auditoria (RN-09, CA-16)
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  usuario_id VARCHAR(64) REFERENCES usuarios(id),
  usuario_nome VARCHAR(255),
  papel VARCHAR(32),
  acao VARCHAR(100) NOT NULL,
  entidade VARCHAR(64) NOT NULL,
  entidade_id VARCHAR(64),
  detalhes JSONB,
  motivo TEXT,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entidade ON audit_logs(entidade, entidade_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_criado_em ON audit_logs(criado_em DESC);

-- 2. Atualizar tabela senhas com estados comerciais e dados de venda (RN-01, RN-02, 4.1)
ALTER TABLE senhas ADD COLUMN IF NOT EXISTS vaquejada_id VARCHAR(64) REFERENCES vaquejadas(id) ON DELETE CASCADE;
ALTER TABLE senhas ADD COLUMN IF NOT EXISTS puxador_nome VARCHAR(255);
ALTER TABLE senhas ADD COLUMN IF NOT EXISTS esteira_nome VARCHAR(255);
ALTER TABLE senhas ADD COLUMN IF NOT EXISTS cavalo_nome VARCHAR(255);
ALTER TABLE senhas ADD COLUMN IF NOT EXISTS categoria VARCHAR(50) DEFAULT 'ABERTA';
ALTER TABLE senhas ADD COLUMN IF NOT EXISTS tipo_venda VARCHAR(32) DEFAULT 'KIT'; -- KIT, SOLTEIRA
ALTER TABLE senhas ADD COLUMN IF NOT EXISTS canal_venda VARCHAR(32) DEFAULT 'PRESENCIAL'; -- PRESENCIAL, ANTECIPADA
ALTER TABLE senhas ADD COLUMN IF NOT EXISTS estado_comercial VARCHAR(32) DEFAULT 'PAGA'; -- RASCUNHO, AGUARDANDO_PAGAMENTO, PAGA, CANCELADA, ESTORNADA
ALTER TABLE senhas ADD COLUMN IF NOT EXISTS valor_centavos INTEGER DEFAULT 30000; -- R$ 300,00
ALTER TABLE senhas ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE senhas ADD COLUMN IF NOT EXISTS excecao_mapa BOOLEAN DEFAULT FALSE;
ALTER TABLE senhas ADD COLUMN IF NOT EXISTS motivo_excecao TEXT;
ALTER TABLE senhas ADD COLUMN IF NOT EXISTS autorizador_excecao_id VARCHAR(64) REFERENCES usuarios(id);

-- 3. Tabela de Pagamentos e Conciliação (RN-08, CA-03, CA-04)
CREATE TABLE IF NOT EXISTS pagamentos (
  id VARCHAR(64) PRIMARY KEY,
  senha_id VARCHAR(64) REFERENCES senhas(id) ON DELETE CASCADE,
  tipo VARCHAR(32) NOT NULL DEFAULT 'MANUAL', -- MANUAL, PIX, CARTAO, BOLETO
  valor_centavos INTEGER NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'CONFIRMADO', -- PENDENTE, CONFIRMADO, ESTORNADO
  referencia_externa VARCHAR(255),
  comprovante_detalhes TEXT,
  recebido_por VARCHAR(64) REFERENCES usuarios(id),
  confirmado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pagamentos_senha_id ON pagamentos(senha_id);

-- 4. Oportunidades de Corrida & Mapa da Pista (RN-03, 4.2, Seção 5)
-- Cada oportunidade representa um boi a ser corrido na pista
CREATE TABLE IF NOT EXISTS corridas_mapa (
  id VARCHAR(64) PRIMARY KEY,
  vaquejada_id VARCHAR(64) NOT NULL REFERENCES vaquejadas(id) ON DELETE CASCADE,
  senha_id VARCHAR(64) NOT NULL REFERENCES senhas(id) ON DELETE CASCADE,
  boi_id VARCHAR(64) REFERENCES bois(id),
  boi_numero INTEGER NOT NULL DEFAULT 1, -- 1º Boi, 2º Boi, etc.
  tipo VARCHAR(32) NOT NULL DEFAULT 'REGULAR', -- REGULAR, RETORNO, BOI_DE_OURO
  ordem_mapa INTEGER NOT NULL,
  estado VARCHAR(32) NOT NULL DEFAULT 'NO_MAPA', -- PENDENTE, NO_MAPA, CHAMADA, EM_EXECUCAO, AGUARDANDO_RETORNO, CONCLUIDA, CANCELADA
  resultado_inicial VARCHAR(32), -- VALEU, ZERO, RETORNO
  resultado_final VARCHAR(32), -- VALEU, ZERO
  estado_julgamento VARCHAR(32) DEFAULT 'PENDENTE', -- PENDENTE, PROVISORIO, EM_CONTESTACAO, HOMOLOGADO, ANULADO
  origem_corrida_id VARCHAR(64) REFERENCES corridas_mapa(id),
  excecao_mapa BOOLEAN DEFAULT FALSE,
  motivo_excecao TEXT,
  chamada_em TIMESTAMP WITH TIME ZONE,
  concluida_em TIMESTAMP WITH TIME ZONE,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_corridas_vaquejada_ordem ON corridas_mapa(vaquejada_id, ordem_mapa);
CREATE INDEX IF NOT EXISTS idx_corridas_senha_id ON corridas_mapa(senha_id);

-- 5. Contestações de Zero / Boi de TV (RN-04, 4.3, CA-07, CA-08, CA-09)
CREATE TABLE IF NOT EXISTS contestacoes_video (
  id VARCHAR(64) PRIMARY KEY,
  corrida_id VARCHAR(64) NOT NULL REFERENCES corridas_mapa(id) ON DELETE CASCADE,
  senha_id VARCHAR(64) NOT NULL REFERENCES senhas(id) ON DELETE CASCADE,
  solicitante_nome VARCHAR(255) NOT NULL,
  motivo TEXT,
  estado VARCHAR(32) NOT NULL DEFAULT 'ABERTA', -- ABERTA, AGUARDANDO_VIDEO, PRONTA_PARA_ANALISE, DECIDIDA_PELO_JUIZ
  video_url TEXT,
  video_anexado_por VARCHAR(64) REFERENCES usuarios(id),
  video_anexado_em TIMESTAMP WITH TIME ZONE,
  resultado_inicial VARCHAR(32) NOT NULL DEFAULT 'ZERO',
  decisao_juiz VARCHAR(32), -- VALEU, ZERO_MANTIDO
  justificativa_juiz TEXT,
  juiz_id VARCHAR(64) REFERENCES usuarios(id),
  decidido_em TIMESTAMP WITH TIME ZONE,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contestacoes_corrida_id ON contestacoes_video(corrida_id);

-- 6. Atualizar bois_ouro com estados oficiais (RN-05, RN-06, 4.4, CA-11 a CA-14)
ALTER TABLE bois_ouro ADD COLUMN IF NOT EXISTS senha_origem_id VARCHAR(64) REFERENCES senhas(id) ON DELETE CASCADE;
ALTER TABLE bois_ouro ADD COLUMN IF NOT EXISTS estado VARCHAR(32) DEFAULT 'SOLICITADO'; -- SOLICITADO, AGUARDANDO_PAGAMENTO, PAGO_AGUARDANDO_AUTORIZACAO, AUTORIZADO, NO_MAPA, REJEITADO, CANCELADO
ALTER TABLE bois_ouro ADD COLUMN IF NOT EXISTS valor_centavos INTEGER DEFAULT 15000; -- R$ 150,00
ALTER TABLE bois_ouro ADD COLUMN IF NOT EXISTS referencia_pagamento VARCHAR(255);
ALTER TABLE bois_ouro ADD COLUMN IF NOT EXISTS corrida_gerada_id VARCHAR(64) REFERENCES corridas_mapa(id);
