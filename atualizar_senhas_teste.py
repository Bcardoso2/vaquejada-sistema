# Python script para atualizar senhas no banco de dados para teste
# Este script atualiza senhas nas faixas 0-200 e 800-1000 para estado 'RASCUNHO'
# Facilita o teste da funcionalidade de seleção manual de senhas

import os
import re
import sys
from pathlib import Path

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False
    print("AVISO: psycopg2 não está instalado. O script tentará usar o comando 'psql' diretamente.")
    print("Para instalar: pip install psycopg2-binary")

def load_env_file(env_path):
    """Carrega variáveis de ambiente de um arquivo .env"""
    env_vars = {}
    if env_path.exists():
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    # Remove aspas se presenti
                    value = value.strip('"\'')
                    env_vars[key] = value
    return env_vars

def get_database_connection():
    """Estabelece conexão com o banco de dados PostgreSQL"""
    # Primeiro, tenta carregar do .env.production
    env_path = Path('.env.production')
    env_vars = load_env_file(env_path)

    # Tenta obter DATABASE_URL diretamente
    database_url = env_vars.get('DATABASE_URL')

    if database_url:
        # Remove comentários se houver
        database_url = database_url.split('#')[0].strip()
        if database_url:
            try:
                conn = psycopg2.connect(database_url)
                return conn
            except Exception as e:
                print(f"Erro ao conectar com DATABASE_URL: {e}")

    # Se não conseguiu com DATABASE_URL, tenta construir a partir de variáveis individuais
    db_params = {}
    pg_mapping = {
        'PGHOST': 'host',
        'PGPORT': 'port',
        'PGUSER': 'user',
        'PGPASSWORD': 'password',
        'PGDATABASE': 'dbname'
    }

    for env_key, param_key in pg_mapping.items():
        if env_key in env_vars:
            db_params[param_key] = env_vars[env_key]

    # Se tem host, tenta conectar
    if db_params.get('host'):
        try:
            # Adiciona sslmode=disable se não estiver especificado (comum em ambientes locais)
            if 'sslmode' not in db_params:
                db_params['sslmode'] = 'disable'
            conn = psycopg2.connect(**db_params)
            return conn
        except Exception as e:
            print(f"Erro ao conectar com parâmetros individuais: {e}")

    # Último recurso: tenta conectar como usuário postgres do sistema (peer authentication)
    if not HAS_PSYCOPG2:
        print("Tentando conectar via sistema operacional (usuario postgres)...")
        return None  # Vamos usar subprocess para psql neste caso

    try:
        conn = psycopg2.connect(
            host='localhost',
            port='5432',
            user='postgres',  # Usuário padrão do PostgreSQL em Ubuntu
            dbname='vaquejada_db',  # Nome comum do banco
            sslmode='disable'
        )
        return conn
    except Exception as e:
        print(f"Erro ao conectar como usuario postgres: {e}")

    return None

def update_senhas_ranges(conn):
    """Atualiza senhas nas faixas especificadas para estado RASCUNHO"""
    if not conn:
        print("ERRO: Não foi possível estabelecer conexão com o banco de dados.")
        return False

    try:
        with conn.cursor() as cursor:
            # Inicia transação
            cursor.execute("BEGIN;")

            # Atualiza faixa 0-200
            query_0_200 = """
                UPDATE senhas
                SET estado_comercial = 'RASCUNHO',
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE vaquejada_id = 'vq-2026-portal'
                  AND SUBSTRING(codigo FROM '^SN-(\d{3})-.+$')::int BETWEEN 0 AND 200
            """
            cursor.execute(query_0_200)
            count_0_200 = cursor.rowcount

            # Atualiza faixa 800-1000
            query_800_1000 = """
                UPDATE senhas
                SET estado_comercial = 'RASCUNHO',
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE vaquejada_id = 'vq-2026-portal'
                  AND SUBSTRING(codigo FROM '^SN-(\d{3})-.+$')::int BETWEEN 800 AND 1000
            """
            cursor.execute(query_800_1000)
            count_800_1000 = cursor.rowcount

            # Commit da transação
            cursor.execute("COMMIT;")

            print(f"✅ SUCESSO: Atualizadas {count_0_200} senhas na faixa 0-200")
            print(f"✅ SUCESSO: Atualizadas {count_800_1000} senhas na faixa 800-1000")
            print(f"📊 TOTAL: {count_0_200 + count_800_1000} senhas agora disponíveis para teste")

            # Opcional: mostra alguns exemplos
            cursor.execute("""
                SELECT codigo, estado_comercial
                FROM senhas
                WHERE vaquejada_id = 'vq-2026-portal'
                  AND estado_comercial = 'RASCUNHO'
                  AND (
                    SUBSTRING(codigo FROM '^SN-(\d{3})-.+$')::int BETWEEN 0 AND 200
                    OR
                    SUBSTRING(codigo FROM '^SN-(\d{3})-.+$')::int BETWEEN 800 AND 1000
                  )
                ORDER BY codigo
                LIMIT 10
            """)
            exemplos = cursor.fetchall()
            if exemplos:
                print("\n📋 Exemplos de senhas atualizadas:")
                for row in exemplos:
                    print(f"  - {row[0]} ({row[1]})")

            return True

    except Exception as e:
        try:
            cursor.execute("ROLLBACK;")
        except:
            pass
        print(f"❌ ERRO ao atualizar senhas: {e}")
        return False
    finally:
        conn.close()

