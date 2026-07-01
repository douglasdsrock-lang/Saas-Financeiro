'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { handleSupabaseError, formatDate } from '@/lib/utils';
import { Card, StatCard } from '@/components/ui/card';
import Modal from '@/components/ui/modal';
import { Plus, Edit2, Trash2, TrendingUp, Wallet, PieChart, AlertCircle, RefreshCcw, ArrowUpRight, ArrowDownRight, Search } from 'lucide-react';
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
  const [isUpdateBalanceModalOpen, setIsUpdateBalanceModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    search: '',
    category: ''
  });
  
  const [categories, setCategories] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);

  const { register, handleSubmit, reset, setValue } = useForm();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Bulk Selection States
  const [selectedInvestmentIds, setSelectedInvestmentIds] = useState<string[]>([]);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);

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
    setSelectedInvestmentIds([]);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) return;

      let query = supabase
        .from('investments')
        .select('*, categories(name), banks(name)')
        .eq('user_id', user.id);

      if (filters.category) {
        query = query.eq('category_id', filters.category);
      }
      if (filters.startDate) {
        query = query.gte('date', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('date', filters.endDate);
      }
      if (filters.search) {
        query = query.ilike('asset_name', `%${filters.search}%`);
      }

      const { data: result, error: fetchError } = await query.order('date', { ascending: false });
      
      if (fetchError) throw fetchError;
      setData(result || []);
    } catch (error: any) {
      setError(handleSupabaseError(error, 'Erro ao carregar investimentos.'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

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
        asset_name: formData.asset_name,
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

  const onUpdateBalanceSubmit = async (formData: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const dateToSave = formData.date.includes('T') ? formData.date : `${formData.date}T12:00:00`;
      const novoSaldo = Number(formData.novo_saldo);
      
      const transacoesAtivo = data.filter(item => item.asset_name.toLowerCase() === formData.asset_name.toLowerCase());
      
      let saldoAtualAtivo = transacoesAtivo.reduce((sum, item) => {
        if (item.type === 'aporte' || item.type === 'rendimento') return sum + Number(item.amount);
        if (item.type === 'resgate') return sum - Number(item.amount);
        return sum;
      }, 0);

      const diferenca = novoSaldo - saldoAtualAtivo;

      if (diferenca === 0) {
        alert('O saldo atual informado é igual ao saldo registrado no sistema. Nenhuma alteração necessária.');
        return;
      }

      const payload = {
        asset_name: formData.asset_name,
        amount: diferenca,
        date: dateToSave,
        category_id: formData.category_id,
        bank_id: formData.bank_id,
        type: 'rendimento',
        notes: 'Atualização de Saldo Automática',
        user_id: user.id
      };

      const { error } = await supabase.from('investments').insert([payload]);
      if (error) throw error;

      setIsUpdateBalanceModalOpen(false);
      reset();
      fetchData();
    } catch (error: any) {
      console.error('Error updating balance:', error);
      alert(`Erro ao atualizar saldo: ${error.message}`);
    }
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    Object.keys(item).forEach(key => {
      if (key === 'date' && item[key]) {
        setValue(key, item[key].split('T')[0]);
      } else {
        setValue(key, item[key]);
      }
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

  const handleBulkDelete = async () => {
    try {
      const { error } = await supabase.from('investments').delete().in('id', selectedInvestmentIds);
      if (error) throw error;
      setSelectedInvestmentIds([]);
      setIsBulkDeleteConfirmOpen(false);
      await fetchData();
    } catch (error: any) {
      console.error('Error bulk deleting investments:', error);
    }
  };

  const totalInvested = data.reduce((sum, item) => {
    if (item.type === 'aporte') return sum + Number(item.amount);
    if (item.type === 'resgate') return sum - Number(item.amount);
    return sum;
  }, 0);

  const totalYield = data.reduce((sum, item) => {
    if (item.type === 'rendimento') return sum + Number(item.amount);
    return sum;
  }, 0);

  const grossBalance = totalInvested + totalYield;
  
  const uniqueAssets = React.useMemo(() => {
    const assets = new Map();
    data.forEach(item => {
      if (!assets.has(item.asset_name)) {
        assets.set(item.asset_name, item);
      }
    });
    return Array.from(assets.values());
  }, [data]);

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
          <div className="flex gap-3">
            <button 
              onClick={() => { setIsUpdateBalanceModalOpen(true); reset(); setValue('date', format(new Date(), 'yyyy-MM-dd')); }}
              className="btn-secondary flex items-center gap-2"
            >
              <RefreshCcw className="w-4 h-4" /> Atualizar Saldo
            </button>
            <button 
              onClick={() => { setEditingItem(null); reset(); setValue('type', 'aporte'); setValue('date', format(new Date(), 'yyyy-MM-dd')); setIsModalOpen(true); }}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Novo Lançamento
            </button>
          </div>
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
            title="Saldo Bruto" 
            value={`R$ ${grossBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={Wallet}
            color="blue"
          />
          <StatCard 
            title="Total Investido" 
            value={`R$ ${totalInvested.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={ArrowUpRight}
            color="accent"
          />
          <StatCard 
            title="Rendimentos" 
            value={`R$ ${totalYield.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={TrendingUp}
            color="green"
          />
        </div>

        <div className="flex flex-wrap gap-4 items-center bg-panel p-4 border border-border rounded-2xl shadow-sm">
          <div className="flex items-center gap-2">
            <input 
              type="date" 
              value={filters.startDate}
              onChange={(e) => setFilters({...filters, startDate: e.target.value})}
              onClick={(e) => e.currentTarget.showPicker()}
              className="bg-panel border border-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40 transition-all cursor-pointer"
              title="Data Início"
            />
            <span className="text-text-secondary text-sm font-semibold">até</span>
            <input 
              type="date" 
              value={filters.endDate}
              onChange={(e) => setFilters({...filters, endDate: e.target.value})}
              onClick={(e) => e.currentTarget.showPicker()}
              className="bg-panel border border-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40 transition-all cursor-pointer"
              title="Data Fim"
            />
          </div>

          <div className="flex-1 min-w-[200px] relative">
            <input 
              type="text"
              placeholder="Pesquisar ativo/descrição..."
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
              className="input-field !pl-10 h-10"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none">
              <Search className="w-4 h-4" />
            </div>
          </div>

          <select 
            value={filters.category}
            onChange={(e) => setFilters({...filters, category: e.target.value})}
            className="bg-panel border border-border rounded-lg px-3 py-2 text-sm focus:ring-accent text-white"
          >
            <option value="" className="bg-[#0c0c10] text-white">Todas Categorias</option>
            {categories.map(c => <option key={c.id} value={c.id} className="bg-[#0c0c10] text-white">{c.name}</option>)}
          </select>

          <button 
            onClick={() => setFilters({ startDate: '', endDate: '', search: '', category: '' })}
            className="text-xs text-text-secondary hover:text-accent transition-colors"
          >
            Limpar Filtros
          </button>

          <div className="w-full md:w-auto text-center md:ml-auto text-blue-500 font-bold px-4 bg-blue-500/10 py-2 rounded-xl">
            Total na Lista: R$ {data.reduce((sum, item) => sum + (item.type === 'resgate' ? -Number(item.amount) : Number(item.amount)), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2">
            <h3 className="text-xl font-bold mb-6">Histórico de Aportes</h3>
            {loading ? (
              <div className="py-12 text-center text-text-secondary">Carregando...</div>
            ) : data.length === 0 ? (
              <div className="py-12 text-center text-text-secondary">Nenhum investimento registrado.</div>
            ) : (
              <>
                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-border text-sm text-text-secondary">
                        <th className="pb-4 w-10">
                          <input 
                            type="checkbox"
                            checked={data.length > 0 && selectedInvestmentIds.length === data.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedInvestmentIds(data.map(item => item.id));
                              } else {
                                setSelectedInvestmentIds([]);
                              }
                            }}
                            className="checkbox-custom"
                          />
                        </th>
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
                          <td className="py-4">
                            <input 
                              type="checkbox"
                              checked={selectedInvestmentIds.includes(item.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedInvestmentIds(prev => [...prev, item.id]);
                                } else {
                                  setSelectedInvestmentIds(prev => prev.filter(id => id !== item.id));
                                }
                              }}
                              className="checkbox-custom"
                            />
                          </td>
                          <td className="py-4 text-sm">{formatDate(item.date)}</td>
                          <td className="py-4 font-medium">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <p>{item.asset_name}</p>
                                {item.type === 'aporte' && <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold bg-blue-500/10 text-blue-500">Aporte</span>}
                                {item.type === 'rendimento' && <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold bg-green-500/10 text-green-500">Rendimento</span>}
                                {item.type === 'resgate' && <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold bg-orange-500/10 text-orange-500">Resgate</span>}
                                {(!item.type || (item.type !== 'aporte' && item.type !== 'rendimento' && item.type !== 'resgate')) && <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold bg-blue-500/10 text-blue-500">Aporte</span>}
                              </div>
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

                {/* Mobile Card List View */}
                <div className="md:hidden space-y-4">
                  {data.map((item) => (
                    <div key={item.id} className="p-4 bg-[#12121a]/40 border border-white/[0.04] rounded-2xl flex flex-col gap-3 relative overflow-hidden transition-all duration-300 hover:border-blue-500/10">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <input 
                            type="checkbox"
                            checked={selectedInvestmentIds.includes(item.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedInvestmentIds(prev => [...prev, item.id]);
                              } else {
                                setSelectedInvestmentIds(prev => prev.filter(id => id !== item.id));
                              }
                            }}
                            className="checkbox-custom shrink-0"
                          />
                          <div className="w-9 h-9 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 shrink-0">
                            <Wallet className="w-4.5 h-4.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-white text-sm truncate">{item.asset_name}</p>
                              {item.type === 'aporte' && <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold bg-blue-500/10 text-blue-500">Aporte</span>}
                              {item.type === 'rendimento' && <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold bg-green-500/10 text-green-500">Rendimento</span>}
                              {item.type === 'resgate' && <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold bg-orange-500/10 text-orange-500">Resgate</span>}
                            </div>
                            <p className="text-[10px] text-text-secondary mt-0.5">{formatDate(item.date)}</p>
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end shrink-0">
                          <p className="font-black text-blue-500 text-sm whitespace-nowrap">R$ {Number(item.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between pt-2.5 border-t border-white/[0.04] gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 text-[9px] uppercase font-bold tracking-wider">
                            {item.categories?.name}
                          </span>
                          {item.banks?.name && (
                            <span className="text-[9px] text-text-secondary bg-white/[0.02] border border-white/[0.04] px-1.5 py-0.5 rounded-md">
                              {item.banks.name}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 ml-auto">
                          <button 
                            onClick={() => openEdit(item)} 
                            className="p-2 hover:bg-neutral-800 rounded-xl text-text-secondary hover:text-white"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setDeleteConfirmId(item.id)} 
                            className="p-2 hover:bg-red-500/10 rounded-xl text-red-500"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
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

        {/* Bulk Delete Confirmation Modal */}
        <Modal 
          isOpen={isBulkDeleteConfirmOpen} 
          onClose={() => setIsBulkDeleteConfirmOpen(false)} 
          title="Confirmar Exclusão em Massa"
        >
          <div className="space-y-6">
            <p className="text-text-secondary text-center">
              Tem certeza que deseja excluir os <strong>{selectedInvestmentIds.length}</strong> aportes selecionados? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-4">
              <button onClick={() => setIsBulkDeleteConfirmOpen(false)} className="flex-1 btn-secondary">Cancelar</button>
              <button onClick={handleBulkDelete} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-colors">Excluir Todos</button>
            </div>
          </div>
        </Modal>

        {selectedInvestmentIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-neutral-950/80 backdrop-blur-xl border border-border/80 px-6 py-4 rounded-2xl flex items-center gap-6 shadow-2xl animate-fade-in-up">
            <span className="text-sm font-semibold text-text">
              {selectedInvestmentIds.length} {selectedInvestmentIds.length === 1 ? 'item selecionado' : 'itens selecionados'}
            </span>
            <div className="flex gap-2">
              <button 
                onClick={() => setIsBulkDeleteConfirmOpen(true)}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-500 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 border border-red-500/30 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir
              </button>
              <button 
                onClick={() => setSelectedInvestmentIds([])}
                className="px-3 py-2 hover:bg-neutral-800 text-text-secondary hover:text-text font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <Modal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          title={editingItem ? 'Editar Lançamento' : 'Novo Lançamento'}
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Ativo / Descrição</label>
                <input {...register('asset_name')} className="input-field" placeholder="Ex: PETR4, Tesouro..." required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tipo de Lançamento</label>
                <select {...register('type')} className="input-field" required>
                  <option value="aporte">Aporte (Investimento)</option>
                  <option value="resgate">Resgate (Retirada)</option>
                  <option value="rendimento">Rendimento Manual</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Valor</label>
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

        <Modal 
          isOpen={isUpdateBalanceModalOpen} 
          onClose={() => setIsUpdateBalanceModalOpen(false)} 
          title="Atualizar Saldo"
        >
          <form onSubmit={handleSubmit(onUpdateBalanceSubmit)} className="space-y-4">
            <p className="text-sm text-text-secondary mb-4">
              Selecione o ativo e informe o saldo total atual dele. O sistema criará um lançamento de rendimento automaticamente com a diferença.
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">Selecione o Ativo</label>
              <select 
                className="input-field" 
                required
                onChange={(e) => {
                  const selected = uniqueAssets.find(a => a.asset_name === e.target.value);
                  if (selected) {
                    setValue('asset_name', selected.asset_name);
                    setValue('category_id', selected.category_id);
                    setValue('bank_id', selected.bank_id);
                  } else {
                    setValue('asset_name', '');
                  }
                }}
              >
                <option value="">Selecione...</option>
                {uniqueAssets.map((a: any) => (
                  <option key={a.asset_name} value={a.asset_name}>{a.asset_name}</option>
                ))}
              </select>
              <input type="hidden" {...register('asset_name')} />
              <input type="hidden" {...register('category_id')} />
              <input type="hidden" {...register('bank_id')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Novo Saldo Total (R$)</label>
                <input type="number" step="0.01" {...register('novo_saldo')} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Data da Atualização</label>
                <input type="date" {...register('date')} className="input-field" required />
              </div>
            </div>
            <div className="pt-4 flex gap-3">
              <button type="button" onClick={() => setIsUpdateBalanceModalOpen(false)} className="btn-secondary flex-1">Cancelar</button>
              <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl flex-1 transition-colors">Atualizar Saldo</button>
            </div>
          </form>
        </Modal>
      </div>
    </SidebarLayout>
  );
}
