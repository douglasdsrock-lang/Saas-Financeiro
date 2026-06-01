'use client';

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { handleSupabaseError, formatDate, cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import Modal from '@/components/ui/modal';
import { Plus, Edit2, Trash2, Search, Filter, Calendar as CalendarIcon, AlertCircle, RefreshCcw, CreditCard, Upload, Check, AlertTriangle, Info, TrendingDown } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import SidebarLayout from '@/components/sidebar-layout';

export default function SaidasPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'credit_card' | 'other'>('credit_card');
  const refMonthRef = useRef<HTMLInputElement>(null);
  const [filters, setFilters] = useState({
    startDate: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    category: '',
    search: '',
    payment_method: '',
    credit_card_id: ''
  });
  
  const [people, setPeople] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [creditCards, setCreditCards] = useState<any[]>([]);

  // Reference month for credit card cycles (defaults to current month: YYYY-MM)
  const [referenceMonth, setReferenceMonth] = useState(format(new Date(), 'yyyy-MM'));

  // Bulk Selection States
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);

  // Budget calculations state
  const [monthlyExpenses, setMonthlyExpenses] = useState<any[]>([]);
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, number>>({});

  // OFX Import States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState<'upload' | 'preview'>('upload');
  const [parsedTransactions, setParsedTransactions] = useState<any[]>([]);
  const [importConfig, setImportConfig] = useState({
    payment_method: 'Pix',
    credit_card_id: '',
    default_person_id: ''
  });
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const { register, handleSubmit, reset, setValue, watch } = useForm();
  const paymentMethod = watch('payment_method');

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const getCardCycle = (card: any, refMonthStr: string) => {
    if (!card) return { start: '', end: '', due: '' };
    
    let year = new Date().getFullYear();
    let month = new Date().getMonth(); // 0-indexed
    
    const safeRefMonth = refMonthStr || format(new Date(), 'yyyy-MM');
    if (safeRefMonth && safeRefMonth.includes('-')) {
      const [yearStr, monthStr] = safeRefMonth.split('-');
      const parsedYear = parseInt(yearStr);
      const parsedMonth = parseInt(monthStr) - 1;
      if (!isNaN(parsedYear) && !isNaN(parsedMonth)) {
        year = parsedYear;
        month = parsedMonth;
      }
    }
    
    const dueDay = Number(card.due_day) || 10;
    const closingDay = Number(card.closing_day) || (dueDay > 7 ? dueDay - 7 : 1);
    
    // End of cycle: closing day of the current month
    const cycleEnd = new Date(year, month, closingDay, 23, 59, 59);
    // Start of cycle: closing day + 1 of the previous month
    const cycleStart = new Date(year, month, closingDay + 1, 0, 0, 0);
    cycleStart.setMonth(cycleStart.getMonth() - 1);
    
    try {
      const due = new Date(year, month, dueDay);
      
      // Ensure we don't pass an Invalid Date to format
      if (isNaN(cycleStart.getTime()) || isNaN(cycleEnd.getTime()) || isNaN(due.getTime())) {
        throw new Error('Calculated date is invalid');
      }
      
      return {
        start: format(cycleStart, 'yyyy-MM-dd'),
        end: format(cycleEnd, 'yyyy-MM-dd'),
        due: format(due, 'yyyy-MM-dd')
      };
    } catch (e) {
      console.error('Error formatting cycle dates:', e);
      const fallbackStart = startOfMonth(new Date(year, month, 1));
      const fallbackEnd = endOfMonth(new Date(year, month, 1));
      return {
        start: format(fallbackStart, 'yyyy-MM-dd'),
        end: format(fallbackEnd, 'yyyy-MM-dd'),
        due: format(fallbackEnd, 'yyyy-MM-dd')
      };
    }
  };

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

      const [p, c, cc, budgetsData] = await Promise.all([
        fetchTable('people', supabase.from('people').select('*').eq('user_id', user.id)),
        fetchTable('categories', supabase.from('categories').select('*').eq('type', 'expense').eq('user_id', user.id)),
        fetchTable('credit_cards', supabase.from('credit_cards').select('*').eq('user_id', user.id)),
        fetchTable('category_budgets', supabase.from('category_budgets').select('*').eq('user_id', user.id))
      ]);

      setPeople(p);
      setCategories(c);
      setCreditCards(cc);

      const budgetsMap: Record<string, number> = {};
      budgetsData.forEach((item: any) => {
        budgetsMap[item.category_id] = Number(item.limit_amount);
      });
      setCategoryBudgets(budgetsMap);
    } catch (error) {
      console.error('Error fetching helpers:', error);
    }
  }, []);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelectedExpenseIds([]);
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
      if (filters.credit_card_id) query = query.eq('credit_card_id', filters.credit_card_id);
      
      let startQueryDate = filters.startDate;
      let endQueryDate = filters.endDate;

      if (activeTab === 'credit_card' && filters.credit_card_id) {
        const selectedCard = creditCards.find(cc => cc.id === filters.credit_card_id);
        if (selectedCard) {
          const cycle = getCardCycle(selectedCard, referenceMonth);
          startQueryDate = cycle.start;
          endQueryDate = cycle.end;
        }
      }

      if (startQueryDate && endQueryDate) {
        query = query.gte('date', startQueryDate).lte('date', endQueryDate);
      }
      
      if (activeTab === 'credit_card') {
        query = query.eq('payment_method', 'Cartão de Crédito');
      } else {
        query = query.neq('payment_method', 'Cartão de Crédito');
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
  }, [filters, activeTab, referenceMonth, creditCards]);

  const fetchMonthlyExpenses = React.useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      const startOfMonth = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd') + 'T00:00:00';
      const endOfMonth = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd') + 'T23:59:59';

      const { data, error } = await supabase
        .from('expenses')
        .select('amount, category_id')
        .eq('user_id', user.id)
        .gte('date', startOfMonth)
        .lte('date', endOfMonth);

      if (error) throw error;
      setMonthlyExpenses(data || []);
    } catch (e) {
      console.error('Error fetching monthly expenses for budget:', e);
    }
  }, []);

  const handleBulkMarkPaid = async () => {
    try {
      const { error } = await supabase
        .from('expenses')
        .update({ status: 'paid' })
        .in('id', selectedExpenseIds);
      if (error) throw error;
      setSelectedExpenseIds([]);
      await fetchData();
      alert('Despesas marcadas como pagas com sucesso!');
    } catch (err: any) {
      console.error('Error bulk updating expenses:', err);
      alert(`Erro ao atualizar despesas: ${err.message}`);
    }
  };

  const handleBulkDelete = async () => {
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .in('id', selectedExpenseIds);
      if (error) throw error;
      setSelectedExpenseIds([]);
      setIsBulkDeleteConfirmOpen(false);
      await fetchData();
      alert('Despesas excluídas com sucesso!');
    } catch (err: any) {
      console.error('Error bulk deleting expenses:', err);
      alert(`Erro ao excluir despesas: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchHelpers();
  }, [fetchHelpers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchMonthlyExpenses();
  }, [data, fetchMonthlyExpenses]);



  const parseOFX = (text: string) => {
    const transactions: any[] = [];
    const blocks = text.split(/<STMTTRN>/i);
    
    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i].split(/<\/STMTTRN>/i)[0];
      
      const trnamt = block.match(/<TRNAMT>([^<\r\n]+)/i)?.[1]?.trim();
      const dtposted = block.match(/<DTPOSTED>([^<\r\n]+)/i)?.[1]?.trim();
      const fitid = block.match(/<FITID>([^<\r\n]+)/i)?.[1]?.trim() || '';
      const memo = block.match(/<MEMO>([^<\r\n]+)/i)?.[1]?.trim() || '';
      const name = block.match(/<NAME>([^<\r\n]+)/i)?.[1]?.trim() || '';
      
      const description = memo || name || 'Despesa OFX';
      const amountVal = parseFloat(trnamt || '0');
      
      // In OFX, debits are negative. We import only debits.
      if (amountVal < 0) {
        const amount = Math.abs(amountVal);
        let dateStr = format(new Date(), 'yyyy-MM-dd');
        if (dtposted && dtposted.length >= 8) {
          const year = dtposted.substring(0, 4);
          const month = dtposted.substring(4, 6);
          const day = dtposted.substring(6, 8);
          dateStr = `${year}-${month}-${day}`;
        }
        
        transactions.push({
          fitid,
          description,
          amount,
          date: dateStr
        });
      }
    }
    return transactions;
  };

  const processOFXFile = async (file: File) => {
    setImportError(null);
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = parseOFX(text);
      if (parsed.length === 0) {
        throw new Error('Nenhuma transação de saída (débito) encontrada no arquivo OFX.');
      }
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error('Usuário não autenticado.');
      
      const dates = parsed.map(t => t.date);
      const minDate = dates.reduce((a, b) => a < b ? a : b);
      const maxDate = dates.reduce((a, b) => a > b ? a : b);
      
      // Fetch existing expenses in date range
      const { data: existingExpenses, error: existingError } = await supabase
        .from('expenses')
        .select('date, amount, description')
        .eq('user_id', user.id)
        .gte('date', `${minDate}T00:00:00`)
        .lte('date', `${maxDate}T23:59:59`);
        
      if (existingError) throw existingError;
      
      // Fetch last 100 expenses for category suggestions
      const { data: lastExpenses } = await supabase
        .from('expenses')
        .select('description, category_id')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(100);
        
      // Map check status, duplicates, and category suggestions
      const enriched = parsed.map(trx => {
        const isDuplicate = (existingExpenses || []).some((exp: any) => {
          const expDateStr = exp.date.split('T')[0];
          const sameDate = expDateStr === trx.date;
          const sameAmount = Math.abs(Number(exp.amount) - trx.amount) < 0.01;
          const sameDesc = exp.description.toLowerCase().includes(trx.description.toLowerCase()) || 
                           trx.description.toLowerCase().includes(exp.description.toLowerCase());
          return sameDate && sameAmount && sameDesc;
        });
        
        const matchedExpense = lastExpenses?.find((exp: any) => 
          exp.description.toLowerCase().includes(trx.description.toLowerCase()) ||
          trx.description.toLowerCase().includes(exp.description.toLowerCase())
        );
        const category_id = matchedExpense ? matchedExpense.category_id : '';
        
        return {
          ...trx,
          checked: !isDuplicate,
          isDuplicate,
          category_id,
          person_id: people[0]?.id || ''
        };
      });
      
      setParsedTransactions(enriched);
      setImportStep('preview');
      
      setImportConfig({
        payment_method: activeTab === 'credit_card' ? 'Cartão de Crédito' : 'Pix',
        credit_card_id: filters.credit_card_id || (creditCards[0]?.id || ''),
        default_person_id: people[0]?.id || ''
      });
    } catch (err: any) {
      console.error('Error processing OFX:', err);
      setImportError(err.message || 'Erro ao processar o arquivo OFX.');
    } finally {
      setImporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processOFXFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.toLowerCase().endsWith('.ofx')) {
      processOFXFile(file);
    } else {
      setImportError('Por favor, envie um arquivo com extensão .ofx');
    }
  };

  const handleConfirmImport = async () => {
    const itemsToImport = parsedTransactions.filter(t => t.checked);
    if (itemsToImport.length === 0) {
      alert('Nenhuma transação selecionada para importação.');
      return;
    }
    
    const missingCategory = itemsToImport.some(t => !t.category_id);
    if (missingCategory) {
      alert('Por favor, selecione a categoria para todas as transações marcadas.');
      return;
    }
    
    setImporting(true);
    setImportError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado.');
      
      const payloads = itemsToImport.map(t => ({
        description: t.description,
        amount: Number(t.amount),
        date: `${t.date}T12:00:00`,
        category_id: t.category_id,
        person_id: t.person_id || importConfig.default_person_id,
        payment_method: importConfig.payment_method,
        credit_card_id: importConfig.payment_method === 'Cartão de Crédito' ? importConfig.credit_card_id : null,
        is_fixed: false,
        status: 'paid' as 'paid',
        notes: `[OFX Import]${t.fitid ? ' FITID: ' + t.fitid : ''}`,
        user_id: user.id
      }));
      
      const { error } = await supabase.from('expenses').insert(payloads);
      if (error) throw error;
      
      setIsImportModalOpen(false);
      setParsedTransactions([]);
      setImportStep('upload');
      await fetchData();
      alert(`${payloads.length} transações importadas com sucesso!`);
    } catch (err: any) {
      console.error('Error importing:', err);
      setImportError(err.message || 'Erro ao realizar a importação no banco de dados.');
    } finally {
      setImporting(false);
    }
  };

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
          status: formData.status || 'paid',
          notes: formData.notes || null,
          user_id: user.id
        };
        const { error } = await supabase.from('expenses').update(payload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        // Create multiple expenses if it's an installment purchase
        const payloads = [];
        let recurringBillId = null;

        // If it's a fixed expense, create a recurring_bill template first
        if (formData.is_fixed) {
          const { data: rbData, error: rbError } = await supabase.from('recurring_bills').insert([{
            name: formData.description,
            amount: amountPerInstallment,
            due_day: baseDate.getDate(),
            category_id: formData.category_id,
            responsible_id: formData.person_id,
            payment_method: formData.payment_method,
            credit_card_id: formData.payment_method === 'Cartão de Crédito' ? formData.credit_card_id : null,
            active: true,
            user_id: user.id
          }]).select();

          if (rbError) {
            console.error('Error creating recurring bill:', rbError);
          } else if (rbData && rbData[0]) {
            recurringBillId = rbData[0].id;
          }
        }

        for (let i = 0; i < installmentsCount; i++) {
          const installmentDate = new Date(baseDate);
          installmentDate.setMonth(baseDate.getMonth() + i);
          
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
            recurring_bill_id: recurringBillId,
            status: formData.status || 'paid',
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

  const activeBudgets = categories
    .filter(c => categoryBudgets[c.id] !== undefined)
    .map(c => {
      const limit = categoryBudgets[c.id];
      const spent = monthlyExpenses
        .filter(e => e.category_id === c.id)
        .reduce((sum, e) => sum + Number(e.amount), 0);
      const percent = limit > 0 ? (spent / limit) * 100 : 0;
      
      return {
        id: c.id,
        name: c.name,
        limit,
        spent,
        percent
      };
    });

  return (
    <SidebarLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Saídas</h1>
            <p className="text-text-secondary">Gestão de gastos, despesas e pagamentos</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setImportStep('upload');
                setParsedTransactions([]);
                setImportError(null);
                setIsImportModalOpen(true);
              }}
              className="btn-secondary flex items-center gap-2"
            >
              <Upload className="w-4 h-4" /> Importar OFX
            </button>
            <button 
              onClick={() => { setEditingItem(null); reset(); setIsModalOpen(true); }}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Nova Saída
            </button>
          </div>
        </div>

        <div className="flex border-b border-border gap-6">
          <button
            onClick={() => setActiveTab('credit_card')}
            className={`pb-4 text-sm font-medium transition-colors relative ${activeTab === 'credit_card' ? 'text-accent font-semibold' : 'text-text-secondary hover:text-text'}`}
          >
            Cartão de Crédito
            {activeTab === 'credit_card' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('other')}
            className={`pb-4 text-sm font-medium transition-colors relative ${activeTab === 'other' ? 'text-accent font-semibold' : 'text-text-secondary hover:text-text'}`}
          >
            Outros Gastos
            {activeTab === 'other' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
            )}
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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 space-y-6">
            <div className="backdrop-blur-xl bg-panel/30 border border-white/[0.04] p-4 rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] flex flex-wrap gap-4 items-center">
              {activeTab === 'other' ? (
                <>
                  <div className="flex items-center gap-2">
                    <input 
                      type="date" 
                      value={filters.startDate}
                      onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                      onClick={(e) => e.currentTarget.showPicker()}
                      className="bg-panel/30 border border-white/[0.04] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40 transition-all cursor-pointer"
                    />
                    <span className="text-text-secondary text-sm font-semibold">até</span>
                    <input 
                      type="date" 
                      value={filters.endDate}
                      onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                      onClick={(e) => e.currentTarget.showPicker()}
                      className="bg-panel/30 border border-white/[0.04] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40 transition-all cursor-pointer"
                    />
                  </div>
                </>
              ) : (
                <>
                  <select 
                    value={filters.credit_card_id}
                    onChange={(e) => setFilters({...filters, credit_card_id: e.target.value})}
                    className="bg-panel/30 border border-white/[0.04] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40 transition-all cursor-pointer min-w-[180px]"
                  >
                    <option value="" className="bg-[#0c0c10] text-white">Todos os Cartões</option>
                    {creditCards.map(cc => <option key={cc.id} value={cc.id} className="bg-[#0c0c10] text-white">{cc.name}</option>)}
                  </select>

                  {filters.credit_card_id ? (
                    <div className="relative group">
                      <div 
                        onClick={() => refMonthRef.current?.showPicker()}
                        className="flex items-center justify-center w-10 h-10 rounded-xl border border-white/[0.04] text-text-secondary hover:border-accent/40 hover:text-white bg-panel/30 transition-all cursor-pointer"
                      >
                        <CalendarIcon className="w-5 h-5" />
                        <input 
                          ref={refMonthRef}
                          type="month" 
                          value={referenceMonth}
                          onChange={(e) => setReferenceMonth(e.target.value)}
                          onClick={(e) => e.stopPropagation()} // Prevent double trigger
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          title="Mês de Referência da Fatura"
                        />
                      </div>
                      {referenceMonth && (
                        <div className="absolute -top-2 -right-2 bg-accent text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase">
                          {referenceMonth.split('-')[1]}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input 
                        type="date" 
                        value={filters.startDate}
                        onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                        onClick={(e) => e.currentTarget.showPicker()}
                        className="bg-panel/30 border border-white/[0.04] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40 transition-all cursor-pointer"
                        title="Data Início"
                      />
                      <span className="text-text-secondary text-sm font-semibold">até</span>
                      <input 
                        type="date" 
                        value={filters.endDate}
                        onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                        onClick={(e) => e.currentTarget.showPicker()}
                        className="bg-panel/30 border border-white/[0.04] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40 transition-all cursor-pointer"
                        title="Data Fim"
                      />
                    </div>
                  )}
                </>
              )}

              <div className="flex-1 min-w-[200px] relative">
                <input 
                  type="text"
                  placeholder="Pesquisar descrição..."
                  value={filters.search}
                  onChange={(e) => setFilters({...filters, search: e.target.value})}
                  className="bg-panel/30 border border-white/[0.04] rounded-xl pl-10 pr-4 h-10 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-accent/40 transition-all w-full"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none">
                  <Search className="w-4 h-4" />
                </div>
              </div>

              <select 
                value={filters.category}
                onChange={(e) => setFilters({...filters, category: e.target.value})}
                className="bg-panel/30 border border-white/[0.04] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40 transition-all cursor-pointer min-w-[150px]"
              >
                <option value="" className="bg-[#0c0c10] text-white">Todas Categorias</option>
                {categories.map(c => <option key={c.id} value={c.id} className="bg-[#0c0c10] text-white">{c.name}</option>)}
              </select>

              {activeTab === 'other' && (
                <select 
                  value={filters.payment_method}
                  onChange={(e) => setFilters({...filters, payment_method: e.target.value})}
                  className="bg-panel/30 border border-white/[0.04] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40 transition-all cursor-pointer min-w-[140px]"
                >
                  <option value="" className="bg-[#0c0c10] text-white">Todos Métodos</option>
                  <option value="Dinheiro" className="bg-[#0c0c10] text-white">Dinheiro</option>
                  <option value="Pix" className="bg-[#0c0c10] text-white">Pix</option>
                  <option value="Cartão de Débito" className="bg-[#0c0c10] text-white">Cartão de Débito</option>
                  <option value="Boleto" className="bg-[#0c0c10] text-white">Boleto</option>
                </select>
              )}

              <button 
                onClick={() => {
                  setFilters({
                    startDate: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'),
                    endDate: format(new Date(), 'yyyy-MM-dd'),
                    category: '',
                    search: '',
                    payment_method: '',
                    credit_card_id: creditCards[0]?.id || ''
                  });
                  setReferenceMonth(format(new Date(), 'yyyy-MM'));
                }}
                className="text-xs text-text-secondary hover:text-accent font-semibold transition-colors cursor-pointer"
              >
                Limpar
              </button>

              <div className="w-full md:w-auto text-center md:ml-auto text-red-500 font-black px-4 py-2 bg-red-500/10 border border-red-500/10 rounded-2xl font-display text-sm tracking-wide shadow-[0_0_15px_-3px_rgba(239,68,68,0.1)]">
                Total: R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>

            {activeTab === 'credit_card' && filters.credit_card_id && (() => {
              const card = creditCards.find(cc => cc.id === filters.credit_card_id);
              if (!card) return null;
              
              const safeRefMonth = referenceMonth || format(new Date(), 'yyyy-MM');
              const cycle = getCardCycle(card, safeRefMonth);
              const startFormatted = formatDate(cycle.start);
              const endFormatted = formatDate(cycle.end);
              const dueFormatted = formatDate(cycle.due);
              
              let yearStr = String(new Date().getFullYear());
              let monthStr = String(new Date().getMonth() + 1);
              if (safeRefMonth && safeRefMonth.includes('-')) {
                const parts = safeRefMonth.split('-');
                yearStr = parts[0];
                monthStr = parts[1];
              }
              
              const yearNum = Number(yearStr) || new Date().getFullYear();
              const monthNum = Number(monthStr) || (new Date().getMonth() + 1);
              
              let capitalizedMonth = '';
              try {
                const monthName = new Date(yearNum, monthNum - 1, 1).toLocaleString('pt-BR', { month: 'long' });
                capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
              } catch (e) {
                capitalizedMonth = 'Mês';
              }
              const refText = `${capitalizedMonth} de ${yearNum}`;
              
              return (
                <div className="bg-neutral-900/40 border border-border/80 backdrop-blur-md p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-lg">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-accent/10 text-accent rounded-xl">
                      <CreditCard className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-text text-base">{card.name}</h3>
                      <p className="text-sm text-text-secondary">Fatura com referência em {refText}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:flex md:items-center gap-6 text-sm">
                    <div>
                      <p className="text-text-secondary text-[11px] uppercase tracking-wider font-bold">Período de Compras</p>
                      <p className="font-medium text-text mt-0.5">{startFormatted} a {endFormatted}</p>
                    </div>
                    <div>
                      <p className="text-text-secondary text-[11px] uppercase tracking-wider font-bold">Vencimento da Fatura</p>
                      <p className="font-semibold text-accent mt-0.5">{dueFormatted}</p>
                    </div>
                    <div className="border-t border-border pt-4 md:border-t-0 md:pt-0 md:border-l md:pl-6">
                      <p className="text-text-secondary text-[11px] uppercase tracking-wider font-bold">Total da Fatura</p>
                      <p className="font-black text-red-500 text-lg mt-0.5">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            <Card className="relative overflow-hidden">
              {loading && data.length > 0 && (
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-accent/20 overflow-hidden z-20">
                  <div className="h-full bg-accent animate-pulse w-full" />
                </div>
              )}
              
              {loading && data.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-text-secondary">
                  <RefreshCcw className="w-6 h-6 text-accent animate-spin" />
                  <p className="font-medium text-sm">Carregando despesas...</p>
                </div>
              ) : data.length === 0 ? (
                <div className="py-12 text-center text-text-secondary">Nenhum registro encontrado.</div>
              ) : (
                <>
                  {/* Desktop View */}
                  <div className="hidden md:block overflow-x-auto relative">
                    {loading && (
                      <div className="absolute inset-0 bg-background/25 backdrop-blur-[1px] flex items-center justify-center z-10 transition-all duration-300">
                        <div className="bg-panel/85 backdrop-blur-md border border-white/[0.04] p-3 rounded-2xl shadow-xl flex items-center gap-2">
                          <RefreshCcw className="w-4 h-4 text-accent animate-spin" />
                          <span className="text-xs text-text-secondary font-medium">Atualizando...</span>
                        </div>
                      </div>
                    )}
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-white/[0.04] text-sm text-text-secondary">
                          <th className="pb-4 w-10">
                            <input 
                              type="checkbox"
                              checked={data.length > 0 && selectedExpenseIds.length === data.length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedExpenseIds(data.map(item => item.id));
                                } else {
                                  setSelectedExpenseIds([]);
                                }
                              }}
                              className="checkbox-custom"
                            />
                          </th>
                          <th className="pb-4 font-medium">Data</th>
                          <th className="pb-4 font-medium">Descrição</th>
                          <th className="pb-4 font-medium">Categoria</th>
                          <th className="pb-4 font-medium">Método</th>
                          <th className="pb-4 font-medium">Status</th>
                          <th className="pb-4 font-medium">Valor</th>
                          <th className="pb-4 font-medium text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {data.map((item) => (
                          <tr key={item.id} className="group hover:bg-white/[0.01] transition-colors">
                            <td className="py-4">
                              <input 
                                type="checkbox"
                                checked={selectedExpenseIds.includes(item.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedExpenseIds(prev => [...prev, item.id]);
                                  } else {
                                    setSelectedExpenseIds(prev => prev.filter(id => id !== item.id));
                                  }
                                }}
                                className="checkbox-custom"
                              />
                            </td>
                            <td className="py-4 text-sm text-text-secondary whitespace-nowrap">
                              {formatDate(item.date)}
                            </td>
                            <td className="py-4 font-medium text-white">
                              <div className="flex items-center gap-2">
                                {item.description}
                                {item.is_fixed && <span className="text-[8px] bg-white/[0.04] text-text-secondary border border-white/[0.04] px-1.5 py-0.5 rounded font-black uppercase tracking-wider">Fixo</span>}
                              </div>
                            </td>
                            <td className="py-4 text-sm">
                              <span className="px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/10 text-red-400 text-[10px] uppercase font-bold tracking-wider">
                                {item.categories?.name}
                              </span>
                            </td>
                            <td className="py-4 text-sm text-text-secondary whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                {item.payment_method === 'Cartão de Crédito' && <CreditCard className="w-3.5 h-3.5" />}
                                {item.payment_method}
                                {item.credit_cards?.name && <span className="text-[10px] text-accent">({item.credit_cards.name})</span>}
                              </div>
                            </td>
                            <td className="py-4 text-sm">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${item.status === 'pending' ? 'bg-yellow-500/10 border border-yellow-500/10 text-yellow-500' : 'bg-accent/10 border border-accent/10 text-accent'}`}>
                                {item.status === 'pending' ? 'Pendente' : 'Pago'}
                              </span>
                            </td>
                            <td className="py-4 font-bold text-red-500">R$ {Number(item.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            <td className="py-4 text-right">
                              <div className="flex items-center justify-end gap-2 opacity-60 hover:opacity-100 transition-opacity">
                                <button onClick={() => openEdit(item)} className="p-2 hover:bg-white/[0.05] rounded-xl text-text-secondary hover:text-white transition-colors cursor-pointer">
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => setDeleteConfirmId(item.id)} className="p-2 hover:bg-red-500/10 rounded-xl text-red-400 hover:text-red-500 transition-colors cursor-pointer">
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
                  <div className="md:hidden space-y-4 relative">
                    {loading && (
                      <div className="absolute inset-x-0 -top-2 flex items-center justify-center z-10 transition-all duration-300">
                        <div className="bg-panel/90 backdrop-blur-md border border-white/[0.04] p-2.5 px-4 rounded-full shadow-xl flex items-center gap-2">
                          <RefreshCcw className="w-3.5 h-3.5 text-accent animate-spin" />
                          <span className="text-[11px] text-text-secondary font-medium">Atualizando...</span>
                        </div>
                      </div>
                    )}
                    {data.map((item) => (
                      <div key={item.id} className="p-4 bg-[#12121a]/40 border border-white/[0.04] rounded-2xl flex flex-col gap-3 relative overflow-hidden transition-all duration-300 hover:border-red-500/10">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <input 
                              type="checkbox"
                              checked={selectedExpenseIds.includes(item.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedExpenseIds(prev => [...prev, item.id]);
                                } else {
                                  setSelectedExpenseIds(prev => prev.filter(id => id !== item.id));
                                }
                              }}
                              className="checkbox-custom shrink-0"
                            />
                            <div className="w-9 h-9 bg-red-500/10 rounded-xl flex items-center justify-center text-red-500 shrink-0">
                              <TrendingDown className="w-4.5 h-4.5" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="font-bold text-white text-sm truncate">{item.description}</p>
                                {item.is_fixed && (
                                  <span className="text-[7px] bg-white/[0.04] text-text-secondary border border-white/[0.04] px-1 py-0.5 rounded font-black uppercase tracking-wider">Fixo</span>
                                )}
                              </div>
                              <p className="text-[10px] text-text-secondary mt-0.5">{formatDate(item.date)}</p>
                            </div>
                          </div>
                          <div className="text-right flex flex-col items-end">
                            <p className="font-black text-red-500 text-base">R$ {Number(item.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            <span className={`px-2 py-0.5 mt-1 rounded text-[8px] font-bold uppercase tracking-wider ${item.status === 'pending' ? 'bg-yellow-500/10 border border-yellow-500/10 text-yellow-500' : 'bg-accent/10 border border-accent/10 text-accent'}`}>
                              {item.status === 'pending' ? 'Pendente' : 'Pago'}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between pt-2.5 border-t border-white/[0.04] gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/10 text-red-400 text-[9px] uppercase font-bold tracking-wider">
                              {item.categories?.name}
                            </span>
                            <span className="text-[9px] text-text-secondary bg-white/[0.02] border border-white/[0.04] px-1.5 py-0.5 rounded-md flex items-center gap-1">
                              {item.payment_method === 'Cartão de Crédito' && <CreditCard className="w-2.5 h-2.5 text-accent" />}
                              <span>{item.payment_method}</span>
                              {item.credit_cards?.name && <span className="text-accent font-semibold">({item.credit_cards.name})</span>}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 ml-auto">
                            {item.status === 'pending' && (
                              <button 
                                onClick={() => handleConfirmExpensePayment(item.id)} 
                                className="p-2 hover:bg-green-500/10 rounded-xl text-green-500"
                                title="Confirmar Pagamento"
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
          </div>

          <div className="lg:col-span-1 space-y-6">
            <Card className="p-6 space-y-6 bg-panel border border-border shadow-sm">
              <div>
                <h3 className="font-bold text-lg text-text">Orçamentos Mensais</h3>
                <p className="text-xs text-text-secondary mt-1">Consumo do orçamento no mês atual</p>
              </div>
              
              {activeBudgets.length === 0 ? (
                <p className="text-xs text-text-secondary text-center py-6 leading-relaxed">
                  Nenhum limite de orçamento configurado. Configure limites na aba de <strong>Categorias</strong> em <strong>Cadastros</strong>.
                </p>
              ) : (
                <div className="space-y-4">
                  {activeBudgets.map((b) => {
                    let progressColor = "bg-green-500";
                    if (b.percent >= 90) {
                      progressColor = "bg-red-500";
                    } else if (b.percent >= 70) {
                      progressColor = "bg-amber-500";
                    }
                    
                    return (
                      <div key={b.id} className="space-y-2">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-text">{b.name}</span>
                          <span className={cn(
                            "font-bold",
                            b.percent >= 90 ? "text-red-500" : b.percent >= 70 ? "text-amber-500" : "text-green-500"
                          )}>
                            {b.percent.toFixed(0)}%
                          </span>
                        </div>
                        
                        <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
                          <div 
                            className={cn("h-full rounded-full transition-all duration-500", progressColor)}
                            style={{ width: `${Math.min(b.percent, 100)}%` }}
                          />
                        </div>
                        
                        <div className="flex justify-between text-[10px] text-text-secondary">
                          <span>R$ {b.spent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          <span>LMT: R$ {b.limit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>

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

        {/* Bulk Delete Confirmation Modal */}
        <Modal 
          isOpen={isBulkDeleteConfirmOpen} 
          onClose={() => setIsBulkDeleteConfirmOpen(false)} 
          title="Confirmar Exclusão em Massa"
        >
          <div className="space-y-6">
            <p className="text-text-secondary text-center">
              Tem certeza que deseja excluir as <strong>{selectedExpenseIds.length}</strong> despesas selecionadas? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-4">
              <button onClick={() => setIsBulkDeleteConfirmOpen(false)} className="flex-1 btn-secondary">Cancelar</button>
              <button onClick={handleBulkDelete} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl">Excluir Todas</button>
            </div>
          </div>
        </Modal>

        {selectedExpenseIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-neutral-950/80 backdrop-blur-xl border border-border/80 px-6 py-4 rounded-2xl flex items-center gap-6 shadow-2xl animate-fade-in-up">
            <span className="text-sm font-semibold text-text">
              {selectedExpenseIds.length} {selectedExpenseIds.length === 1 ? 'item selecionado' : 'itens selecionados'}
            </span>
            <div className="flex gap-2">
              <button 
                onClick={handleBulkMarkPaid}
                className="px-4 py-2 bg-accent/20 hover:bg-accent/30 text-accent font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 border border-accent/30"
              >
                <Check className="w-3.5 h-3.5" /> Marcar Pago
              </button>
              <button 
                onClick={() => setIsBulkDeleteConfirmOpen(true)}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-500 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 border border-red-500/30"
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir
              </button>
              <button 
                onClick={() => setSelectedExpenseIds([])}
                className="px-3 py-2 hover:bg-neutral-800 text-text-secondary hover:text-text font-bold rounded-xl text-xs transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

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
              {paymentMethod !== '' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Já foi pago?</label>
                  <select {...register('status')} className="input-field" defaultValue="paid">
                    <option value="paid">Sim (Pago)</option>
                    <option value="pending">Não (Pendente)</option>
                  </select>
                </div>
              )}
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

        {/* OFX Import Modal */}
        <Modal 
          isOpen={isImportModalOpen} 
          onClose={() => setIsImportModalOpen(false)} 
          title="Importar Extrato OFX"
          maxWidth="max-w-4xl"
        >
          {importStep === 'upload' && (
            <div className="space-y-6">
              <div 
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="border border-dashed border-white/[0.08] hover:border-accent/40 rounded-3xl p-12 text-center transition-all duration-300 cursor-pointer relative group bg-panel/10 hover:bg-accent/[0.01]"
              >
                <input 
                  type="file" 
                  accept=".ofx" 
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 bg-white/[0.02] border border-white/[0.04] rounded-2xl group-hover:bg-accent/10 group-hover:border-accent/20 group-hover:text-accent transition-all duration-300">
                    <Upload className="w-8 h-8 text-text-secondary group-hover:text-accent transition-transform group-hover:-translate-y-0.5 duration-300" />
                  </div>
                  <div>
                    <p className="font-semibold text-text text-base">Arraste seu arquivo .ofx aqui</p>
                    <p className="text-xs text-text-secondary mt-1">ou clique para procurar em seu computador</p>
                  </div>
                </div>
              </div>
              
              {importError && (
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p>{importError}</p>
                </div>
              )}
              
              {importing && (
                <div className="text-center py-4 text-sm text-text-secondary flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  Processando arquivo OFX...
                </div>
              )}
            </div>
          )}

          {importStep === 'preview' && (
            <div className="space-y-6">
              {/* Configuration panel */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-panel/20 border border-white/[0.04] p-5 rounded-2xl">
                <div>
                  <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Método Padrão</label>
                  <select 
                    value={importConfig.payment_method}
                    onChange={(e) => setImportConfig({ ...importConfig, payment_method: e.target.value })}
                    className="bg-panel/30 border border-white/[0.04] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-accent/40 transition-all cursor-pointer h-9 w-full"
                  >
                    <option value="Dinheiro" className="bg-[#0c0c10] text-white">Dinheiro</option>
                    <option value="Pix" className="bg-[#0c0c10] text-white">Pix</option>
                    <option value="Cartão de Crédito" className="bg-[#0c0c10] text-white">Cartão de Crédito</option>
                    <option value="Cartão de Débito" className="bg-[#0c0c10] text-white">Cartão de Débito</option>
                    <option value="Boleto" className="bg-[#0c0c10] text-white">Boleto</option>
                  </select>
                </div>
                
                {importConfig.payment_method === 'Cartão de Crédito' && (
                  <div>
                    <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Cartão de Crédito</label>
                    <select 
                      value={importConfig.credit_card_id}
                      onChange={(e) => setImportConfig({ ...importConfig, credit_card_id: e.target.value })}
                      className="bg-panel/30 border border-white/[0.04] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-accent/40 transition-all cursor-pointer h-9 w-full"
                    >
                      <option value="" className="bg-[#0c0c10] text-white">Selecione...</option>
                      {creditCards.map(cc => <option key={cc.id} value={cc.id} className="bg-[#0c0c10] text-white">{cc.name}</option>)}
                    </select>
                  </div>
                )}
                
                <div>
                  <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Pessoa Padrão</label>
                  <select 
                    value={importConfig.default_person_id}
                    onChange={(e) => setImportConfig({ ...importConfig, default_person_id: e.target.value })}
                    className="bg-panel/30 border border-white/[0.04] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-accent/40 transition-all cursor-pointer h-9 w-full"
                  >
                    <option value="" className="bg-[#0c0c10] text-white">Selecione...</option>
                    {people.map(p => <option key={p.id} value={p.id} className="bg-[#0c0c10] text-white">{p.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Transactions Preview Table */}
              <div className="max-h-[350px] overflow-y-auto border border-white/[0.04] rounded-2xl bg-panel/10 backdrop-blur-md">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-panel/90 backdrop-blur-md border-b border-white/[0.04] z-10">
                    <tr className="text-text-secondary font-bold">
                      <th className="p-4 w-8">
                        <input 
                          type="checkbox"
                          checked={parsedTransactions.length > 0 && parsedTransactions.every(t => t.checked)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setParsedTransactions(parsedTransactions.map(t => ({ ...t, checked })));
                          }}
                          className="checkbox-custom"
                        />
                      </th>
                      <th className="p-4 w-20">Data</th>
                      <th className="p-4">Descrição</th>
                      <th className="p-4 w-24 font-bold text-right">Valor</th>
                      <th className="p-4 w-40">Categoria</th>
                      <th className="p-4 w-32">Pessoa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.02]">
                    {parsedTransactions.map((trx, index) => (
                      <tr 
                        key={index} 
                        className={`hover:bg-white/[0.01] transition-colors border-b border-white/[0.02] last:border-0 ${
                          trx.isDuplicate ? 'bg-amber-500/[0.03] border-l-2 border-l-amber-500/50' : ''
                        }`}
                      >
                        <td className="p-4">
                          <input 
                            type="checkbox"
                            checked={trx.checked}
                            onChange={(e) => {
                              const updated = [...parsedTransactions];
                              updated[index].checked = e.target.checked;
                              setParsedTransactions(updated);
                            }}
                            className="checkbox-custom"
                          />
                        </td>
                        <td className="p-4 text-text-secondary whitespace-nowrap">
                          {formatDate(trx.date)}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-white">{trx.description}</span>
                            {trx.isDuplicate && (
                              <span className="inline-flex items-center gap-1 text-[9px] text-amber-400 font-black uppercase tracking-wider mt-0.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Já Importado / Duplicado
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-right font-semibold text-red-500 whitespace-nowrap">
                          R$ {trx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4">
                          <select 
                            value={trx.category_id}
                            onChange={(e) => {
                              const updated = [...parsedTransactions];
                              updated[index].category_id = e.target.value;
                              setParsedTransactions(updated);
                            }}
                            className="bg-panel/30 border border-white/[0.04] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-accent/40 transition-all cursor-pointer w-full"
                          >
                            <option value="" className="bg-[#0c0c10] text-white">Selecione...</option>
                            {categories.map(c => <option key={c.id} value={c.id} className="bg-[#0c0c10] text-white">{c.name}</option>)}
                          </select>
                        </td>
                        <td className="p-4">
                          <select 
                            value={trx.person_id}
                            onChange={(e) => {
                              const updated = [...parsedTransactions];
                              updated[index].person_id = e.target.value;
                              setParsedTransactions(updated);
                            }}
                            className="bg-panel/30 border border-white/[0.04] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-accent/40 transition-all cursor-pointer w-full"
                          >
                            <option value="" className="bg-[#0c0c10] text-white">Selecione...</option>
                            {people.map(p => <option key={p.id} value={p.id} className="bg-[#0c0c10] text-white">{p.name}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {importError && (
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p>{importError}</p>
                </div>
              )}
              
              <div className="flex gap-4 pt-4 border-t border-white/[0.04]">
                <button 
                  onClick={() => setImportStep('upload')}
                  className="btn-secondary flex-1"
                  disabled={importing}
                >
                  Voltar
                </button>
                <button 
                  onClick={handleConfirmImport}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                  disabled={importing || parsedTransactions.filter(t => t.checked).length === 0}
                >
                  {importing ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Importando...
                    </>
                  ) : (
                    `Importar ${parsedTransactions.filter(t => t.checked).length} transação(ões)`
                  )}
                </button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </SidebarLayout>
  );
}
