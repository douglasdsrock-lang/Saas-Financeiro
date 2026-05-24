'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import Modal from '@/components/ui/modal';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Users, 
  Building2, 
  CreditCard, 
  Tags, 
  Repeat, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Wallet,
  RefreshCcw
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import SidebarLayout from '@/components/sidebar-layout';
import { cn } from '@/lib/utils';

type TabType = 'people' | 'banks' | 'credit_cards' | 'categories' | 'recurring_bills' | 'recurring_incomes';

export default function CadastrosPage() {
  const [activeTab, setActiveTab] = useState<TabType>('people');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Helper data for forms
  const [people, setPeople] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [creditCards, setCreditCards] = useState<any[]>([]);

  const { register, handleSubmit, reset, setValue, watch } = useForm();
  const paymentMethod = watch('payment_method');
  const categoryType = watch('type');
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, number>>({});

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const budgets = JSON.parse(localStorage.getItem('category_budgets') || '{}');
        setCategoryBudgets(budgets);
      } catch (e) {
        console.error('Error parsing category_budgets:', e);
      }
    }
  }, [activeTab, data]);

  const tabs = [
    { id: 'people', name: 'Pessoas', icon: Users },
    { id: 'banks', name: 'Bancos', icon: Building2 },
    { id: 'credit_cards', name: 'Cartões', icon: CreditCard },
    { id: 'categories', name: 'Categorias', icon: Tags },
    { id: 'recurring_bills', name: 'Contas Fixas', icon: Repeat },
    { id: 'recurring_incomes', name: 'Receitas Fixas', icon: Repeat },
  ];

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

      const [p, c, b, cc] = await Promise.all([
        fetchTable('people', supabase.from('people').select('*').eq('user_id', user.id)),
        fetchTable('categories', supabase.from('categories').select('*').eq('user_id', user.id)),
        fetchTable('banks', supabase.from('banks').select('*').eq('user_id', user.id)),
        fetchTable('credit_cards', supabase.from('credit_cards').select('*').eq('user_id', user.id))
      ]);
      setPeople(p);
      setCategories(c);
      setBanks(b);
      setCreditCards(cc);
    } catch (e) {
      console.error('Error fetching helpers:', e);
    }
  }, []);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) return;

      let query = supabase.from(activeTab).select('*').eq('user_id', user.id);
      
      if (activeTab === 'recurring_bills') {
        query = supabase.from(activeTab).select('*, categories:category_id(name), people:responsible_id(name)').eq('user_id', user.id);
      } else if (activeTab === 'recurring_incomes') {
        query = supabase.from(activeTab).select('*, categories:category_id(name), people:person_id(name)').eq('user_id', user.id);
      }

      const { data: result, error: fetchError } = await query.order('created_at', { ascending: false });
      if (fetchError) throw fetchError;
      setData(result || []);
    } catch (error: any) {
      setError(handleSupabaseError(error, `Erro ao carregar dados de ${activeTab}.`));
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
    fetchHelpers();
    setEditingItem(null);
    reset({}); // Clear form when switching tabs
  }, [activeTab, fetchData, fetchHelpers, reset]);

  const onSubmit = async (formData: any) => {
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log('Form Data:', formData);

      // Define allowed fields for each table to avoid schema pollution
      const allowedFieldsMap: Record<string, string[]> = {
        people: ['name', 'color'],
        categories: ['name', 'type', 'color'],
        banks: ['name', 'color'],
        credit_cards: ['name', 'bank_id', 'holder_id', 'closing_day', 'due_day', 'limit_amount', 'active'],
        recurring_bills: ['name', 'amount', 'due_day', 'category_id', 'responsible_id', 'payment_method', 'credit_card_id', 'active'],
        recurring_incomes: ['name', 'amount', 'due_day', 'category_id', 'person_id', 'bank_id', 'active']
      };

      const allowedFields = allowedFieldsMap[activeTab] || [];
      const payload: any = {};
      
      allowedFields.forEach(field => {
        if (formData[field] !== undefined) {
          payload[field] = formData[field];
        }
      });

      // Conversions
      if (payload.amount !== undefined) payload.amount = Number(payload.amount);
      if (payload.due_day !== undefined) payload.due_day = Number(payload.due_day);
      if (payload.closing_day !== undefined) payload.closing_day = Number(payload.closing_day);
      if (payload.limit_amount !== undefined) payload.limit_amount = Number(payload.limit_amount);
      if (payload.active !== undefined) payload.active = !!payload.active;

      const finalPayload = { ...payload, user_id: user.id };

      console.log(`Saving to ${activeTab}:`, finalPayload);

      let insertedId = editingItem?.id;

      if (editingItem) {
        const { error } = await supabase.from(activeTab).update(finalPayload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { data: insertedData, error } = await supabase.from(activeTab).insert([finalPayload]).select();
        if (error) throw error;
        if (insertedData && insertedData.length > 0) {
          insertedId = insertedData[0].id;
        }
      }

      if (activeTab === 'categories' && insertedId) {
        try {
          const budgets = JSON.parse(localStorage.getItem('category_budgets') || '{}');
          if (formData.limit_amount && formData.type === 'expense') {
            budgets[insertedId] = Number(formData.limit_amount);
          } else {
            delete budgets[insertedId];
          }
          localStorage.setItem('category_budgets', JSON.stringify(budgets));
        } catch (e) {
          console.error('Error saving category budget limit:', e);
        }
      }

      setIsModalOpen(false);
      setEditingItem(null);
      reset({});
      fetchData();
      fetchHelpers();
    } catch (error: any) {
      console.error('Error saving:', error);
      const msg = handleSupabaseError(error, 'Erro ao salvar registro. Verifique se todos os campos obrigatórios estão preenchidos.');
      setError(msg);
      alert(msg);
    }
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    if (activeTab === 'categories') {
      try {
        const budgets = JSON.parse(localStorage.getItem('category_budgets') || '{}');
        const limit = budgets[item.id] || '';
        reset({ ...item, limit_amount: limit });
      } catch (e) {
        console.error('Error loading category budget limit:', e);
        reset(item);
      }
    } else {
      reset(item);
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from(activeTab).delete().eq('id', id);
      if (error) throw error;

      if (activeTab === 'categories') {
        try {
          const budgets = JSON.parse(localStorage.getItem('category_budgets') || '{}');
          delete budgets[id];
          localStorage.setItem('category_budgets', JSON.stringify(budgets));
        } catch (e) {
          console.error('Error removing category budget limit:', e);
        }
      }

      setDeleteConfirmId(null);
      fetchData();
      fetchHelpers();
    } catch (error: any) {
      alert(`Erro ao excluir: ${error.message}`);
    }
  };

  const renderFormFields = () => {
    switch (activeTab) {
      case 'people':
      case 'banks':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nome</label>
              <input {...register('name')} className="input-field" placeholder="Ex: João Silva ou Banco do Brasil" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cor (Hex)</label>
              <input {...register('color')} className="input-field" placeholder="#000000" />
            </div>
          </div>
        );
      case 'credit_cards':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nome do Cartão</label>
              <input {...register('name')} className="input-field" placeholder="Ex: Nubank Platinum" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Banco</label>
                <select {...register('bank_id')} className="input-field" required>
                  <option value="">Selecione...</option>
                  {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Titular</label>
                <select {...register('holder_id')} className="input-field" required>
                  <option value="">Selecione...</option>
                  {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Fechamento</label>
                <input type="number" min="1" max="31" {...register('closing_day')} className="input-field" placeholder="Dia" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Vencimento</label>
                <input type="number" min="1" max="31" {...register('due_day')} className="input-field" placeholder="Dia" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Limite</label>
                <input type="number" step="0.01" {...register('limit_amount')} className="input-field" placeholder="R$" required />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" {...register('active')} id="card_active" defaultChecked className="w-4 h-4 rounded border-border bg-panel text-accent focus:ring-accent" />
              <label htmlFor="card_active" className="text-sm font-medium">Cartão Ativo</label>
            </div>
          </div>
        );
      case 'categories':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nome</label>
              <input {...register('name')} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tipo</label>
              <select {...register('type')} className="input-field" required>
                <option value="income">Entrada</option>
                <option value="expense">Saída</option>
                <option value="investment">Investimento</option>
              </select>
            </div>
            {categoryType === 'expense' && (
              <div>
                <label className="block text-sm font-medium mb-1">Limite de Orçamento Mensal (R$ - Opcional)</label>
                <input type="number" step="0.01" {...register('limit_amount')} className="input-field" placeholder="Ex: 500.00" />
              </div>
            )}
          </div>
        );
      case 'recurring_bills':
      case 'recurring_incomes':
        const isBill = activeTab === 'recurring_bills';
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nome / Descrição</label>
              <input {...register('name')} className="input-field" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Valor</label>
                <input type="number" step="0.01" {...register('amount')} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Dia do Vencimento</label>
                <input type="number" min="1" max="31" {...register('due_day')} className="input-field" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Categoria</label>
                <select {...register('category_id')} className="input-field" required>
                  <option value="">Selecione...</option>
                  {categories.filter(c => c.type === (isBill ? 'expense' : 'income')).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{isBill ? 'Responsável' : 'Pessoa'}</label>
                <select {...register(isBill ? 'responsible_id' : 'person_id')} className="input-field" required>
                  <option value="">Selecione...</option>
                  {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            {isBill && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Método de Pagamento</label>
                  <select {...register('payment_method')} className="input-field" required>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Pix">Pix</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Cartão de Débito">Cartão de Débito</option>
                    <option value="Boleto">Boleto</option>
                  </select>
                </div>
                {paymentMethod === 'Cartão de Crédito' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Cartão de Crédito</label>
                    <select {...register('credit_card_id')} className="input-field" required>
                      <option value="">Selecione...</option>
                      {creditCards.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                    </select>
                  </div>
                )}
              </>
            )}
            {!isBill && (
              <div>
                <label className="block text-sm font-medium mb-1">Banco de Recebimento</label>
                <select {...register('bank_id')} className="input-field" required>
                  <option value="">Selecione...</option>
                  {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input type="checkbox" {...register('active')} id="active" defaultChecked className="w-4 h-4 rounded border-border bg-panel text-accent focus:ring-accent" />
              <label htmlFor="active" className="text-sm font-medium">Ativo</label>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <SidebarLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Cadastros</h1>
          <p className="text-text-secondary">Gerencie as entidades base do seu sistema</p>
        </div>

        <div className="flex overflow-x-auto pb-4 gap-2 no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all whitespace-nowrap border",
                activeTab === tab.id 
                  ? "bg-accent border-accent text-white shadow-lg shadow-accent/20" 
                  : "bg-panel border-border text-text-secondary hover:border-accent/50"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.name}
            </button>
          ))}
        </div>

        <Card>
          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3 text-red-500">
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

          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold">{tabs.find(t => t.id === activeTab)?.name}</h3>
            <button 
              onClick={() => { setEditingItem(null); reset({ active: true }); setIsModalOpen(true); }}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Novo Registro
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-text-secondary">Carregando...</div>
          ) : data.length === 0 ? (
            <div className="py-12 text-center text-text-secondary">Nenhum registro encontrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border text-sm text-text-secondary">
                    <th className="pb-4 font-medium">Nome / Descrição</th>
                    {activeTab === 'categories' && (
                      <>
                        <th className="pb-4 font-medium">Tipo</th>
                        <th className="pb-4 font-medium">Limite de Orçamento</th>
                      </>
                    )}
                    {(activeTab === 'recurring_bills' || activeTab === 'recurring_incomes') && (
                      <>
                        <th className="pb-4 font-medium">Valor</th>
                        <th className="pb-4 font-medium">Vencimento</th>
                        <th className="pb-4 font-medium">Status</th>
                      </>
                    )}
                    <th className="pb-4 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.map((item) => (
                    <tr key={item.id} className="group hover:bg-neutral-800/30 transition-colors">
                      <td className="py-4 font-medium">
                        {item.name}
                        {(activeTab === 'recurring_bills' || activeTab === 'recurring_incomes') && (
                          <p className="text-[10px] text-text-secondary uppercase mt-0.5">
                            {item.categories?.name} • {item.people?.name}
                          </p>
                        )}
                      </td>
                      {activeTab === 'categories' && (
                        <>
                          <td className="py-4 text-sm">
                            <span className={cn(
                              "px-2 py-1 rounded-md text-[10px] uppercase font-bold",
                              item.type === 'income' ? "bg-accent/10 text-accent" : 
                              item.type === 'expense' ? "bg-red-500/10 text-red-500" : 
                              "bg-blue-500/10 text-blue-500"
                            )}>
                              {item.type === 'income' ? 'Entrada' : item.type === 'expense' ? 'Saída' : 'Investimento'}
                            </span>
                          </td>
                          <td className="py-4 text-sm font-medium text-text-secondary">
                            {categoryBudgets[item.id] ? (
                              <span className="text-accent font-semibold">
                                R$ {Number(categoryBudgets[item.id]).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <span className="text-neutral-500">Sem limite</span>
                            )}
                          </td>
                        </>
                      )}
                      {(activeTab === 'recurring_bills' || activeTab === 'recurring_incomes') && (
                        <>
                          <td className="py-4 font-bold">R$ {Number(item.amount).toLocaleString('pt-BR')}</td>
                          <td className="py-4 text-sm">Dia {item.due_day}</td>
                          <td className="py-4 text-sm">
                            <span className={cn(
                              "px-2 py-1 rounded-md text-[10px] uppercase font-bold",
                              item.active ? "bg-accent/10 text-accent" : "bg-neutral-800 text-text-secondary"
                            )}>
                              {item.active ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                        </>
                      )}
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
              Tem certeza que deseja excluir este registro? Isso pode afetar lançamentos vinculados.
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
          title={editingItem ? 'Editar Registro' : 'Novo Registro'}
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {renderFormFields()}
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
