'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/Button';
import { DataTable } from '../../components/DataTable';
import { FormInput } from '../../components/FormInput';

interface Boi {
  id: string;
  numero_registro?: string;
  nome?: string;
  categoria?: string;
  peso_kg?: number;
  cor?: string;
  observacoes?: string;
  criado_em: string;
  atualizado_em: string;
}

export default function BoisPage() {
  const [bois, setBois] = useState<Boi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Boi>>({
    numero_registro: '',
    nome: '',
    categoria: '',
    peso_kg: undefined,
    cor: '',
    observacoes: ''
  });

  useEffect(() => {
    loadBois();
  }, []);

  const loadBois = async () => {
    setLoading(true);
    const response = await api.get<Boi[]>('/api/bois');
    if (response.error) {
      setError(response.error);
    } else {
      setBois(response.data || []);
      setError(null);
    }
    setLoading(false);
  };

  const handleChange = (field: keyof Boi, value: string | number | undefined) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.numero_registro || !formData.nome) {
      setError('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    if (editing) {
      // Update existing
      const response = await api.put<Boi>(`/api/bois/${editing}`, formData as Boi);
      if (response.error) {
        setError(response.error);
      } else {
        setEditing(null);
        setFormData({
          numero_registro: '',
          nome: '',
          categoria: '',
          peso_kg: undefined,
          cor: '',
          observacoes: ''
        });
        await loadBois();
      }
    } else {
      // Create new
      const response = await api.post<Boi>('/api/bois', formData as Boi);
      if (response.error) {
        setError(response.error);
      } else {
        setFormData({
          numero_registro: '',
          nome: '',
          categoria: '',
          peso_kg: undefined,
          cor: '',
          observacoes: ''
        });
        await loadBois();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este boi?')) return;

    const response = await api.delete<void>(`/api/bois/${id}`);
    if (response.error) {
      setError(response.error);
    } else {
      await loadBois();
    }
  };

  const handleEdit = (boi: Boi) => {
    setEditing(boi.id);
    setFormData({
      numero_registro: boi.numero_registro || '',
      nome: boi.nome || '',
      categoria: boi.categoria || '',
      peso_kg: boi.peso_kg,
      cor: boi.cor || '',
      observacoes: boi.observacoes || ''
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
            Gestão de Bois
          </h1>
          <Button
            variant="primary"
            onClick={() => setEditing(null)}
          >
            {editing ? 'Cancelar' : 'Novo Boi'}
          </Button>
        </div>

        {/* Form */}
        <div className="bg-white shadow-sm rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {editing ? 'Editar Boi' : 'Novo Boi'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormInput
              label="Número de Registro *"
              placeholder="Ex: B001"
              value={formData.numero_registro || ''}
              onChange={(e) => handleChange('numero_registro', e.target.value)}
              required
              error={error && error.includes('registro') ? error : undefined}
            />
            <FormInput
              label="Nome *"
              placeholder="Nome do boi"
              value={formData.nome || ''}
              onChange={(e) => handleChange('nome', e.target.value)}
              required
              error={error && error.includes('nome') ? error : undefined}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <FormInput
                label="Categoria"
                placeholder="Ex: NOVELHO, VAQUEADO"
                value={formData.categoria || ''}
                onChange={(e) => handleChange('categoria', e.target.value)}
              />
              <FormInput
                label="Peso (kg)"
                type="number"
                min="0"
                step="0.1"
                value={formData.peso_kg !== undefined ? formData.peso_kg.toString() : ''}
                onChange={(e) => {
                  const num = parseFloat(e.target.value);
                  handleChange('peso_kg', isNaN(num) ? undefined : num);
                }}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormInput
                label="Cor"
                placeholder="Cor do boi"
                value={formData.cor || ''}
                onChange={(e) => handleChange('cor', e.target.value)}
              />
              <FormInput
                label="Observações"
                placeholder="Observações adicionais"
                value={formData.observacoes || ''}
                onChange={(e) => handleChange('observacoes', e.target.value)}
                multiline={true}
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing(null);
                  setFormData({
                    numero_registro: '',
                    nome: '',
                    categoria: '',
                    peso_kg: undefined,
                    cor: '',
                    observacoes: ''
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
            Bois Cadastrados
          </h2>
          <DataTable
            columns={[
              { key: 'numero_registro', label: 'Nº Registro' },
              { key: 'nome', label: 'Nome' },
              { key: 'categoria', label: 'Categoria' },
              {
                key: 'peso_kg',
                label: 'Peso (kg)',
                format: (value) => value !== undefined ? `${value} kg` : '-'
              },
              { key: 'cor', label: 'Cor' },
              { key: 'observacoes', label: 'Observações' },
              {
                key: 'criado_em',
                label: 'Criado em',
                format: (value) => new Date(value).toLocaleDateString('pt-BR')
              }
            ]}
            data={bois}
            showActions={true}
            actions={[
              { label: 'Editar', onClick: handleEdit, variant: 'default' },
              { label: 'Excluir', onClick: handleDelete, variant: 'destructive' }
            ]}
            onRowClick={(boi) => {
              console.log('Clicked on boi:', boi);
            }}
          />
        </div>
      </div>
    </div>
  );
}