def main():
    print("🔧 Script para atualizar senhas no banco de dados (faixas 0-200 e 800-1000)")
    print("📍 Diretório atual:", os.getcwd())
    print()

    # Verifica se estamos no diretório correto
    if not Path('.env.production').exists():
        print("⚠️  AVISO: Arquivo .env.production não encontrado no diretório atual")
        print("   Certifique-se de estar em /var/www/vaquejada")
        resposta = input("   Continuar mesmo assim? (s/N): ").strip().lower()
        if resposta != 's':
            print("👋 Script abortado.")
            return

    # Obtém conexão
    print("🔌 Tentando conectar ao banco de dados...")
    conn = get_database_connection()

    if not conn and not HAS_PSYCOPG2:
        # Fallback para usar subprocess com psql
        print("🔄 Usando método alternativo: comando 'psql' diretamente...")
        # Neste caso, pediríamos para eles rodarem o SQL manualmente ou usaríamos subprocess
        # Por simplicidade neste script, vamos apenas instruir
        print("\n📝 Como o psycopg2 não está disponível, execute estes comandos manualmente:")
        print("   1. psql \"$(grep -E '^DATABASE_URL=' .env.production | cut -d'=' -f2-)\"")
        print("   2. Então cole e execute:")
        print("      BEGIN;")
        print("      UPDATE senhas SET estado_comercial = 'RASCUNHO', atualizado_em = CURRENT_TIMESTAMP WHERE vaquejada_id = 'vq-2026-portal' AND SUBSTRING(codigo FROM '^SN-(\\d{3})-.+$')::int BETWEEN 0 AND 200;")
        print("      UPDATE senhas SET estado_comercial = 'RASCUNHO', atualizado_em = CURRENT_TIMESTAMP WHERE vaquejada_id = 'vq-2026-portal' AND SUBSTRING(codigo FROM '^SN-(\\d{3})-.+$')::int BETWEEN 800 AND 1000;")
        print("      COMMIT;")
        print("\n   Ou use este script simplificado com psql:")
        print("      psql \"$(grep -E '^DATABASE_URL=' .env.production | cut -d'=' -f2-)\" -c \"")
        print("          BEGIN;")
        print("          UPDATE senhas SET estado_comercial = 'RASCUNHO', atualizado_em = CURRENT_TIMESTAMP WHERE vaquejada_id = 'vq-2026-portal' AND SUBSTRING(codigo FROM '^SN-(\\d{3})-.+$')::int BETWEEN 0 AND 200;")
        print("          UPDATE senhas SET estado_comercial = 'RASCUNHO', atualizado_em = CURRENT_TIMESTAMP WHERE vaquejada_id = 'vq-2026-portal' AND SUBSTRING(codigo FROM '^SN-(\\d{3})-.+$')::int BETWEEN 800 AND 1000;")
        print("          COMMIT;\"")
        return

    if not conn:
        print("❌ ERRO: Não foi possível conectar ao banco de dados com nenhum método.")
        print("   Verifique:")
        print("   - Se o arquivo .env.production contém DATABASE_URL válida")
        print("   - Se o serviço PostgreSQL está rodando")
        print("   - Se o usuário e senha estão corretos")
        return

    print("✅ Conexão estabelecida com sucesso!")
    print()

    # Atualiza as senhas
    sucesso = update_senhas_ranges(conn)

    if sucesso:
        print()
        print("🎉 PROCESSO CONCLUÍDO!")
        print("📌 Próximos passos:")
        print("   1. Reinicie a aplicação: pm2 restart vaquejada-externa")
        print("   2. Aguarde 5 segundos e teste:")
        print("      curl -s \"http://vaquejada.67.205.190.178.nip.io/api/secretaria/vendas/disponiveis?vaquejadaId=vq-2026-portal\" | jq '. | length'")
        print("   3. Acesse o frontend: https://vaquejada-clean.vercel.app/secretaria")
        print("   4. Clique em 'Recarregar Senhas Disponíveis' e teste a seleção")
    else:
        print("❌ Falha ao atualizar senhas. Verifique os erros acima.")

if __name__ == "__main__":
    main()