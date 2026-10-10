'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/Button';
import { DataTable } from '../../components/DataTable';
import { FormInput } from '../../components/FormInput';

interface Kit {
  id: string;
  vaquejada_id: string;
  codigo: string;
  criado_em: string;
}

interface Vaquejada {
  id: string;
  codigo: string;
  nome: string;
}

export default function KitsPage() {
  const [kits, setKits] = useState<Kit[]>([]);
  const [vaquejadas, setVaquejadas] = useState<Vaquejada[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Kit>>({
    vaquejada_id: '',
    codigo: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [kitsRes, vaquejadasRes] = await Promise.all([
        api.get<Kit[]>('/api/kits'),
        api.get<Vaquejada[]>('/api/vaquejadas')
      ]);

      if (kitsRes.error) throw new Error(kitsRes.error);
      if (vaquejadasRes.error) throw new Error(vaquejadasRes.error);

      setKits(kitsRes.data || []);
      setVaquejadas(vaquejadasRes.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof Kit, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.vaquejada_id || !formData.codigo) {
      setError('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    if (editing) {
      // Update existing
      const response = await api.put<Kit>(`/api/kits/${editing}`, formData as Kit);
      if (response.error) {
        setError(response.error);
      } else {
        setEditing(null);
        setFormData({
          vaquejada_id: '',
          codigo: ''
        });
        await loadData();
      }
    } else {
      // Create new
      const response = await api.post<Kit>('/api/kits', formData as Kit);
      if (response.error) {
        setError(response.error);
      } else {
        setFormData({
          vaquejada_id: '',
          codigo: ''
        });
        await loadData();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este kit?')) return;

    const response = await api.delete<void>(`/api/kits/${id}`);
    if (response.error) {
      setError(response.error);
    } else {
      await loadData();
    }
  };

  const handleEdit = (kit: Kit) => {
    setEditing(kit.id);
    setFormData({
      vaquejada_id: kit.vaquejada_id,
      codigo: kit.codigo
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
            Gestão de Kits
          </h1>
          <Button
            variant="primary"
            onClick={() => setEditing(null)}
          >
            {editing ? 'Cancelar' : 'Novo Kit'}
          </Button>
        </div>

        {/* Form */}
        <div className="bg-white shadow-sm rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {editing ? 'Editar Kit' : 'Novo Kit'}
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
              label="Código *"
              placeholder="Ex: K001"
              value={formData.codigo || ''}
              onChange={(e) => handleChange('codigo', e.target.value)}
              required
              error={error && error.includes('código') ? error : undefined}
            />

            <div className="flex items-center justify-between pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing(null);
                  setFormData({
                    vaquejada_id: '',
                    codigo: ''
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
            Kits Cadastrados
          </h2>
          <DataTable
            columns={[
              { key: 'codigo', label: 'Código' },
              {
                key: 'vaquejada_id',
                label: 'Vaquejada',
                format: (value) => {
                  const vaquejada = vaquejadas.find(v => v.id === value);
                  return vaquejada ? `${vaquejada.codigo} - ${vaquejada.nome}` : value || '-';
                }
              },
              {
                key: 'criado_em',
                label: 'Criado em',
                format: (value) => new Date(value).toLocaleDateString('pt-BR')
              }
            ]}
            data={kits}
            showActions={true}
            actions={[
              { label: 'Editar', onClick: handleEdit, variant: 'default' },
              { label: 'Excluir', onClick: handleDelete, variant: 'destructive' }
            ]}
            onRowClick={(kit) => {
              console.log('Clicked on kit:', kit);
            }}
          />
        </div>
      </div>
    </div>
  );
}