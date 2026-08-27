'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { handleSupabaseError, formatDate } from '@/lib/utils';
import { Card, StatCard } from '@/components/ui/card';
import Modal from '@/components/ui/modal';
import { Plus, Edit2, Trash2, TrendingUp, Wallet, PieChart, AlertCircle, RefreshCcw, ArrowUpRight, ArrowDownRight, Search, List } from 'lucide-react';
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
  const [people, setPeople] = useState<any[]>([]);

  const { register, handleSubmit, reset, setValue } = useForm();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedHistoryAsset, setSelectedHistoryAsset] = useState<any | null>(null);

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

      const [c, b, p] = await Promise.all([
        fetchTable('categories', supabase.from('categories').select('*').eq('type', 'investment').eq('user_id', user.id)),
        fetchTable('banks', supabase.from('banks').select('*, people:person_id(name)').eq('user_id', user.id)),
        fetchTable('people', supabase.from('people').select('*').eq('user_id', user.id))
      ]);
      setCategories(c);
      setBanks(b);
      setPeople(p);
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
        .select('*, categories(name), banks(name), people(name)')
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
        person_id: formData.person_id,
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
        person_id: formData.person_id,
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
  
  const groupedAssets = React.useMemo(() => {
    const map = new Map();
    data.forEach(item => {
      if (!map.has(item.asset_name)) {
        map.set(item.asset_name, {
          asset_name: item.asset_name,
          category: item.categories?.name,
          category_id: item.category_id,
          bank: item.banks?.name,
          bank_id: item.bank_id,
          person: item.people?.name,
          person_id: item.person_id,
          totalAportes: 0,
          totalRendimentos: 0,
          transactions: []
        });
      }
      const asset = map.get(item.asset_name);
      asset.transactions.push(item);
      if (item.type === 'aporte') asset.totalAportes += Number(item.amount);
      if (item.type === 'resgate') asset.totalAportes -= Number(item.amount);
      if (item.type === 'rendimento') asset.totalRendimentos += Number(item.amount);
    });

    return Array.from(map.values()).map(asset => ({
      ...asset,
      saldoTotal: asset.totalAportes + asset.totalRendimentos
    })).sort((a, b) => b.saldoTotal - a.saldoTotal);
  }, [data]);

  const uniqueAssets = groupedAssets;

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
            <h3 className="text-xl font-bold mb-6">Meus Investimentos</h3>
            {loading ? (
              <div className="py-12 text-center text-text-secondary">Carregando...</div>
            ) : groupedAssets.length === 0 ? (
              <div className="py-12 text-center text-text-secondary">Nenhum investimento registrado.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {groupedAssets.map((asset) => (
                  <div key={asset.asset_name} className="p-5 bg-[#12121a]/80 border border-white/[0.04] rounded-2xl flex flex-col gap-4 relative overflow-hidden group hover:border-accent/30 transition-all shadow-sm">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex gap-3 items-center min-w-0">
                         <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent shrink-0">
                           <Wallet className="w-5 h-5" />
                         </div>
                         <div className="min-w-0">
                           <h4 className="font-bold text-lg text-white truncate" title={asset.asset_name}>{asset.asset_name}</h4>
                           <div className="flex gap-2 items-center text-xs text-text-secondary mt-0.5">
                             <span className="bg-white/5 px-2 py-0.5 rounded-md truncate">{asset.category || 'Sem Categoria'}</span>
                             {asset.bank && <span className="bg-white/5 px-2 py-0.5 rounded-md truncate">{asset.bank}</span>}
                             {asset.person && <span className="bg-white/5 px-2 py-0.5 rounded-md truncate">{asset.person}</span>}
                           </div>
                         </div>
                      </div>
                      <button 
                        onClick={() => setSelectedHistoryAsset(asset)}
                        className="text-xs font-semibold text-text-secondary hover:text-white flex items-center gap-1 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
                      >
                        <List className="w-3.5 h-3.5" /> Histórico
                      </button>
                    </div>

                    <div className="mt-2">
                       <p className="text-sm text-text-secondary mb-1 font-medium">Saldo Total</p>
                       <p className="text-2xl font-black text-accent tracking-tight">R$ {asset.saldoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/[0.04]">
                      <div>
                        <p className="text-[10px] text-text-secondary uppercase font-bold tracking-wider mb-0.5">Total Aportado</p>
                        <p className="text-sm font-bold text-blue-500">R$ {asset.totalAportes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-text-secondary uppercase font-bold tracking-wider mb-0.5">Rendimentos</p>
                        <p className="text-sm font-bold text-green-500">R$ {asset.totalRendimentos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 mt-1">
                       <button 
                          onClick={() => {
                            setEditingItem(null);
                            reset();
                            setValue('type', 'aporte');
                            setValue('date', format(new Date(), 'yyyy-MM-dd'));
                            setValue('asset_name', asset.asset_name);
                            setValue('category_id', asset.category_id);
                            setValue('bank_id', asset.bank_id);
                            setValue('person_id', asset.person_id);
                            setIsModalOpen(true);
                          }}
                          className="flex-1 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
                       >
                         <Plus className="w-3.5 h-3.5" /> Aporte
                       </button>
                       <button 
                          onClick={() => {
                            reset();
                            setValue('date', format(new Date(), 'yyyy-MM-dd'));
                            setValue('asset_name', asset.asset_name);
                            setValue('category_id', asset.category_id);
                            setValue('bank_id', asset.bank_id);
                            setValue('person_id', asset.person_id);
                            setIsUpdateBalanceModalOpen(true);
                          }}
                          className="flex-1 py-2.5 bg-green-500/10 hover:bg-green-500/20 text-green-500 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
                       >
                         <RefreshCcw className="w-3.5 h-3.5" /> Atualizar
                       </button>
                    </div>
                  </div>
                ))}
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
                  <option value="aporte" className="bg-[#0c0c10] text-white">Aporte (Investimento)</option>
                  <option value="resgate" className="bg-[#0c0c10] text-white">Resgate (Retirada)</option>
                  <option value="rendimento" className="bg-[#0c0c10] text-white">Rendimento Manual</option>
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
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Categoria</label>
                <select {...register('category_id')} className="input-field" required>
                  <option value="" className="bg-[#0c0c10] text-white">Selecione...</option>
                  {categories.map(c => <option key={c.id} value={c.id} className="bg-[#0c0c10] text-white">{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Corretora/Banco</label>
                <select {...register('bank_id')} className="input-field" required>
                  <option value="" className="bg-[#0c0c10] text-white">Selecione...</option>
                  {banks.map(b => <option key={b.id} value={b.id} className="bg-[#0c0c10] text-white">{b.name}{b.people?.name ? ` (${b.people.name})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Titular</label>
                <select {...register('person_id')} className="input-field" required>
                  <option value="" className="bg-[#0c0c10] text-white">Selecione...</option>
                  {people.map(p => <option key={p.id} value={p.id} className="bg-[#0c0c10] text-white">{p.name}</option>)}
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
                    setValue('person_id', selected.person_id);
                  } else {
                    setValue('asset_name', '');
                  }
                }}
              >
                <option value="" className="bg-[#0c0c10] text-white">Selecione...</option>
                {uniqueAssets.map((a: any) => (
                  <option key={a.asset_name} value={a.asset_name} className="bg-[#0c0c10] text-white">{a.asset_name}</option>
                ))}
              </select>
              <input type="hidden" {...register('asset_name')} />
              <input type="hidden" {...register('category_id')} />
              <input type="hidden" {...register('bank_id')} />
              <input type="hidden" {...register('person_id')} />
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

        <Modal 
          isOpen={!!selectedHistoryAsset} 
          onClose={() => setSelectedHistoryAsset(null)} 
          title={`Histórico: ${selectedHistoryAsset?.asset_name}`}
        >
          {selectedHistoryAsset?.transactions?.length > 0 && (
            <div className="flex justify-end mb-4 border-b border-white/[0.04] pb-4">
              <button 
                onClick={() => {
                  if (selectedHistoryAsset) {
                    const ids = selectedHistoryAsset.transactions.map((t: any) => t.id);
                    setSelectedInvestmentIds(ids);
                    setSelectedHistoryAsset(null);
                    setIsBulkDeleteConfirmOpen(true);
                  }
                }}
                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 border border-red-500/20"
              >
                <Trash2 className="w-4 h-4" /> Excluir Ativo Inteiro
              </button>
            </div>
          )}
          <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-3 custom-scrollbar">
             {selectedHistoryAsset?.transactions.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((item: any) => (
                <div key={item.id} className="p-4 bg-panel border border-border rounded-xl flex items-center justify-between group">
                   <div>
                     <div className="flex items-center gap-2 mb-1.5">
                        {item.type === 'aporte' && <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-blue-500/10 text-blue-500">Aporte</span>}
                        {item.type === 'rendimento' && <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-green-500/10 text-green-500">Rendimento</span>}
                        {item.type === 'resgate' && <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-orange-500/10 text-orange-500">Resgate</span>}
                        {(!item.type || (item.type !== 'aporte' && item.type !== 'rendimento' && item.type !== 'resgate')) && <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-blue-500/10 text-blue-500">Aporte</span>}
                     </div>
                     <p className="text-sm font-semibold">{formatDate(item.date)}</p>
                     {item.notes && <p className="text-xs text-text-secondary mt-1">{item.notes}</p>}
                   </div>
                   <div className="text-right flex flex-col justify-between h-full">
                     <p className={`font-black text-sm ${item.type === 'resgate' ? 'text-orange-500' : 'text-white'}`}>
                        {item.type === 'resgate' ? '-' : ''}R$ {Number(item.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                     </p>
                     <div className="flex items-center justify-end gap-1 mt-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setSelectedHistoryAsset(null); openEdit(item); }} className="p-1.5 hover:bg-white/10 rounded-lg text-text-secondary transition-colors" title="Editar">
                           <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setSelectedHistoryAsset(null); setDeleteConfirmId(item.id); }} className="p-1.5 hover:bg-red-500/20 rounded-lg text-red-500 transition-colors" title="Excluir">
                           <Trash2 className="w-4 h-4" />
                        </button>
                     </div>
                   </div>
                </div>
             ))}
             {selectedHistoryAsset?.transactions.length === 0 && (
                <p className="text-center text-text-secondary py-8">Nenhuma movimentação encontrada.</p>
             )}
          </div>
        </Modal>
      </div>
    </SidebarLayout>
  );
}
