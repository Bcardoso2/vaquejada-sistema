'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/Button';
import { DataTable } from '../../components/DataTable';
import { FormInput } from '../../components/FormInput';

interface BoiOuRO {
  id: string;
  boi_id: string;
  vaquejada_id: string;
  valor: number;
  pago: boolean;
  pagamento_confirmado_em?: string;
  autorizado_por?: string;
  autorizado_em?: string;
  ativo: boolean;
  criado_em: string;
}

interface Boi {
  id: string;
  numero_registro?: string;
  nome?: string;
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

export default function BoisOuROPage() {
  const [boisOuRO, setBoisOuRO] = useState<BoiOuRO[]>([]);
  const [bois, setBois] = useState<Boi[]>([]);
  const [vaquejadas, setVaquejadas] = useState<Vaquejada[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<BoiOuRO>>({
    boi_id: '',
    vaquejada_id: '',
    valor: 0,
    pago: false,
    ativo: false
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [boisOuRORes, boisRes, vaquejadasRes, usuariosRes] = await Promise.all([
        api.get<BoiOuRO[]>('/api/bois-ouro'),
        api.get<Boi[]>('/api/bois'),
        api.get<Vaquejada[]>('/api/vaquejadas'),
        api.get<Usuario[]>('/api/usuarios')
      ]);

      if (boisOuRORes.error) throw new Error(boisOuRORes.error);
      if (boisRes.error) throw new Error(boisRes.error);
      if (vaquejadasRes.error) throw new Error(vaquejadasRes.error);
      if (usuariosRes.error) throw new Error(usuariosRes.error);

      setBoisOuRO(boisOuRORes.data || []);
      setBois(boisRes.data || []);
      setVaquejadas(vaquejadasRes.data || []);
      setUsuarios(usuariosRes.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof BoiOuRO, value: string | number | boolean | undefined) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.boi_id || !formData.vaquejada_id || (formData.valor || 0) <= 0) {
      setError('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    if (editing) {
      // Update existing
      const response = await api.put<BoiOuRO>(`/api/bois-ouro/${editing}`, formData as BoiOuRO);
      if (response.error) {
        setError(response.error);
      } else {
        setEditing(null);
        setFormData({
          boi_id: '',
          vaquejada_id: '',
          valor: 0,
          pago: false,
          ativo: false
        });
        await loadData();
      }
    } else {
      // Create new
      const response = await api.post<BoiOuRO>('/api/bois-ouro', formData as BoiOuRO);
      if (response.error) {
        setError(response.error);
      } else {
        setFormData({
          boi_id: '',
          vaquejada_id: '',
          valor: 0,
          pago: false,
          ativo: false
        });
        await loadData();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este boi de ouro?')) return;

    const response = await api.delete<void>(`/api/bois-ouro/${id}`);
    if (response.error) {
      setError(response.error);
    } else {
      await loadData();
    }
  };

  const handleEdit = (boiOuRO: BoiOuRO) => {
    setEditing(boiOuRO.id);
    setFormData({
      boi_id: boiOuRO.boi_id,
      vaquejada_id: boiOuRO.vaquejada_id,
      valor: boiOuRO.valor,
      pago: boiOuRO.pago,
      ativo: boiOuRO.ativo
    });
  };

  const handleConfirmPayment = async (id: string) => {
    if (!confirm('Tem certeza que deseja confirmar o pagamento deste boi de ouro?')) return;

    try {
      const response = await api.put<BoiOuRO>(`/api/bois-ouro/${id}/pagamento`, {});
      if (response.error) {
        setError(response.error);
      } else {
        await loadData();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao confirmar pagamento');
    }
  };

  const handleAuthorize = async (id: string) => {
    if (!confirm('Tem certeza que deseja autorizar este boi de ouro?')) return;

    try {
      const response = await api.put<BoiOuRO>(`/api/bois-ouro/${id}/autorizar`, {});
      if (response.error) {
        setError(response.error);
      } else {
        await loadData();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao autorizar');
    }
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
            Gestão de Bois de Ouro
          </h1>
          <Button
            variant="primary"
            onClick={() => setEditing(null)}
          >
            {editing ? 'Cancelar' : 'Novo Boi de Ouro'}
          </Button>
        </div>

        {/* Form */}
        <div className="bg-white shadow-sm rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {editing ? 'Editar Boi de Ouro' : 'Novo Boi de Ouro'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
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
              label="Valor *"
              type="number"
              min="0"
              step="0.01"
              value={formData.valor ? formData.valor.toString() : ''}
              onChange={(e) => {
                const num = parseFloat(e.target.value);
                handleChange('valor', isNaN(num) ? 0 : num);
              }}
              required
              error={error && error.includes('valor') ? error : undefined}
            />
            <div className="flex items-center space-x-3">
              <label className="text-sm font-medium text-gray-700">
                Pagamento Confirmado
              </label>
              <input
                type="checkbox"
                checked={formData.pago ?? false}
                onChange={(e) => handleChange('pago', e.target.checked)}
                className="ml-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
            </div>
            <div className="flex items-center space-x-3">
              <label className="text-sm font-medium text-gray-700">
                Ativo no Mapa Geral
              </label>
              <input
                type="checkbox"
                checked={formData.ativo ?? false}
                onChange={(e) => handleChange('ativo', e.target.checked)}
                className="ml-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
            </div>

            <div className="flex items-center justify-between pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing(null);
                  setFormData({
                    boi_id: '',
                    vaquejada_id: '',
                    valor: 0,
                    pago: false,
                    ativo: false
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
            Bois de Ouro Cadastrados
          </h2>
          <DataTable
            columns={[
              { key: 'boi_id', label: 'Boi' },
              {
                key: 'vaquejada_id',
                label: 'Vaquejada',
                format: (value) => {
                  const vaquejada = vaquejadas.find(v => v.id === value);
                  return vaquejada ? `${vaquejada.codigo} - ${vaquejada.nome}` : value || '-';
                }
              },
              { key: 'valor', label: 'Valor' },
              {
                key: 'pago',
                label: 'Pagamento',
                format: (value) => value ? 'Confirmado' : 'Pendente'
              },
              {
                key: 'pagamento_confirmado_em',
                label: 'Pagto. Confirmado',
                format: (value) => value ? new Date(value).toLocaleDateString('pt-BR') : '-'
              },
              {
                key: 'autorizado_por',
                label: 'Autorizado por',
                format: (value) => {
                  const usuario = usuarios.find(u => u.id === value);
                  return usuario ? usuario.nome : value || '-';
                }
              },
              {
                key: 'autorizado_em',
                label: 'Autorizado em',
                format: (value) => value ? new Date(value).toLocaleDateString('pt-BR') : '-'
              },
              {
                key: 'ativo',
                label: 'Ativo',
                format: (value) => value ? 'Sim' : 'Não'
              },
              {
                key: 'criado_em',
                label: 'Criado em',
                format: (value) => new Date(value).toLocaleDateString('pt-BR')
              }
            ]}
            data={boisOuRO}
            showActions={false}
            actions={[]}
            onRowClick={() => {}}
          />
        </div>
      </div>
    </div>
  );
}