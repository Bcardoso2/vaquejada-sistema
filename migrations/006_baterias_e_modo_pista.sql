-- ==============================================================================
-- Migração 006: Baterias de Corrida, Ordem de Largada e Configurações de Pista
-- ==============================================================================

-- 1. Campos de configuração na tabela vaquejadas
ALTER TABLE vaquejadas 
ADD COLUMN IF NOT EXISTS tamanho_bateria_padrao INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS tempo_cancela_segundos INTEGER DEFAULT 30;

-- 2. Tabela de Baterias
CREATE TABLE IF NOT EXISTS baterias (
    id VARCHAR(64) PRIMARY KEY,
    vaquejada_id VARCHAR(64) NOT NULL REFERENCES vaquejadas(id) ON DELETE CASCADE,
    numero INTEGER NOT NULL,
    categoria VARCHAR(64) DEFAULT 'ABERTA',
    tamanho_maximo INTEGER NOT NULL DEFAULT 15,
    status VARCHAR(32) NOT NULL DEFAULT 'ABERTA' CHECK (status IN ('ABERTA', 'EM_ANDAMENTO', 'FECHADA')),
    criada_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    iniciada_em TIMESTAMPTZ,
    fechada_em TIMESTAMPTZ,
    observacoes TEXT
);

CREATE INDEX IF NOT EXISTS idx_baterias_vaquejada ON baterias(vaquejada_id);
CREATE INDEX IF NOT EXISTS idx_baterias_status ON baterias(status);

-- 3. Vincular corridas_mapa com baterias
ALTER TABLE corridas_mapa
ADD COLUMN IF NOT EXISTS bateria_id VARCHAR(64) REFERENCES baterias(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS ordem_na_bateria INTEGER,
ADD COLUMN IF NOT EXISTS tipo_entrada VARCHAR(32) DEFAULT 'REGULAR' CHECK (tipo_entrada IN ('REGULAR', 'RETARDATARIA', 'RETORNO'));

CREATE INDEX IF NOT EXISTS idx_corridas_bateria ON corridas_mapa(bateria_id);

-- 4. Inserir bateria inicial padrão para corridas existentes da vaquejada ativa
DO $$
DECLARE
    v_id VARCHAR(64);
    b_id VARCHAR(64);
    c_count INTEGER;
BEGIN
    SELECT id INTO v_id FROM vaquejadas ORDER BY created_at DESC LIMIT 1;
    IF v_id IS NOT NULL THEN
        -- Criar Bateria 1 se não existir
        b_id := 'bat-1-' || v_id;
        IF NOT EXISTS (SELECT 1 FROM baterias WHERE id = b_id) THEN
            INSERT INTO baterias (id, vaquejada_id, numero, tamanho_maximo, status, iniciada_em)
            VALUES (b_id, v_id, 1, 15, 'EM_ANDAMENTO', CURRENT_TIMESTAMP);
        END IF;

        -- Associar corridas órfãs à Bateria 1 com numeração de ordem
        WITH ordenadas AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY ordem_mapa ASC, criado_em ASC) as rnum
            FROM corridas_mapa
            WHERE vaquejada_id = v_id AND bateria_id IS NULL
        )
        UPDATE corridas_mapa cm
        SET bateria_id = b_id,
            ordem_na_bateria = ordenadas.rnum,
            tipo_entrada = 'REGULAR'
        FROM ordenadas
        WHERE cm.id = ordenadas.id;
    END IF;
END $$;
