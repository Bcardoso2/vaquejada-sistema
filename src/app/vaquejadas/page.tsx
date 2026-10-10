'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/Button';
import { DataTable } from '../../components/DataTable';
import { FormInput } from '../../components/FormInput';

interface Vaquejada {
  id: string;
  codigo: string;
  nome: string;
  data_inicio: string;
  data_fim: string;
  local?: string;
  status: 'AGENDADA' | 'EM_ANDAMENTO' | 'FINALIZADA' | 'CANCELADA';
  created_at: string;
  updated_at: string;
}

export default function VaquejadasPage() {
  const [vaquejadas, setVaquejadas] = useState<Vaquejada[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Vaquejada>>({
    codigo: '',
    nome: '',
    data_inicio: '',
    data_fim: '',
    local: '',
    status: 'AGENDADA'
  });

  useEffect(() => {
    loadVaquejadas();
  }, []);

  const loadVaquejadas = async () => {
    setLoading(true);
    const response = await api.get<Vaquejada[]>('/api/vaquejadas');
    if (response.error) {
      setError(response.error);
    } else {
      setVaquejadas(response.data || []);
      setError(null);
    }
    setLoading(false);
  };

  const handleChange = (field: keyof Vaquejada, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.codigo || !formData.nome || !formData.data_inicio || !formData.data_fim) {
      setError('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    if (editing) {
      // Update existing
      const response = await api.put<Vaquejada>(`/api/vaquejadas/${editing}`, formData as Vaquejada);
      if (response.error) {
        setError(response.error);
      } else {
        setEditing(null);
        setFormData({
          codigo: '',
          nome: '',
          data_inicio: '',
          data_fim: '',
          local: '',
          status: 'AGENDADA'
        });
        await loadVaquejadas();
      }
    } else {
      // Create new
      const response = await api.post<Vaquejada>('/api/vaquejadas', formData as Vaquejada);
      if (response.error) {
        setError(response.error);
      } else {
        setFormData({
          codigo: '',
          nome: '',
          data_inicio: '',
          data_fim: '',
          local: '',
          status: 'AGENDADA'
        });
        await loadVaquejadas();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta vaquejada?')) return;

    const response = await api.delete<void>(`/api/vaquejadas/${id}`);
    if (response.error) {
      setError(response.error);
    } else {
      await loadVaquejadas();
    }
  };

  const handleEdit = (vaquejada: Vaquejada) => {
    setEditing(vaquejada.id);
    setFormData({
      codigo: vaquejada.codigo,
      nome: vaquejada.nome,
      data_inicio: vaquejada.data_inicio,
      data_fim: vaquejada.data_fim,
      local: vaquejada.local || '',
      status: vaquejada.status
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
            Gestão de Vaquejadas
          </h1>
          <Button
            variant="primary"
            onClick={() => setEditing(null)}
          >
            {editing ? 'Cancelar' : 'Nova Vaquejada'}
          </Button>
        </div>

        {/* Form */}
        <div className="bg-white shadow-sm rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {editing ? 'Editar Vaquejada' : 'Nova Vaquejada'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormInput
              label="Código *"
              placeholder="Ex: VQ001"
              value={formData.codigo || ''}
              onChange={(e) => handleChange('codigo', e.target.value)}
              required
              error={error && error.includes('código') ? error : undefined}
            />
            <FormInput
              label="Nome *"
              placeholder="Nome da vaquejada"
              value={formData.nome || ''}
              onChange={(e) => handleChange('nome', e.target.value)}
              required
              error={error && error.includes('nome') ? error : undefined}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <FormInput
                label="Data de Início *"
                type="date"
                value={formData.data_inicio || ''}
                onChange={(e) => handleChange('data_inicio', e.target.value)}
                required
                error={error && error.includes('data de início') ? error : undefined}
              />
              <FormInput
                label="Data de Fim *"
                type="date"
                value={formData.data_fim || ''}
                onChange={(e) => handleChange('data_fim', e.target.value)}
                required
                error={error && error.includes('data de fim') ? error : undefined}
              />
            </div>
            <FormInput
              label="Local"
              placeholder="Local da vaquejada (opcional)"
              value={formData.local || ''}
              onChange={(e) => handleChange('local', e.target.value)}
            />
            <div className="flex items-center space-x-3">
              <label className="text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                value={formData.status || 'AGENDADA'}
                onChange={(e) => handleChange('status', e.target.value as any)}
                className="ml-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="AGENDADA">Agendada</option>
                <option value="EM_ANDAMENTO">Em Andamento</option>
                <option value="FINALIZADA">Finalizada</option>
                <option value="CANCELADA">Cancelada</option>
              </select>
            </div>

            <div className="flex items-center justify-between pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing(null);
                  setFormData({
                    codigo: '',
                    nome: '',
                    data_inicio: '',
                    data_fim: '',
                    local: '',
                    status: 'AGENDADA'
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
            Vaquejadas Cadastradas
          </h2>
          <DataTable
            columns={[
              { key: 'codigo', label: 'Código' },
              { key: 'nome', label: 'Nome' },
              {
                key: 'data_inicio',
                label: 'Início',
                format: (value) => new Date(value).toLocaleDateString('pt-BR')
              },
              {
                key: 'data_fim',
                label: 'Fim',
                format: (value) => new Date(value).toLocaleDateString('pt-BR')
              },
              { key: 'local', label: 'Local' },
              {
                key: 'status',
                label: 'Status',
                format: (value) => {
                  const statusMap: Record<string, string> = {
                    AGENDADA: 'Agendada',
                    EM_ANDAMENTO: 'Em Andamento',
                    FINALIZADA: 'Finalizada',
                    CANCELADA: 'Cancelada'
                  };
                  return statusMap[value] || value;
                }
              },
              {
                key: 'created_at',
                label: 'Criado em',
                format: (value) => new Date(value).toLocaleDateString('pt-BR')
              }
            ]}
            data={vaquejadas}
            showActions={true}
            actions={[
              {
                label: 'Editar',
                onClick: handleEdit,
                variant: 'default'
              },
              {
                label: 'Excluir',
                onClick: handleDelete,
                variant: 'destructive'
              }
            ]}
            onRowClick={(vaquejada) => {
              console.log('Clicked on vaquejada:', vaquejada);
            }}
          />
        </div>
      </div>
    </div>
  );
}