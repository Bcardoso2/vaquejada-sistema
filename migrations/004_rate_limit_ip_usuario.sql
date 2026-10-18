-- Migração 004: Rate limiting refinado por usuário E por IP
-- Permite que bloqueios afetem apenas o atacante (IP) e não impeçam o ADMIN/usuário de logar de outro IP

CREATE TABLE IF NOT EXISTS login_tentativas_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  ip VARCHAR(100) NOT NULL,
  tentativas INT NOT NULL DEFAULT 1,
  bloqueado_ate TIMESTAMPTZ,
  ultimo_erro TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_email_ip UNIQUE (email, ip)
);

CREATE INDEX IF NOT EXISTS idx_login_tentativas_v2_email ON login_tentativas_v2(email);
CREATE INDEX IF NOT EXISTS idx_login_tentativas_v2_ip ON login_tentativas_v2(ip);
CREATE INDEX IF NOT EXISTS idx_login_tentativas_v2_bloqueio ON login_tentativas_v2(bloqueado_ate);
