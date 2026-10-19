-- Migração 009: Criptografia de CPF em repouso (AES-256-GCM) + Blind Index (HMAC-SHA256)
-- Garante conformidade LGPD, busca indexada em O(1) e integridade de chave única.

-- 1. Alterar coluna cpf para TEXT e adicionar colunas de CPF criptografado e Blind Index
ALTER TABLE competidores ALTER COLUMN cpf TYPE TEXT;
ALTER TABLE competidores ADD COLUMN IF NOT EXISTS cpf_encrypted TEXT;
ALTER TABLE competidores ADD COLUMN IF NOT EXISTS cpf_blind_index VARCHAR(64);

-- 2. Índice único para o Blind Index (garante unicidade estrita no banco)
CREATE UNIQUE INDEX IF NOT EXISTS uq_competidores_cpf_blind_index 
ON competidores (cpf_blind_index) 
WHERE cpf_blind_index IS NOT NULL;

-- 3. Índice para busca rápida pelo Blind Index
CREATE INDEX IF NOT EXISTS idx_competidores_cpf_blind_index 
ON competidores (cpf_blind_index);
