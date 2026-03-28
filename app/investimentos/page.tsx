'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/utils';
import { Card, StatCard } from '@/components/ui/card';
import Modal from '@/components/ui/modal';
import { Plus, Edit2, Trash2, TrendingUp, Wallet, PieChart, AlertCircle, RefreshCcw, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import SidebarLayout from '@/components/sidebar-layout';
import { ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Tooltip } from 'recharts';

export default function InvestimentosPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  const [categories, setCategories] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);

  const { register, handleSubmit, reset, setValue } = useForm();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchHelpers = React.useCallback(async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) return;

      const fetchTable = async (tableName: string, query: any) => {
        const { data, error } = await query;
        if (error) {
          console.error(`Error fetching ${tableName}:`, error);
          return [];
        }
        return data || [];
      };

      const [c, b] = await Promise.all([
        fetchTable('categories', supabase.from('categories').select('*').eq('type', 'investment').eq('user_id', user.id)),
        fetchTable('banks', supabase.from('banks').select('*').eq('user_id', user.id))
      ]);
      setCategories(c);
      setBanks(b);
    } catch (error) {
      console.error('Error fetching helpers:', error);
    }
  }, []);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) return;

      const { data: result, error: fetchError } = await supabase
        .from('investments')
        .select('*, categories(name), banks(name)')
        .eq('user_id', user.id)
        .order('date', { ascending: false });
      
      if (fetchError) throw fetchError;
      setData(result || []);
    } catch (error: any) {
      setError(handleSupabaseError(error, 'Erro ao carregar investimentos.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHelpers();
    fetchData();
  }, [fetchHelpers, fetchData]);

  const onSubmit = async (formData: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const dateToSave = formData.date.includes('T') ? formData.date : `${formData.date}T12:00:00`;
      
      const payload = {
        description: formData.description,
        amount: Number(formData.amount),
        date: dateToSave,
        category_id: formData.category_id,
        bank_id: formData.bank_id,
        notes: formData.notes || null,
        user_id: user.id
      };

      if (editingItem) {
        const { error } = await supabase.from('investments').update(payload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('investments').insert([payload]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      setEditingItem(null);
      reset();
      fetchData();
    } catch (error: any) {
      console.error('Error saving investment:', error);
      alert(`Erro ao salvar investimento: ${error.message}`);
    }
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    Object.keys(item).forEach(key => {
      setValue(key, item[key]);
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('investments').delete().eq('id', id);
      if (error) throw error;
      setDeleteConfirmId(null);
      await fetchData();
    } catch (error: any) {
      console.error('Error deleting investment:', error);
    }
  };

  const totalInvested = data.reduce((sum, item) => sum + Number(item.amount), 0);
  
  const chartData = React.useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach(item => {
      const name = item.categories?.name || 'Outros';
      map[name] = (map[name] || 0) + Number(item.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [data]);

  const COLORS = ['#22c55e', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4'];

  return (
    <SidebarLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Investimentos</h1>
            <p className="text-text-secondary">Acompanhamento de aportes e patrimônio</p>
          </div>
          <button 
            onClick={() => { setEditingItem(null); reset(); setIsModalOpen(true); }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Novo Aporte
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3 text-red-500">
            <AlertCircle className="w-5 h-5" />
            <div className="flex-1 text-sm">
              <p className="font-bold">Erro ao carregar dados</p>
              <p>{error}</p>
            </div>
            <button onClick={() => fetchData()} className="p-2 hover:bg-red-500/10 rounded-lg transition-colors">
              <RefreshCcw className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard 
            title="Total Investido" 
            value={`R$ ${totalInvested.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={Wallet}
            color="blue"
          />
          <StatCard 
            title="Aportes este Mês" 
            value={`R$ ${data.filter(i => new Date(i.date).getMonth() === new Date().getMonth()).reduce((sum, i) => sum + Number(i.amount), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={ArrowUpRight}
            color="accent"
          />
          <StatCard 
            title="Diversificação" 
            value={`${chartData.length} Categorias`}
            icon={PieChart}
            color="purple"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2">
            <h3 className="text-xl font-bold mb-6">Histórico de Aportes</h3>
            {loading ? (
              <div className="py-12 text-center text-text-secondary">Carregando...</div>
            ) : data.length === 0 ? (
              <div className="py-12 text-center text-text-secondary">Nenhum investimento registrado.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border text-sm text-text-secondary">
                      <th className="pb-4 font-medium">Data</th>
                      <th className="pb-4 font-medium">Ativo/Descrição</th>
                      <th className="pb-4 font-medium">Categoria</th>
                      <th className="pb-4 font-medium">Valor</th>
                      <th className="pb-4 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.map((item) => (
                      <tr key={item.id} className="group hover:bg-neutral-800/30 transition-colors">
                        <td className="py-4 text-sm">{format(new Date(item.date), 'dd/MM/yyyy')}</td>
                        <td className="py-4 font-medium">
                          <div>
                            <p>{item.description}</p>
                            <p className="text-[10px] text-text-secondary uppercase">{item.banks?.name}</p>
                          </div>
                        </td>
                        <td className="py-4 text-sm">
                          <span className="px-2 py-1 rounded-md bg-blue-500/10 text-blue-500 text-[10px] uppercase font-bold">
                            {item.categories?.name}
                          </span>
                        </td>
                        <td className="py-4 font-bold text-blue-500">R$ {Number(item.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td className="py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-60 hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(item)} className="p-2 hover:bg-neutral-700 rounded-lg text-text-secondary">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeleteConfirmId(item.id)} className="p-2 hover:bg-red-500/10 rounded-lg text-red-500">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <h3 className="text-xl font-bold mb-6">Alocação de Ativos</h3>
            <div className="h-[300px]">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={chartData}
                      innerRadius={70}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#141414', 
                        border: '1px solid #262626',
                        borderRadius: '12px'
                      }}
                    />
                  </RePieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-text-secondary text-sm italic">
                  Sem dados para exibir
                </div>
              )}
            </div>
            <div className="mt-6 space-y-3">
              {chartData.map((cat, i) => (
                <div key={cat.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                    <span className="text-text-secondary">{cat.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">R$ {cat.value.toLocaleString('pt-BR')}</p>
                    <p className="text-[10px] text-text-secondary">{((cat.value / totalInvested) * 100).toFixed(1)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Delete Confirmation Modal */}
        <Modal 
          isOpen={!!deleteConfirmId} 
          onClose={() => setDeleteConfirmId(null)} 
          title="Confirmar Exclusão"
        >
          <div className="space-y-6">
            <p className="text-text-secondary text-center">
              Deseja realmente excluir este aporte?
            </p>
            <div className="flex gap-4">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 btn-secondary">Cancelar</button>
              <button onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl">Excluir</button>
            </div>
          </div>
        </Modal>

        <Modal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          title={editingItem ? 'Editar Aporte' : 'Novo Aporte'}
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Ativo / Descrição</label>
              <input {...register('description')} className="input-field" placeholder="Ex: PETR4, Tesouro Selic 2029..." required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Valor do Aporte</label>
                <input type="number" step="0.01" {...register('amount')} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Data</label>
                <input type="date" {...register('date')} className="input-field" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Categoria</label>
                <select {...register('category_id')} className="input-field" required>
                  <option value="">Selecione...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Corretora / Banco</label>
                <select {...register('bank_id')} className="input-field" required>
                  <option value="">Selecione...</option>
                  {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notas</label>
              <textarea {...register('notes')} className="input-field h-24 resize-none" />
            </div>
            <div className="pt-4 flex gap-3">
              <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary flex-1">Cancelar</button>
              <button type="submit" className="btn-primary flex-1">Salvar</button>
            </div>
          </form>
        </Modal>
      </div>
    </SidebarLayout>
  );
}
