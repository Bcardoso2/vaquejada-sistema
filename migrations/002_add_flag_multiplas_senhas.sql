-- Migração 002: Flag para permitir ou proibir que a mesma dupla corra mais de uma senha no evento
-- Padrão = TRUE (permitir múltiplas senhas por dupla)
ALTER TABLE vaquejadas ADD COLUMN IF NOT EXISTS permitir_dupla_multiplas_senhas BOOLEAN DEFAULT TRUE;
