'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/Button';
import { DataTable } from '../../components/DataTable';
import { FormInput } from '../../components/FormInput';

interface Resultado {
  id: string;
  senha_id: string;
  vaquejada_id: string;
  boi1_nota?: number;
  boi2_nota?: number;
  boi1_desclassificado: boolean;
  boi2_desclassificado: boolean;
  motivo_desclassificao_boi1?: string;
  motivo_desclassificao_boi2?: string;
  decisao_juiz: string;
  observacoes_juiz?: string;
  video_contestacao_url?: string;
  criado_em: string;
}

interface Senha {
  id: string;
  codigo: string;
}

interface Vaquejada {
  id: string;
  codigo: string;
  nome: string;
}

interface Usuario {
  id: string;
  nome: string;
}

export default function ResultadosPage() {
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [senhas, setSenhas] = useState<Senha[]>([]);
  const [vaquejadas, setVaquejadas] = useState<Vaquejada[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Resultado>>({
    senha_id: '',
    vaquejada_id: '',
    boi1_nota: undefined,
    boi2_nota: undefined,
    boi1_desclassificado: false,
    boi2_desclassificado: false,
    motivo_desclassificao_boi1: '',
    motivo_desclassificao_boi2: '',
    decisao_juiz: '',
    observacoes_juiz: '',
    video_contestacao_url: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [resultadosRes, senhasRes, vaquejadasRes, usuariosRes] = await Promise.all([
        api.get<Resultado[]>('/api/resultados-senhas'),
        api.get<Senha[]>('/api/senhas'),
        api.get<Vaquejada[]>('/api/vaquejadas'),
        api.get<Usuario[]>('/api/usuarios') // Assuming this endpoint exists
      ]);

      if (resultadosRes.error) throw new Error(resultadosRes.error);
      if (senhasRes.error) throw new Error(senhasRes.error);
      if (vaquejadasRes.error) throw new Error(vaquejadasRes.error);
      if (usuariosRes.error) throw new Error(usuariosRes.error);

      setResultados(resultadosRes.data || []);
      setSenhas(senhasRes.data || []);
      setVaquejadas(vaquejadasRes.data || []);
      setUsuarios(usuariosRes.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof Resultado, value: string | number | boolean | undefined) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.senha_id || !formData.vaquejada_id || !formData.decisao_juiz) {
      setError('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    // Validate numeric fields if provided
    if (formData.boi1_nota !== undefined && (formData.boi1_nota < 0 || formData.boi1_nota > 10)) {
      setError('A nota do boi 1 deve estar entre 0 e 10');
      return;
    }

    if (formData.boi2_nota !== undefined && (formData.boi2_nota < 0 || formData.boi2_nota > 10)) {
      setError('A nota do boi 2 deve estar entre 0 e 10');
      return;
    }

    if (editing) {
      // Update existing
      const response = await api.put<Resultado>(`/api/resultados-senhas/${editing}`, formData as Resultado);
      if (response.error) {
        setError(response.error);
      } else {
        setEditing(null);
        setFormData({
          senha_id: '',
          vaquejada_id: '',
          boi1_nota: undefined,
          boi2_nota: undefined,
          boi1_desclassificado: false,
          boi2_desclassificado: false,
          motivo_desclassificao_boi1: '',
          motivo_desclassificao_boi2: '',
          decisao_juiz: '',
          observacoes_juiz: '',
          video_contestacao_url: ''
        });
        await loadData();
      }
    } else {
      // Create new
      const response = await api.post<Resultado>('/api/resultados-senhas', formData as Resultado);
      if (response.error) {
        setError(response.error);
      } else {
        setFormData({
          senha_id: '',
          vaquejada_id: '',
          boi1_nota: undefined,
          boi2_nota: undefined,
          boi1_desclassificado: false,
          boi2_desclassificado: false,
          motivo_desclassificao_boi1: '',
          motivo_desclassificao_boi2: '',
          decisao_juiz: '',
          observacoes_juiz: '',
          video_contestacao_url: ''
        });
        await loadData();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este resultado?')) return;

    const response = await api.delete<void>(`/api/resultados-senhas/${id}`);
    if (response.error) {
      setError(response.error);
    } else {
      await loadData();
    }
  };

  const handleEdit = (resultado: Resultado) => {
    setEditing(resultado.id);
    setFormData({
      senha_id: resultado.senha_id,
      vaquejada_id: resultado.vaquejada_id,
      boi1_nota: resultado.boi1_nota,
      boi2_nota: resultado.boi2_nota,
      boi1_desclassificado: resultado.boi1_desclassificado,
      boi2_desclassificado: resultado.boi2_desclassificado,
      motivo_desclassificao_boi1: resultado.motivo_desclassificao_boi1 || '',
      motivo_desclassificao_boi2: resultado.motivo_desclassificao_boi2 || '',
      decisao_juiz: resultado.decisao_juiz,
      observacoes_juiz: resultado.observacoes_juiz || '',
      video_contestacao_url: resultado.video_contestacao_url || ''
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 w-full max-w-xl">
          <p className="font-bold">{error}</p>
          <button onClick={() => setError(null)} className="ml-2 text-indigo-600 hover:text-indigo-800">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Gestão de Resultados
          </h1>
          <Button
            variant="primary"
            onClick={() => setEditing(null)}
          >
            {editing ? 'Cancelar' : 'Novo Resultado'}
          </Button>
        </div>

        {/* Form */}
        <div className="bg-white shadow-sm rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {editing ? 'Editar Resultado' : 'Novo Resultado'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormInput
              label="Senha *"
              placeholder="Selecione uma senha"
              value={formData.senha_id || ''}
              onChange={(e) => handleChange('senha_id', e.target.value)}
              required
              error={error && error.includes('senha') ? error : undefined}
            >
              <option value="">Selecione uma senha</option>
              {senhas.map(s => (
                <option key={s.id} value={s.id}>
                  {s.codigo}
                </option>
              ))}
            </FormInput>
            <FormInput
              label="Vaquejada *"
              placeholder="Selecione uma vaquejada"
              value={formData.vaquejada_id || ''}
              onChange={(e) => handleChange('vaquejada_id', e.target.value)}
              required
              error={error && error.includes('vaquejada') ? error : undefined}
            >
              <option value="">Selecione uma vaquejada</option>
              {vaquejadas.map(v => (
                <option key={v.id} value={v.id}>
                  {v.codigo} - {v.nome}
                </option>
              ))}
            </FormInput>
            <div className="grid gap-4 md:grid-cols-2">
              <FormInput
                label="Nota do Boi 1"
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={formData.boi1_nota !== undefined ? formData.boi1_nota.toString() : ''}
                onChange={(e) => {
                  const num = parseFloat(e.target.value);
                  handleChange('boi1_nota', isNaN(num) ? undefined : num);
                }}
                error={error && error.includes('boi 1 nota') ? error : undefined}
              />
              <FormInput
                label="Nota do Boi 2"
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={formData.boi2_nota !== undefined ? formData.boi2_nota.toString() : ''}
                onChange={(e) => {
                  const num = parseFloat(e.target.value);
                  handleChange('boi2_nota', isNaN(num) ? undefined : num);
                }}
                error={error && error.includes('boi 2 nota') ? error : undefined}
              />
            </div>
            <div className="flex items-center space-x-3">
              <label className="text-sm font-medium text-gray-700">
                Boi 1 Desclassificado
              </label>
              <input
                type="checkbox"
                checked={formData.boi1_desclassificado ?? false}
                onChange={(e) => handleChange('boi1_desclassificado', e.target.checked)}
                className="ml-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
            </div>
            <div className="flex items-center space-x-3">
              <label className="text-sm font-medium text-gray-700">
                Boi 2 Desclassificado
              </label>
              <input
                type="checkbox"
                checked={formData.boi2_desclassificado ?? false}
                onChange={(e) => handleChange('boi2_desclassificado', e.target.checked)}
                className="ml-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
            </div>
            <FormInput
              label="Motivo Desclassificação Boi 1"
              placeholder="Descreva o motivo (se aplicável)"
              value={formData.motivo_desclassificao_boi1 || ''}
              onChange={(e) => handleChange('motivo_desclassificao_boi1', e.target.value)}
            />
            <FormInput
              label="Motivo Desclassificação Boi 2"
              placeholder="Descreva o motivo (se aplicável)"
              value={formData.motivo_desclassificao_boi2 || ''}
              onChange={(e) => handleChange('motivo_desclassificao_boi2', e.target.value)}
            />
            <FormInput
              label="Juiz *"
              placeholder="Selecione o juiz"
              value={formData.decisao_juiz || ''}
              onChange={(e) => handleChange('decisao_juiz', e.target.value)}
              required
              error={error && error.includes('juiz') ? error : undefined}
            >
              <option value="">Selecione um juiz</option>
              {usuarios.map(u => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </FormInput>
            <FormInput
              label="Observações do Juiz"
              placeholder="Observações adicionais do juiz"
              value={formData.observacoes_juiz || ''}
              onChange={(e) => handleChange('observacoes_juiz', e.target.value)}
              multiline={true}
              rows={3}
            />
            <FormInput
              label="URL do Vídeo de Contestação"
              placeholder="URL do vídeo para contestação de zero (se aplicável)"
              value={formData.video_contestacao_url || ''}
              onChange={(e) => handleChange('video_contestacao_url', e.target.value)}
            />

            <div className="flex items-center justify-between pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing(null);
                  setFormData({
                    senha_id: '',
                    vaquejada_id: '',
                    boi1_nota: undefined,
                    boi2_nota: undefined,
                    boi1_desclassificado: false,
                    boi2_desclassificado: false,
                    motivo_desclassificao_boi1: '',
                    motivo_desclassificao_boi2: '',
                    decisao_juiz: '',
                    observacoes_juiz: '',
                    video_contestacao_url: ''
                  });
                }}
              >
                Limpar
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={loading}
              >
                {loading ? 'Salvando...' : (editing ? 'Atualizar' : 'Criar')}
              </Button>
            </div>
          </form>
        </div>

        {/* Table */}
        <div className="bg-white shadow-sm rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Resultados Cadastrados
          </h2>
          <DataTable
            columns={[
              {
                key: 'senha_id',
                label: 'Senha',
                format: (value) => {
                  const senha = senhas.find(s => s.id === value);
                  return senha ? senha.codigo : value || '-';
                }
              },
              {
                key: 'vaquejada_id',
                label: 'Vaquejada',
                format: (value) => {
                  const vaquejada = vaquejadas.find(v => v.id === value);
                  return vaquejada ? `${vaquejada.codigo} - ${vaquejada.nome}` : value || '-';
                }
              },
              {
                key: 'boi1_nota',
                label: 'Nota Boi 1',
                format: (value) => value !== undefined ? `${value}` : '-'
              },
              {
                key: 'boi2_nota',
                label: 'Nota Boi 2',
                format: (value) => value !== undefined ? `${value}` : '-'
              },
              {
                key: 'boi1_desclassificado',
                label: 'Boi 1 Desclass.',
                format: (value) => value ? 'Sim' : 'Não'
              },
              {
                key: 'boi2_desclassificado',
                label: 'Boi 2 Desclass.',
                format: (value) => value ? 'Sim' : 'Não'
              },
              {
                key: 'motivo_desclassificao_boi1',
                label: 'Motivo Desclass. Boi 1'
              },
              {
                key: 'motivo_desclassificao_boi2',
                label: 'Motivo Desclass. Boi 2'
              },
              {
                key: 'decisao_juiz',
                label: 'Juiz',
                format: (value) => {
                  const usuario = usuarios.find(u => u.id === value);
                  return usuario ? usuario.nome : value || '-';
                }
              },
              {
                key: 'observacoes_juiz',
                label: 'Obs. Juiz'
              },
              {
                key: 'video_contestacao_url',
                label: 'Vídeo Contestação',
                format: (value) => value ? 'Link disponível' : '-'
              },
              {
                key: 'criado_em',
                label: 'Criado em',
                format: (value) => new Date(value).toLocaleDateString('pt-BR')
              }
            ]}
            data={resultados}
            showActions={true}
            actions={[
              { label: 'Editar', onClick: handleEdit, variant: 'default' },
              { label: 'Excluir', onClick: handleDelete, variant: 'destructive' }
            ]}
            onRowClick={(resultado) => {
              console.log('Clicked on resultado:', resultado);
            }}
          />
        </div>
      </div>
    </div>
  );
}