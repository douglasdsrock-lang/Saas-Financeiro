'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import Modal from '@/components/ui/modal';
import { Plus, Edit2, Trash2, Search, Filter, Calendar as CalendarIcon, AlertCircle, RefreshCcw, CreditCard } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import SidebarLayout from '@/components/sidebar-layout';

export default function SaidasPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [filters, setFilters] = useState({
    month: '',
    category: '',
    search: '',
    payment_method: ''
  });
  
  const [people, setPeople] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [creditCards, setCreditCards] = useState<any[]>([]);

  const { register, handleSubmit, reset, setValue, watch } = useForm();
  const paymentMethod = watch('payment_method');

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

      const [p, c, cc] = await Promise.all([
        fetchTable('people', supabase.from('people').select('*').eq('user_id', user.id)),
        fetchTable('categories', supabase.from('categories').select('*').eq('type', 'expense').eq('user_id', user.id)),
        fetchTable('credit_cards', supabase.from('credit_cards').select('*').eq('user_id', user.id))
      ]);

      setPeople(p);
      setCategories(c);
      setCreditCards(cc);
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

      let query = supabase
        .from('expenses')
        .select(`
          *,
          people:person_id(name),
          categories:category_id(name),
          credit_cards:credit_card_id(name)
        `)
        .eq('user_id', user.id);
      
      if (filters.category) query = query.eq('category_id', filters.category);
      if (filters.payment_method) query = query.eq('payment_method', filters.payment_method);
      if (filters.month) {
        const start = `${filters.month}-01`;
        const dateObj = new Date(start + 'T00:00:00');
        const end = format(new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0), 'yyyy-MM-dd');
        query = query.gte('date', start).lte('date', end);
      }
      if (filters.search) {
        query = query.ilike('description', `%${filters.search}%`);
      }

      const { data: result, error: fetchError } = await query.order('date', { ascending: false });
      if (fetchError) throw fetchError;
      setData(result || []);
    } catch (error: any) {
      setError(handleSupabaseError(error, 'Erro ao carregar dados de saídas.'));
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

      const installmentsCount = Number(formData.installments_count) || 1;
      const amountPerInstallment = Number(formData.amount) / installmentsCount;
      // Normalize date to 12:00:00 to avoid timezone shifts
      const dateOnly = formData.date.split('T')[0];
      const baseDate = new Date(dateOnly + 'T12:00:00');

      if (editingItem) {
        const payload = {
          description: formData.description,
          amount: Number(formData.amount),
          date: `${dateOnly}T12:00:00`,
          category_id: formData.category_id,
          person_id: formData.person_id,
          payment_method: formData.payment_method,
          credit_card_id: formData.payment_method === 'Cartão de Crédito' ? formData.credit_card_id : null,
          is_fixed: formData.is_fixed || false,
          notes: formData.notes || null,
          user_id: user.id
        };
        const { error } = await supabase.from('expenses').update(payload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        // Create multiple expenses if it's an installment purchase
        const payloads = [];
        for (let i = 0; i < installmentsCount; i++) {
          const installmentDate = new Date(baseDate);
          installmentDate.setMonth(baseDate.getMonth() + i);
          
          // Use YYYY-MM-DD format for storage if possible, or ensure T12:00:00
          const year = installmentDate.getFullYear();
          const month = String(installmentDate.getMonth() + 1).padStart(2, '0');
          const day = String(installmentDate.getDate()).padStart(2, '0');
          const finalDate = `${year}-${month}-${day}T12:00:00`;

          payloads.push({
            description: installmentsCount > 1 ? `${formData.description} (${i + 1}/${installmentsCount})` : formData.description,
            amount: amountPerInstallment,
            date: finalDate,
            category_id: formData.category_id,
            person_id: formData.person_id,
            payment_method: formData.payment_method,
            credit_card_id: formData.payment_method === 'Cartão de Crédito' ? formData.credit_card_id : null,
            is_fixed: formData.is_fixed || false,
            notes: formData.notes || null,
            user_id: user.id
          });
        }
        const { error } = await supabase.from('expenses').insert(payloads);
        if (error) throw error;
      }

      setIsModalOpen(false);
      setEditingItem(null);
      reset();
      fetchData();
    } catch (error: any) {
      console.error('Error saving expense:', error);
      setError(handleSupabaseError(error, 'Erro ao salvar saída.'));
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
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
      setDeleteConfirmId(null);
      await fetchData();
    } catch (error: any) {
      console.error('Error deleting expense:', error);
    }
  };

  const total = data.reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <SidebarLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Saídas</h1>
            <p className="text-text-secondary">Gestão de despesas e pagamentos</p>
          </div>
          <button 
            onClick={() => { setEditingItem(null); reset(); setIsModalOpen(true); }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Nova Saída
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
          <div className="relative group">
            <div className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-all cursor-pointer ${filters.month ? 'bg-accent/10 border-accent text-accent' : 'bg-neutral-800/50 border-border text-text-secondary hover:border-accent/50'}`}>
              <CalendarIcon className="w-5 h-5" />
              <input 
                type="month" 
                value={filters.month}
                onChange={(e) => setFilters({...filters, month: e.target.value})}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </div>
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
            className="bg-panel border border-border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Todas Categorias</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select 
            value={filters.payment_method}
            onChange={(e) => setFilters({...filters, payment_method: e.target.value})}
            className="bg-panel border border-border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Todos Métodos</option>
            <option value="Dinheiro">Dinheiro</option>
            <option value="Pix">Pix</option>
            <option value="Cartão de Crédito">Cartão de Crédito</option>
            <option value="Cartão de Débito">Cartão de Débito</option>
            <option value="Boleto">Boleto</option>
          </select>

          <button 
            onClick={() => setFilters({ month: '', category: '', search: '', payment_method: '' })}
            className="text-xs text-text-secondary hover:text-accent"
          >
            Limpar
          </button>

          <div className="ml-auto text-red-500 font-bold px-4 bg-red-500/10 py-2 rounded-xl">
            Total: R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <Card>
          {loading ? (
            <div className="py-12 text-center text-text-secondary">Carregando...</div>
          ) : data.length === 0 ? (
            <div className="py-12 text-center text-text-secondary">Nenhum registro encontrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border text-sm text-text-secondary">
                    <th className="pb-4 font-medium">Data</th>
                    <th className="pb-4 font-medium">Descrição</th>
                    <th className="pb-4 font-medium">Categoria</th>
                    <th className="pb-4 font-medium">Método</th>
                    <th className="pb-4 font-medium">Valor</th>
                    <th className="pb-4 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.map((item) => (
                    <tr key={item.id} className="group hover:bg-neutral-800/30 transition-colors">
                      <td className="py-4 text-sm">
                        {(() => {
                          const [year, month, day] = item.date.split('T')[0].split('-');
                          return `${day}/${month}/${year}`;
                        })()}
                      </td>
                      <td className="py-4 font-medium">
                        <div className="flex items-center gap-2">
                          {item.description}
                          {item.is_fixed && <span className="text-[8px] bg-neutral-800 text-text-secondary px-1.5 py-0.5 rounded uppercase font-black">Fixo</span>}
                        </div>
                      </td>
                      <td className="py-4 text-sm">
                        <span className="px-2 py-1 rounded-md bg-red-500/10 text-red-500 text-[10px] uppercase font-bold">
                          {item.categories?.name}
                        </span>
                      </td>
                      <td className="py-4 text-sm text-text-secondary">
                        <div className="flex items-center gap-1.5">
                          {item.payment_method === 'Cartão de Crédito' && <CreditCard className="w-3 h-3" />}
                          {item.payment_method}
                          {item.credit_cards?.name && <span className="text-[10px] text-accent">({item.credit_cards.name})</span>}
                        </div>
                      </td>
                      <td className="py-4 font-bold text-red-500">R$ {Number(item.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
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

        {/* Delete Confirmation Modal */}
        <Modal 
          isOpen={!!deleteConfirmId} 
          onClose={() => setDeleteConfirmId(null)} 
          title="Confirmar Exclusão"
        >
          <div className="space-y-6">
            <p className="text-text-secondary text-center">
              Tem certeza que deseja excluir esta despesa?
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
          title={editingItem ? 'Editar Saída' : 'Nova Saída'}
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Descrição</label>
              <input {...register('description')} className="input-field" required />
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
                <label className="block text-sm font-medium mb-1">Pessoa Responsável</label>
                <select {...register('person_id')} className="input-field" required>
                  <option value="">Selecione...</option>
                  {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Método de Pagamento</label>
                <select {...register('payment_method')} className="input-field" required>
                  <option value="">Selecione...</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Pix">Pix</option>
                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                  <option value="Cartão de Débito">Cartão de Débito</option>
                  <option value="Boleto">Boleto</option>
                </select>
              </div>
              {paymentMethod === 'Cartão de Crédito' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Cartão de Crédito</label>
                    <select {...register('credit_card_id')} className="input-field" required>
                      <option value="">Selecione...</option>
                      {creditCards.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                    </select>
                  </div>
                  {!editingItem && (
                    <div>
                      <label className="block text-sm font-medium mb-1">Parcelas</label>
                      <select {...register('installments_count')} className="input-field">
                        {[1,2,3,4,5,6,7,8,9,10,11,12,18,24,36,48].map(n => (
                          <option key={n} value={n}>{n === 1 ? 'À vista' : `${n}x`}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" {...register('is_fixed')} id="is_fixed" className="w-4 h-4 rounded border-border bg-panel text-accent focus:ring-accent" />
              <label htmlFor="is_fixed" className="text-sm font-medium">Despesa Fixa / Recorrente</label>
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
