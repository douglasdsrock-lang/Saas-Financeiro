'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { handleSupabaseError, formatDate, cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import Modal from '@/components/ui/modal';
import { Plus, Edit2, Trash2, Search, Filter, Calendar as CalendarIcon, AlertCircle, RefreshCcw, Check, TrendingUp } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import SidebarLayout from '@/components/sidebar-layout';

export default function EntradasPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    category: '',
    search: '',
    person: ''
  });
  
  const [people, setPeople] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);

  const { register, handleSubmit, reset, setValue } = useForm();

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Bulk Selection States
  const [selectedIncomeIds, setSelectedIncomeIds] = useState<string[]>([]);
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

      const [p, c, b] = await Promise.all([
        fetchTable('people', supabase.from('people').select('*').eq('user_id', user.id)),
        fetchTable('categories', supabase.from('categories').select('*').eq('type', 'income').eq('user_id', user.id)),
        fetchTable('banks', supabase.from('banks').select('*, people:person_id(name)').eq('user_id', user.id))
      ]);

      setPeople(p);
      setCategories(c);
      setBanks(b);
    } catch (error) {
      console.error('Error fetching helpers:', error);
    }
  }, []);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelectedIncomeIds([]);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) return;

      let query = supabase
        .from('incomes')
        .select('*, people(name), categories(name), banks(name)')
        .eq('user_id', user.id);
      
      if (filters.category) query = query.eq('category_id', filters.category);
      if (filters.person) query = query.eq('person_id', filters.person);
      if (filters.startDate) {
        query = query.gte('date', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('date', filters.endDate);
      }
      if (filters.search) {
        query = query.ilike('description', `%${filters.search}%`);
      }

      const { data: result, error: fetchError } = await query.order('date', { ascending: false });
      if (fetchError) throw fetchError;
      setData(result || []);
    } catch (error: any) {
      setError(handleSupabaseError(error, 'Erro ao carregar dados de entradas.'));
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

      const dateOnly = formData.date.split('T')[0];
      const dateToSave = `${dateOnly}T12:00:00`;
      
      const payload = {
        description: formData.description,
        amount: Number(formData.amount),
        date: dateToSave,
        category_id: formData.category_id,
        person_id: formData.person_id,
        bank_id: formData.bank_id || null,
        notes: formData.notes || null,
        status: formData.status || 'paid',
        user_id: user.id
      };

      if (editingItem) {
        const { error } = await supabase.from('incomes').update(payload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('incomes').insert([payload]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      setEditingItem(null);
      reset();
      fetchData();
    } catch (error: any) {
      console.error('Error saving income:', error);
      alert(`Erro ao salvar entrada: ${error.message || 'Verifique os campos e tente novamente.'}`);
    }
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    Object.keys(item).forEach(key => {
      if (key === 'amount') {
        setValue(key, Number(item[key]));
      } else if (key === 'date' && item[key]) {
        setValue(key, item[key].split('T')[0]);
      } else {
        setValue(key, item[key]);
      }
    });
    setValue('status', item.status || 'paid');
    setIsModalOpen(true);
  };

  const handleConfirmReceipt = async (id: string) => {
    try {
      const { error } = await supabase
        .from('incomes')
        .update({ status: 'paid', date: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      await fetchData();
    } catch (error: any) {
      alert(`Erro ao confirmar recebimento: ${error.message}`);
    }
  };

  const handleBulkMarkReceived = async () => {
    try {
      const { error } = await supabase
        .from('incomes')
        .update({ status: 'paid' })
        .in('id', selectedIncomeIds);
      if (error) throw error;
      setSelectedIncomeIds([]);
      await fetchData();
      alert('Receitas marcadas como recebidas com sucesso!');
    } catch (err: any) {
      console.error('Error bulk updating incomes:', err);
      alert(`Erro ao atualizar receitas: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('incomes').delete().eq('id', id);
      if (error) throw error;
      setDeleteConfirmId(null);
      await fetchData();
    } catch (error: any) {
      console.error('Error deleting income:', error);
    }
  };

  const handleBulkDelete = async () => {
    try {
      const { error } = await supabase.from('incomes').delete().in('id', selectedIncomeIds);
      if (error) throw error;
      setSelectedIncomeIds([]);
      setIsBulkDeleteConfirmOpen(false);
      await fetchData();
    } catch (error: any) {
      console.error('Error bulk deleting incomes:', error);
    }
  };

  const total = data.reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <SidebarLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Entradas</h1>
            <p className="text-text-secondary">Gestão de recebimentos e receitas</p>
          </div>
          <button 
            onClick={() => { setEditingItem(null); reset(); setIsModalOpen(true); }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Nova Entrada
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
              placeholder="Pesquisar descrição..."
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
            className="bg-panel border border-border rounded-lg px-3 py-2 text-sm focus:ring-accent"
          >
            <option value="">Todas Categorias</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select 
            value={filters.person}
            onChange={(e) => setFilters({...filters, person: e.target.value})}
            className="bg-panel border border-border rounded-lg px-3 py-2 text-sm focus:ring-accent"
          >
            <option value="">Todas Pessoas</option>
            {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <button 
            onClick={() => setFilters({ startDate: '', endDate: '', category: '', search: '', person: '' })}
            className="text-xs text-text-secondary hover:text-accent transition-colors"
          >
            Limpar Filtros
          </button>

          <div className="w-full md:w-auto text-center md:ml-auto text-accent font-bold px-4 bg-accent/10 py-2 rounded-xl">
            Total: R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <Card>
          {loading ? (
            <div className="py-12 text-center text-text-secondary">Carregando...</div>
          ) : data.length === 0 ? (
            <div className="py-12 text-center text-text-secondary">Nenhum registro encontrado.</div>
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
                          checked={data.length > 0 && selectedIncomeIds.length === data.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIncomeIds(data.map(item => item.id));
                            } else {
                              setSelectedIncomeIds([]);
                            }
                          }}
                          className="checkbox-custom"
                        />
                      </th>
                      <th className="pb-4 font-medium">Data</th>
                      <th className="pb-4 font-medium">Descrição</th>
                      <th className="pb-4 font-medium">Categoria</th>
                      <th className="pb-4 font-medium">Pessoa</th>
                      <th className="pb-4 font-medium">Banco</th>
                      <th className="pb-4 font-medium">Status</th>
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
                            checked={selectedIncomeIds.includes(item.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedIncomeIds(prev => [...prev, item.id]);
                              } else {
                                setSelectedIncomeIds(prev => prev.filter(id => id !== item.id));
                              }
                            }}
                            className="checkbox-custom"
                          />
                        </td>
                        <td className="py-4 text-sm">
                          {formatDate(item.date)}
                        </td>
                        <td className="py-4 font-medium">{item.description}</td>
                        <td className="py-4 text-sm">
                          <span className="px-2 py-1 rounded-md bg-accent/10 text-accent text-[10px] uppercase font-bold">
                            {item.categories?.name}
                          </span>
                        </td>
                        <td className="py-4 text-sm text-text-secondary">{item.people?.name}</td>
                        <td className="py-4 text-sm text-text-secondary">{item.banks?.name || '-'}</td>
                        <td className="py-4 text-sm">
                          <span className={cn(
                            "px-2 py-1 rounded-md text-[10px] uppercase font-bold",
                            item.status === 'pending' ? "bg-amber-500/10 text-amber-500 border border-amber-500/10" : "bg-green-500/10 text-green-500 border border-green-500/10"
                          )}>
                            {item.status === 'pending' ? 'Pendente' : 'Recebido'}
                          </span>
                        </td>
                        <td className="py-4 font-bold text-accent">R$ {Number(item.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td className="py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-60 hover:opacity-100 transition-opacity">
                            {item.status === 'pending' && (
                              <button 
                                onClick={() => handleConfirmReceipt(item.id)} 
                                className="p-2 hover:bg-green-500/10 rounded-lg text-green-500"
                                title="Confirmar Recebimento"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
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
                  <div key={item.id} className="p-4 bg-[#12121a]/40 border border-white/[0.04] rounded-2xl flex flex-col gap-3 relative overflow-hidden transition-all duration-300 hover:border-accent/10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <input 
                          type="checkbox"
                          checked={selectedIncomeIds.includes(item.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIncomeIds(prev => [...prev, item.id]);
                            } else {
                              setSelectedIncomeIds(prev => prev.filter(id => id !== item.id));
                            }
                          }}
                          className="checkbox-custom shrink-0"
                        />
                        <div className="w-9 h-9 bg-accent/10 rounded-xl flex items-center justify-center text-accent shrink-0">
                          <TrendingUp className="w-4.5 h-4.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-white text-sm truncate">{item.description}</p>
                          <p className="text-[10px] text-text-secondary mt-0.5">{formatDate(item.date)}</p>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end shrink-0">
                        <p className="font-black text-accent text-sm whitespace-nowrap">R$ {Number(item.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        <span className={cn(
                          "px-2 py-0.5 mt-1 rounded text-[8px] uppercase font-bold tracking-wider",
                          item.status === 'pending' ? "bg-amber-500/10 text-amber-500 border border-amber-500/10" : "bg-green-500/10 text-green-500 border border-green-500/10"
                        )}>
                          {item.status === 'pending' ? 'Pendente' : 'Recebido'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between pt-2.5 border-t border-white/[0.04] gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-accent/10 text-accent text-[9px] uppercase font-bold tracking-wider">
                          {item.categories?.name}
                        </span>
                        {item.people?.name && (
                          <span className="text-[9px] text-text-secondary bg-white/[0.02] border border-white/[0.04] px-1.5 py-0.5 rounded-md">
                            {item.people.name}
                          </span>
                        )}
                        {item.banks?.name && (
                          <span className="text-[9px] text-text-secondary bg-white/[0.02] border border-white/[0.04] px-1.5 py-0.5 rounded-md">
                            {item.banks.name}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 ml-auto">
                        {item.status === 'pending' && (
                          <button 
                            onClick={() => handleConfirmReceipt(item.id)} 
                            className="p-2 hover:bg-green-500/10 rounded-xl text-green-500"
                            title="Confirmar Recebimento"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
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

        {/* Delete Confirmation Modal */}
        <Modal 
          isOpen={!!deleteConfirmId} 
          onClose={() => setDeleteConfirmId(null)} 
          title="Confirmar Exclusão"
        >
          <div className="space-y-6">
            <p className="text-text-secondary text-center">
              Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 btn-secondary"
              >
                Cancelar
              </button>
              <button 
                onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-colors"
              >
                Excluir
              </button>
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
              Tem certeza que deseja excluir as <strong>{selectedIncomeIds.length}</strong> entradas selecionadas? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-4">
              <button onClick={() => setIsBulkDeleteConfirmOpen(false)} className="flex-1 btn-secondary">Cancelar</button>
              <button onClick={handleBulkDelete} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-colors">Excluir Todas</button>
            </div>
          </div>
        </Modal>

        {selectedIncomeIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-neutral-950/80 backdrop-blur-xl border border-border/80 px-6 py-4 rounded-2xl flex items-center gap-6 shadow-2xl animate-fade-in-up">
            <span className="text-sm font-semibold text-text">
              {selectedIncomeIds.length} {selectedIncomeIds.length === 1 ? 'item selecionado' : 'itens selecionados'}
            </span>
            <div className="flex gap-2">
              <button 
                onClick={handleBulkMarkReceived}
                className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-500 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 border border-green-500/30 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" /> Recebido
              </button>
              <button 
                onClick={() => setIsBulkDeleteConfirmOpen(true)}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-500 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 border border-red-500/30 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir
              </button>
              <button 
                onClick={() => setSelectedIncomeIds([])}
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
          title={editingItem ? 'Editar Entrada' : 'Nova Entrada'}
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Descrição</label>
              <input {...register('description')} className="input-field" required />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Valor</label>
                <input type="number" step="0.01" {...register('amount')} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Data</label>
                <input type="date" {...register('date')} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select {...register('status')} className="input-field" required defaultValue="paid">
                  <option value="paid">Recebido</option>
                  <option value="pending">Pendente</option>
                </select>
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
                <label className="block text-sm font-medium mb-1">Pessoa</label>
                <select {...register('person_id')} className="input-field" required>
                  <option value="">Selecione...</option>
                  {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Banco (Opcional)</label>
              <select {...register('bank_id')} className="input-field">
                <option value="">Selecione...</option>
                {banks.map(b => <option key={b.id} value={b.id}>{b.name}{b.people?.name ? ` (${b.people.name})` : ''}</option>)}
              </select>
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
