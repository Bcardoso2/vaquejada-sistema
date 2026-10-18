-- Migração 003: Padronização dos Perfis de Usuário (RBAC)
-- ADMIN, JUIZ, SECRETARIA, OPERADOR_PISTA

UPDATE usuarios SET papel = 'SECRETARIA' WHERE papel IN ('SECRETARIO', 'secretario', 'secretaria');
UPDATE usuarios SET papel = 'OPERADOR_PISTA' WHERE papel IN ('OPERADOR', 'operador', 'operador_pista');
UPDATE usuarios SET papel = 'JUIZ' WHERE papel IN ('juiz', 'JUIZ');
UPDATE usuarios SET papel = 'ADMIN' WHERE papel IN ('admin', 'ADMIN');

-- Tabela para limitação de tentativas de login (Rate Limiting)
CREATE TABLE IF NOT EXISTS login_tentativas (
    ip_ou_email VARCHAR(255) PRIMARY KEY,
    tentativas INT NOT NULL DEFAULT 1,
    bloqueado_ate TIMESTAMP WITH TIME ZONE,
    ultimo_erro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
