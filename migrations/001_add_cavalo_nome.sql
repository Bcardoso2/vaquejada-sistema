-- Migração 001: Adiciona coluna cavalo_nome na tabela senhas
ALTER TABLE senhas ADD COLUMN IF NOT EXISTS cavalo_nome VARCHAR(255);
