-- ==============================================================================
-- Migração 008: Troca Obrigatória de Senha no Primeiro Login e Segurança
-- ==============================================================================

-- 1. Adicionar flag deve_trocar_senha na tabela usuarios
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS deve_trocar_senha BOOLEAN DEFAULT FALSE;

-- 2. Marcar todos os usuários criados por seed ou scripts iniciais para troca obrigatória
UPDATE usuarios
SET deve_trocar_senha = TRUE;
