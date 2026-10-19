-- ==============================================================================
-- Migração 007: Cronômetro de Cancela Sincronizado no Servidor e Desfazer de Resultados
-- ==============================================================================

-- 1. Tabela de estado do cronômetro de cancela (Sincronização server-side)
CREATE TABLE IF NOT EXISTS cancela_status (
    vaquejada_id VARCHAR(64) PRIMARY KEY REFERENCES vaquejadas(id) ON DELETE CASCADE,
    corrida_id VARCHAR(64) REFERENCES corridas_mapa(id) ON DELETE SET NULL,
    tempo_tolerancia_segundos INTEGER NOT NULL DEFAULT 30,
    iniciada_em TIMESTAMPTZ,
    status VARCHAR(32) NOT NULL DEFAULT 'PARADA' CHECK (status IN ('PARADA', 'RODANDO', 'ESTOURADA')),
    atualizado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    atualizado_por VARCHAR(64)
);

-- Inserir estado padrão da cancela para a vaquejada ativa
INSERT INTO cancela_status (vaquejada_id, tempo_tolerancia_segundos, status)
SELECT id, COALESCE(tempo_cancela_segundos, 30), 'PARADA'
FROM vaquejadas
ON CONFLICT (vaquejada_id) DO NOTHING;

-- 2. Colunas para desfazer de curta duração (10s) e auditoria de correção em corridas_mapa
ALTER TABLE corridas_mapa
ADD COLUMN IF NOT EXISTS resultado_anterior VARCHAR(32),
ADD COLUMN IF NOT EXISTS resultado_registrado_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS corrigido_por_admin_id VARCHAR(64),
ADD COLUMN IF NOT EXISTS motivo_correcao_admin TEXT,
ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

