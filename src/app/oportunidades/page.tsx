'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/Button';
import { DataTable } from '../../components/DataTable';
import { FormInput } from '../../components/FormInput';

interface Oportunidade {
  id: string;
  vaquejada_id: string;
  boi_id: string;
  senha_origem_id?: string;
  disponivel: boolean;
  criado_em: string;
}

interface Vaquejada {
  id: string;
  codigo: string;
  nome: string;
}

interface Boi {
  id: string;
  numero_registro?: string;
  nome?: string;
}

interface Senha {
  id: string;
  codigo: string;
}

export default function OportunidadesPage() {
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([]);
  const [vaquejadas, setVaquejadas] = useState<Vaquejada[]>([]);
  const [bois, setBois] = useState<Boi[]>([]);
  const [senhas, setSenhas] = useState<Senha[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Oportunidade>>({
    vaquejada_id: '',
    boi_id: '',
    senha_origem_id: '',
    disponivel: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [oportunidadesRes, vaquejadasRes, boisRes, senhasRes] = await Promise.all([
        api.get<Oportunidade[]>('/api/oportunidades'),
        api.get<Vaquejada[]>('/api/vaquejadas'),
        api.get<Boi[]>('/api/bois'),
        api.get<Senha[]>('/api/senhas?status=USADA') // Apenas senhas usadas podem gerar oportunidades
      ]);

      if (oportunidadesRes.error) throw new Error(oportunidadesRes.error);
      if (vaquejadasRes.error) throw new Error(vaquejadasRes.error);
      if (boisRes.error) throw new Error(boisRes.error);
      if (senhasRes.error) throw new Error(senhasRes.error);

      setOportunidades(oportunidadesRes.data || []);
      setVaquejadas(vaquejadasRes.data || []);
      setBois(boisRes.data || []);
      setSenhas(senhasRes.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof Oportunidade, value: string | boolean | undefined) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.vaquejada_id || !formData.boi_id) {
      setError('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    if (editing) {
      // Update existing
      const response = await api.put<Oportunidade>(`/api/oportunidades/${editing}`, formData as Oportunidade);
      if (response.error) {
        setError(response.error);
      } else {
        setEditing(null);
        setFormData({
          vaquejada_id: '',
          boi_id: '',
          senha_origem_id: '',
          disponivel: true
        });
        await loadData();
      }
    } else {
      // Create new
      const response = await api.post<Oportunidade>('/api/oportunidades', formData as Oportunidade);
      if (response.error) {
        setError(response.error);
      } else {
        setFormData({
          vaquejada_id: '',
          boi_id: '',
          senha_origem_id: '',
          disponivel: true
        });
        await loadData();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta oportunidade?')) return;

    const response = await api.delete<void>(`/api/oportunidades/${id}`);
    if (response.error) {
      setError(response.error);
    } else {
      await loadData();
    }
  };

  const handleEdit = (oportunidade: Oportunidade) => {
    setEditing(oportunidade.id);
    setFormData({
      vaquejada_id: oportunidade.vaquejada_id,
      boi_id: oportunidade.boi_id,
      senha_origem_id: oportunidade.senha_origem_id || '',
      disponivel: oportunidade.disponivel
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
            Gestão de Oportunidades
          </h1>
          <Button
            variant="primary"
            onClick={() => setEditing(null)}
          >
            {editing ? 'Cancelar' : 'Nova Oportunidade'}
          </Button>
        </div>

        {/* Form */}
        <div className="bg-white shadow-sm rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {editing ? 'Editar Oportunidade' : 'Nova Oportunidade'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
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
            <FormInput
              label="Boi *"
              placeholder="Selecione um boi"
              value={formData.boi_id || ''}
              onChange={(e) => handleChange('boi_id', e.target.value)}
              required
              error={error && error.includes('boi') ? error : undefined}
            >
              <option value="">Selecione um boi</option>
              {bois.map(b => (
                <option key={b.id} value={b.id}>
                  {b.numero_registro || b.nome || `Boi ${b.id}`}
                </option>
              ))}
            </FormInput>
            <FormInput
              label="Senha de Origem (Opcional)"
              placeholder="Selecione a senha usada que gerou esta oportunidade"
              value={formData.senha_origem_id || ''}
              onChange={(e) => handleChange('senha_origem_id', e.target.value)}
              error={error && error.includes('senha') ? error : undefined}
            >
              <option value="">Nenhuma (oportunidade manual)</option>
              {senhas.map(s => (
                <option key={s.id} value={s.id}>
                  {s.codigo}
                </option>
              ))}
            </FormInput>
            <div className="flex items-center space-x-3">
              <label className="text-sm font-medium text-gray-700">
                Disponível para Uso
              </label>
              <input
                type="checkbox"
                checked={formData.disponivel ?? true}
                onChange={(e) => handleChange('disponivel', e.target.checked)}
                className="ml-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
            </div>

            <div className="flex items-center justify-between pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing(null);
                  setFormData({
                    vaquejada_id: '',
                    boi_id: '',
                    senha_origem_id: '',
                    disponivel: true
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
            Oportunidades Cadastradas
          </h2>
          <DataTable
            columns={[
              {
                key: 'vaquejada_id',
                label: 'Vaquejada',
                format: (value) => {
                  const vaquejada = vaquejadas.find(v => v.id === value);
                  return vaquejada ? `${vaquejada.codigo} - ${vaquejada.nome}` : value || '-';
                }
              },
              {
                key: 'boi_id',
                label: 'Boi',
                format: (value) => {
                  const boi = bois.find(b => b.id === value);
                  return boi ? `${boi.numero_registro || boi.nome || boi.id}` : value || '-';
                }
              },
              {
                key: 'senha_origem_id',
                label: 'Senha Origem',
                format: (value) => {
                  const senha = senhas.find(s => s.id === value);
                  return senha ? senha.codigo : value || '-';
                }
              },
              {
                key: 'disponivel',
                label: 'Disponível',
                format: (value) => value ? 'Sim' : 'Não'
              },
              {
                key: 'criado_em',
                label: 'Criado em',
                format: (value) => new Date(value).toLocaleDateString('pt-BR')
              }
            ]}
            data={oportunidades}
            showActions={true}
            actions={[
              { label: 'Editar', onClick: handleEdit, variant: 'default' },
              { label: 'Excluir', onClick: handleDelete, variant: 'destructive' }
            ]}
            onRowClick={(oportunidade) => {
              console.log('Clicked on oportunidade:', oportunidade);
            }}
          />
        </div>
      </div>
    </div>
  );
}