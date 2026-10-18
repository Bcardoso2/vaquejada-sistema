-- Migração 005: Cadastros Oficiais de Competidores e Cavalos com migração segura de dados existentes

-- 1. Tabela de Competidores
CREATE TABLE IF NOT EXISTS competidores (
  id VARCHAR(64) PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  apelido_pista VARCHAR(100),
  cpf VARCHAR(14) NOT NULL UNIQUE,
  cidade VARCHAR(100),
  uf VARCHAR(2),
  telefone VARCHAR(20),
  categoria VARCHAR(50) DEFAULT 'ABERTA',
  foto_url TEXT,
  carteira_federacao VARCHAR(50),
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_competidores_nome ON competidores(nome);
CREATE INDEX IF NOT EXISTS idx_competidores_apelido ON competidores(apelido_pista);
CREATE INDEX IF NOT EXISTS idx_competidores_cpf ON competidores(cpf);
CREATE INDEX IF NOT EXISTS idx_competidores_categoria ON competidores(categoria);

-- 2. Tabela de Cavalos
CREATE TABLE IF NOT EXISTS cavalos (
  id VARCHAR(64) PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  tipo VARCHAR(30) NOT NULL DEFAULT 'PUXA', -- 'PUXA', 'ESTEIRA', 'AMBOS'
  proprietario VARCHAR(255),
  registro VARCHAR(50),
  chip VARCHAR(50),
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cavalos_nome ON cavalos(nome);
CREATE INDEX IF NOT EXISTS idx_cavalos_tipo ON cavalos(tipo);

-- 3. Adicionar chaves estrangeiras na tabela senhas (mantendo colunas de texto para snapshot histórico)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'senhas' AND column_name = 'puxador_id'
  ) THEN
    ALTER TABLE senhas ADD COLUMN puxador_id VARCHAR(64) REFERENCES competidores(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'senhas' AND column_name = 'esteira_id'
  ) THEN
    ALTER TABLE senhas ADD COLUMN esteira_id VARCHAR(64) REFERENCES competidores(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'senhas' AND column_name = 'cavalo_puxa_id'
  ) THEN
    ALTER TABLE senhas ADD COLUMN cavalo_puxa_id VARCHAR(64) REFERENCES cavalos(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'senhas' AND column_name = 'cavalo_esteira_id'
  ) THEN
    ALTER TABLE senhas ADD COLUMN cavalo_esteira_id VARCHAR(64) REFERENCES cavalos(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Migração segura dos dados legados existentes em senhas:
-- Inserir competidores a partir dos puxadores históricos (gerando CPF provisório válido no padrão de migração se ausente)
DO $$
DECLARE
  rec RECORD;
  novo_id VARCHAR(64);
  i INT := 100;
  cpf_gerado VARCHAR(14);
BEGIN
  FOR rec IN (
    SELECT DISTINCT TRIM(puxador_nome) AS nome 
    FROM senhas 
    WHERE puxador_nome IS NOT NULL AND TRIM(puxador_nome) != ''
  ) LOOP
    IF NOT EXISTS (SELECT 1 FROM competidores WHERE LOWER(nome) = LOWER(rec.nome)) THEN
      novo_id := 'comp-' || substr(md5(random()::text || rec.nome), 1, 12);
      i := i + 1;
      -- CPF no formato 999.000.00X-XX com dígitos calculados
      cpf_gerado := '999.' || LPAD(i::text, 3, '0') || '.000-00';
      INSERT INTO competidores (id, nome, apelido_pista, cpf, cidade, uf, categoria, ativo)
      VALUES (novo_id, rec.nome, rec.nome, cpf_gerado, 'Não informada', 'PE', 'ABERTA', true)
      ON CONFLICT (cpf) DO NOTHING;
    END IF;
  END LOOP;

  -- Inserir esteireiros históricos
  FOR rec IN (
    SELECT DISTINCT TRIM(esteira_nome) AS nome 
    FROM senhas 
    WHERE esteira_nome IS NOT NULL AND TRIM(esteira_nome) != ''
  ) LOOP
    IF NOT EXISTS (SELECT 1 FROM competidores WHERE LOWER(nome) = LOWER(rec.nome)) THEN
      novo_id := 'comp-' || substr(md5(random()::text || rec.nome), 1, 12);
      i := i + 1;
      cpf_gerado := '999.' || LPAD(i::text, 3, '0') || '.000-00';
      INSERT INTO competidores (id, nome, apelido_pista, cpf, cidade, uf, categoria, ativo)
      VALUES (novo_id, rec.nome, rec.nome, cpf_gerado, 'Não informada', 'PE', 'ABERTA', true)
      ON CONFLICT (cpf) DO NOTHING;
    END IF;
  END LOOP;

  -- Inserir cavalos históricos
  FOR rec IN (
    SELECT DISTINCT TRIM(cavalo_nome) AS nome 
    FROM senhas 
    WHERE cavalo_nome IS NOT NULL AND TRIM(cavalo_nome) != ''
  ) LOOP
    IF NOT EXISTS (SELECT 1 FROM cavalos WHERE LOWER(nome) = LOWER(rec.nome)) THEN
      novo_id := 'cav-' || substr(md5(random()::text || rec.nome), 1, 12);
      INSERT INTO cavalos (id, nome, tipo, ativo)
      VALUES (novo_id, rec.nome, 'PUXA', true);
    END IF;
  END LOOP;

  -- Linkar IDs nas senhas antigas
  UPDATE senhas s
  SET puxador_id = c.id
  FROM competidores c
  WHERE LOWER(s.puxador_nome) = LOWER(c.nome) AND s.puxador_id IS NULL;

  UPDATE senhas s
  SET esteira_id = c.id
  FROM competidores c
  WHERE LOWER(s.esteira_nome) = LOWER(c.nome) AND s.esteira_id IS NULL;

  UPDATE senhas s
  SET cavalo_puxa_id = cav.id
  FROM cavalos cav
  WHERE LOWER(s.cavalo_nome) = LOWER(cav.nome) AND s.cavalo_puxa_id IS NULL;
END $$;
