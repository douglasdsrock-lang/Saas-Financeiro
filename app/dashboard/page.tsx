'use client';

import React, { useEffect, useState } from 'react';
import SidebarLayout from '@/components/sidebar-layout';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  CreditCard, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCcw
} from 'lucide-react';
import { StatCard, Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  LabelList
} from 'recharts';
import { motion } from 'framer-motion';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  console.log('DashboardPage: Rendering...', { loading, error });
  
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpense: 0,
    totalInvested: 0,
    balance: 0,
    cardSpending: 0,
    predictedIncome: 0,
    predictedExpense: 0
  });

  const [chartData, setChartData] = useState<any[]>([]);
  const [projectionData, setProjectionData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [cardBreakdown, setCardBreakdown] = useState<any[]>([]);
  const [cardDebtData, setCardDebtData] = useState<any[]>([]);
  const [recurringBillsReminders, setRecurringBillsReminders] = useState<any[]>([]);
  const [recurringIncomesReminders, setRecurringIncomesReminders] = useState<any[]>([]);

  const fetchDashboardData = React.useCallback(async (isBackground = false) => {
    console.log('fetchDashboardData: Starting...', { isBackground });
    if (!supabase) {
      console.error('fetchDashboardData: Supabase not initialized');
      setError('Supabase não inicializado. Verifique as configurações.');
      setLoading(false);
      return;
    }
    if (!isBackground) setLoading(true);
    setError(null);
    try {
      console.log('fetchDashboardData: Fetching user...');
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('fetchDashboardData: Auth error', authError);
        throw authError;
      }
      if (!user) {
        console.warn('fetchDashboardData: No user found');
        setLoading(false);
        return;
      }

      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');

      const fetchTable = async (tableName: string, query: any) => {
        const { data, error } = await query;
        if (error) {
          if (error.code === '42P01') {
            console.error(`Table ${tableName} does not exist in Supabase.`);
            return [];
          }
          console.warn(`Error fetching ${tableName}:`, error);
          return [];
        }
        return data || [];
      };

      const [
        incomes,
        expenses,
        investments,
        cardPurchases,
        recurringBills,
        recurringIncomes,
        creditCards,
        banks,
        pendingInstallments,
        allCardPurchases
      ] = await Promise.all([
        fetchTable('incomes', supabase.from('incomes').select('*').eq('user_id', user.id).gte('date', startStr).lte('date', endStr)),
        fetchTable('expenses', supabase.from('expenses').select('*, categories(name)').eq('user_id', user.id).gte('date', startStr).lte('date', endStr)),
        fetchTable('investments', supabase.from('investments').select('*').eq('user_id', user.id).gte('date', startStr).lte('date', endStr)),
        fetchTable('card_purchases', supabase.from('card_purchases').select('*').eq('user_id', user.id).gte('date', startStr).lte('date', endStr)),
        fetchTable('recurring_bills', supabase.from('recurring_bills').select('*, categories(name)').eq('user_id', user.id).eq('active', true)),
        fetchTable('recurring_incomes', supabase.from('recurring_incomes').select('*, categories(name)').eq('user_id', user.id).eq('active', true)),
        fetchTable('credit_cards', supabase.from('credit_cards').select('*').eq('user_id', user.id)),
        fetchTable('banks', supabase.from('banks').select('*').eq('user_id', user.id)),
        fetchTable('installments', supabase.from('installments').select('*').eq('user_id', user.id).eq('status', 'pending')),
        fetchTable('card_purchases_all', supabase.from('card_purchases').select('*').eq('user_id', user.id))
      ]);

      console.log('fetchDashboardData: Data fetched, processing...', { 
        incomes: incomes.length, 
        expenses: expenses.length,
        creditCards: creditCards.length 
      });

      // Calculate Card Spending considering closing dates
      let totalCardSpending = 0;
      const breakdown: any[] = [];
      
      const { data: allCardExpenses, error: cardExpError } = await supabase
        .from('expenses')
        .select('*, categories(name)')
        .eq('user_id', user.id)
        .eq('payment_method', 'Cartão de Crédito');

      const currentBillExpenses: any[] = [];

      if (!cardExpError && allCardExpenses) {
        creditCards.forEach((card: any) => {
          const closingDay = card.closing_day || 10;
          const billEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), closingDay, 23, 59, 59);
          const billStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, closingDay + 1, 0, 0, 0);

          const cardExpenses = allCardExpenses.filter((exp: any) => {
            if (exp.credit_card_id !== card.id) return false;
            const expDate = new Date(exp.date);
            return expDate >= billStart && expDate <= billEnd;
          });

          const cardTotal = cardExpenses.reduce((sum: number, exp: any) => sum + Number(exp.amount), 0);
          currentBillExpenses.push(...cardExpenses);
          
          if (cardTotal > 0) {
            const bank = banks.find((b: any) => b.id === card.bank_id);
            // Default colors for common banks if not set
            let color = bank?.color || '#3b82f6';
            const bankName = bank?.name?.toLowerCase() || '';
            if (!bank?.color) {
              if (bankName.includes('nubank')) color = '#8A05BE';
              else if (bankName.includes('inter')) color = '#FF7A00';
              else if (bankName.includes('itau') || bankName.includes('itaú')) color = '#EC7000';
              else if (bankName.includes('santander')) color = '#CC0000';
              else if (bankName.includes('bradesco')) color = '#ED1C24';
            }

            breakdown.push({
              name: card.name,
              value: cardTotal,
              color: color
            });
            totalCardSpending += cardTotal;
          }
        });
      }

      setCardBreakdown(breakdown);

      // Check for unpaid recurring items
      const unpaidRecurringBills = recurringBills.filter((bill: any) => {
        return !expenses.some((exp: any) => exp.recurring_bill_id === bill.id);
      });
      setRecurringBillsReminders(unpaidRecurringBills);

      const unpaidRecurringIncomes = recurringIncomes.filter((inc: any) => {
        return !incomes.some((income: any) => income.recurring_income_id === inc.id);
      });
      setRecurringIncomesReminders(unpaidRecurringIncomes);

      const totalIncome = incomes.reduce((sum: number, i: any) => sum + Number(i.amount), 0);
      
      // Corrected Total Expense: Non-card expenses in calendar month + Total Card Bill for the period
      const nonCardExpenses = expenses
        .filter((e: any) => e.payment_method !== 'Cartão de Crédito')
        .reduce((sum: number, i: any) => sum + Number(i.amount), 0);
      
      const correctedTotalExpense = nonCardExpenses + totalCardSpending;
      
      const totalInvested = investments.reduce((sum: number, i: any) => sum + Number(i.amount), 0);
      const balance = totalIncome - correctedTotalExpense - totalInvested;

      // Predicted values
      const unpaidBillsTotal = unpaidRecurringBills.reduce((sum: number, b: any) => sum + Number(b.amount), 0);
      const unpaidIncomesTotal = unpaidRecurringIncomes.reduce((sum: number, i: any) => sum + Number(i.amount), 0);

      setStats({
        totalIncome,
        totalExpense: correctedTotalExpense,
        totalInvested,
        balance,
        cardSpending: totalCardSpending,
        predictedIncome: totalIncome + unpaidIncomesTotal,
        predictedExpense: correctedTotalExpense + unpaidBillsTotal
      });

      // Process Chart Data (Daily)
      const daysInMonth = end.getDate();
      const dailyData = Array.from({ length: daysInMonth }, (_, i) => ({
        day: i + 1,
        entradas: 0,
        saidas: 0
      }));

      incomes.forEach((i: any) => {
        const day = new Date(i.date).getDate();
        if (dailyData[day - 1]) dailyData[day - 1].entradas += Number(i.amount);
      });

      expenses.forEach((i: any) => {
        const day = new Date(i.date).getDate();
        if (dailyData[day - 1]) dailyData[day - 1].saidas += Number(i.amount);
      });

      setChartData(dailyData);

      // Process Category Data - Including Card Spending and Recurring Bills
      const catMap: Record<string, number> = {};
      
      // 1. Non-card expenses of the calendar month
      expenses
        .filter((e: any) => e.payment_method !== 'Cartão de Crédito')
        .forEach((e: any) => {
          const name = e.categories?.name || 'Outros';
          catMap[name] = (catMap[name] || 0) + Number(e.amount);
        });

      // 2. Card expenses belonging to the current bill cycle
      currentBillExpenses.forEach((e: any) => {
        const name = e.categories?.name || 'Outros';
        catMap[name] = (catMap[name] || 0) + Number(e.amount);
      });

      // 3. Unpaid recurring bills for the month (predicted)
      unpaidRecurringBills.forEach((bill: any) => {
        const name = bill.categories?.name || 'Outros';
        catMap[name] = (catMap[name] || 0) + Number(bill.amount);
      });
      
      setCategoryData(Object.entries(catMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
      );

      // Process Projection Data (Current + 3 Months)
      const projection: any[] = [];
      for (let i = 0; i <= 3; i++) {
        const targetDate = addMonths(currentDate, i);
        const monthName = format(targetDate, 'MMM', { locale: ptBR });
        
        // For future months, we use recurring items as the base
        const monthRecurringIncomes = recurringIncomes.reduce((sum: number, inc: any) => sum + Number(inc.amount), 0);
        const monthRecurringBills = recurringBills.reduce((sum: number, bill: any) => sum + Number(bill.amount), 0);
        
        if (i === 0) {
          // Current month: actual + pending
          projection.push({
            name: monthName,
            entradas: totalIncome + unpaidIncomesTotal,
            saidas: correctedTotalExpense + unpaidBillsTotal
          });
        } else {
          // Future months: recurring only
          projection.push({
            name: monthName,
            entradas: monthRecurringIncomes,
            saidas: monthRecurringBills
          });
        }
      }
      setProjectionData(projection);

      // Process Card Debt (Future Installments)
      const debtMap: Record<string, number> = {};
      
      pendingInstallments.forEach((inst: any) => {
        // Consider all pending installments as debt
        const purchase = allCardPurchases.find((p: any) => p.id === inst.purchase_id);
        if (purchase) {
          const cardId = purchase.card_id;
          debtMap[cardId] = (debtMap[cardId] || 0) + Number(inst.amount);
        }
      });

      const debtData = creditCards.map((card: any) => {
        const bank = banks.find((b: any) => b.id === card.bank_id);
        let color = bank?.color || '#3b82f6';
        const bankName = bank?.name?.toLowerCase() || '';
        if (!bank?.color) {
          if (bankName.includes('nubank')) color = '#8A05BE';
          else if (bankName.includes('inter')) color = '#FF7A00';
          else if (bankName.includes('itau') || bankName.includes('itaú')) color = '#EC7000';
          else if (bankName.includes('santander')) color = '#CC0000';
          else if (bankName.includes('bradesco')) color = '#ED1C24';
        }

        return {
          name: card.name,
          value: debtMap[card.id] || 0,
          color: color
        };
      }).sort((a: any, b: any) => b.value - a.value);
      
      setCardDebtData(debtData);

      setRecurringIncomesReminders(unpaidRecurringIncomes);
      console.log('fetchDashboardData: Success');
    } catch (error: any) {
      console.error('fetchDashboardData: Error', error);
      setError(handleSupabaseError(error, 'Erro ao carregar dados do dashboard.'));
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handlePayBill = async (bill: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('expenses').insert([{
        description: `Pagamento: ${bill.name}`,
        amount: bill.amount,
        date: `${format(new Date(), 'yyyy-MM-dd')}T12:00:00`,
        category_id: bill.category_id,
        person_id: bill.responsible_id,
        payment_method: bill.payment_method,
        credit_card_id: bill.credit_card_id,
        is_fixed: true,
        recurring_bill_id: bill.id,
        user_id: user.id
      }]);

      if (error) throw error;
      fetchDashboardData(true);
    } catch (error: any) {
      alert(`Erro ao pagar conta: ${error.message}`);
    }
  };

  const handleReceiveIncome = async (income: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('incomes').insert([{
        description: `Recebimento: ${income.name}`,
        amount: income.amount,
        date: `${format(new Date(), 'yyyy-MM-dd')}T12:00:00`,
        category_id: income.category_id,
        person_id: income.person_id,
        bank_id: income.bank_id,
        recurring_income_id: income.id,
        user_id: user.id
      }]);

      if (error) throw error;
      fetchDashboardData(true);
    } catch (error: any) {
      alert(`Erro ao receber receita: ${error.message}`);
    }
  };

  if (error) {
    return (
      <SidebarLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-6">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center text-red-500">
            <AlertCircle className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Erro de Conexão</h2>
            <p className="text-text-secondary">
              {error}
            </p>
          </div>
          <button 
            onClick={() => fetchDashboardData()}
            className="btn-primary flex items-center gap-2"
          >
            <RefreshCcw className="w-4 h-4" />
            Tentar Novamente
          </button>
        </div>
      </SidebarLayout>
    );
  }

  if (loading) {
    return (
      <SidebarLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <RefreshCcw className="w-8 h-8 text-accent animate-spin" />
            <p className="text-text-secondary animate-pulse font-medium">Carregando dados...</p>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Dashboard</h1>
            <p className="text-text-secondary font-medium">Bem-vindo ao seu controle financeiro inteligente.</p>
          </div>
          
          <div className="flex items-center bg-panel border border-border rounded-2xl p-1.5 shadow-sm">
            <button 
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="p-2 hover:bg-neutral-800 rounded-xl transition-all text-text-secondary hover:text-white"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="px-6 flex items-center gap-2 font-bold min-w-[160px] justify-center">
              <Calendar className="w-4 h-4 text-accent" />
              {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
            </div>
            <button 
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="p-2 hover:bg-neutral-800 rounded-xl transition-all text-text-secondary hover:text-white"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title="Entradas" 
            value={`R$ ${stats.totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={TrendingUp}
            color="accent"
            description={`Previsto: R$ ${stats.predictedIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          />
          <StatCard 
            title="Saídas" 
            value={`R$ ${stats.totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={TrendingDown}
            color="red"
            description={`Previsto: R$ ${stats.predictedExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          />
          <StatCard 
            title="Investimentos" 
            value={`R$ ${stats.totalInvested.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={Wallet}
            color="blue"
          />
          <StatCard 
            title="Saldo Final" 
            value={`R$ ${stats.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={CheckCircle2}
            color={stats.balance >= 0 ? 'accent' : 'red'}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 shadow-xl shadow-black/20">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold">Projeção Próximos Meses</h3>
                <p className="text-xs text-text-secondary mt-1">Baseado em suas receitas e contas fixas</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-accent rounded-full shadow-lg shadow-accent/20"></div>
                  <span className="text-text-secondary">Entradas</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-red-500 rounded-full shadow-lg shadow-red-500/20"></div>
                  <span className="text-text-secondary">Saídas</span>
                </div>
              </div>
            </div>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={projectionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#a3a3a3', fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#a3a3a3', fontSize: 10 }}
                    tickFormatter={(value) => `R$ ${value >= 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#141414', 
                      border: '1px solid #262626',
                      borderRadius: '16px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
                    }}
                    itemStyle={{ color: '#fff' }}
                    labelStyle={{ color: '#fff' }}
                    wrapperStyle={{ zIndex: 1000 }}
                    formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`}
                    cursor={{ fill: '#262626', opacity: 0.4 }}
                  />
                  <Bar dataKey="entradas" fill="#22c55e" radius={[6, 6, 0, 0]} barSize={45} />
                  <Bar dataKey="saidas" fill="#ef4444" radius={[6, 6, 0, 0]} barSize={45} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="shadow-xl shadow-black/20 border-red-500/10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold">Dívida Parcelada</h3>
                <p className="text-[10px] text-text-secondary mt-1 uppercase tracking-wider font-bold">Comprometimento Futuro</p>
              </div>
              <div className="p-2.5 bg-red-500/10 rounded-2xl text-red-500 shadow-inner">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>
            
            <div className="space-y-6 mt-4">
              {cardDebtData.length > 0 ? (
                cardDebtData.map((card, index) => (
                  <div key={card.name} className="space-y-2">
                    <div className="flex justify-between items-end">
                      <span className="text-sm font-bold text-text-secondary">{card.name}</span>
                      <span className="text-sm font-black text-white">
                        R$ {card.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="h-3 w-full bg-neutral-900 rounded-full overflow-hidden border border-white/5">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((card.value / (Math.max(...cardDebtData.map(d => d.value)) || 1)) * 100, 100)}%` }}
                        transition={{ duration: 1, delay: index * 0.1 }}
                        className="h-full rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                        style={{ backgroundColor: card.color }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-[200px] flex flex-col items-center justify-center text-text-secondary text-sm italic gap-3">
                  <div className="w-12 h-12 rounded-full bg-neutral-900 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-accent/20" />
                  </div>
                  Nenhuma dívida parcelada futura
                </div>
              )}
            </div>
            
            {cardDebtData.length > 0 && (
              <div className="mt-8 pt-6 border-t border-border/50">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-text-secondary">Total Parcelado</span>
                  <span className="text-lg font-black text-red-500">
                    R$ {cardDebtData.reduce((acc, curr) => acc + curr.value, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          <Card className="shadow-xl shadow-black/20">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold">Gastos por Categoria</h3>
              <div className="p-2 bg-accent/10 rounded-xl text-accent">
                <TrendingDown className="w-5 h-5" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="h-[280px] relative">
                {categoryData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          innerRadius={75}
                          outerRadius={100}
                          paddingAngle={8}
                          dataKey="value"
                          stroke="none"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#22c55e', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4'][index % 7]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#141414', 
                            border: '1px solid #262626',
                            borderRadius: '16px',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
                          }}
                          itemStyle={{ color: '#fff' }}
                          labelStyle={{ color: '#fff' }}
                          wrapperStyle={{ zIndex: 1000 }}
                          formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[10px] uppercase tracking-widest text-text-secondary font-bold">Total</span>
                      <span className="text-xl font-black text-white">
                        R$ {categoryData.reduce((acc, curr) => acc + curr.value, 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-text-secondary text-sm italic">
                    Sem dados para exibir
                  </div>
                )}
              </div>
              <div className="space-y-4">
                {categoryData.slice(0, 6).map((cat, i) => (
                  <div key={cat.name} className="group">
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: ['#22c55e', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4'][i % 7] }}></div>
                        <span className="text-text-secondary font-medium group-hover:text-white transition-colors">{cat.name}</span>
                      </div>
                      <span className="font-bold">R$ {cat.value.toLocaleString('pt-BR')}</span>
                    </div>
                    <div className="h-1.5 w-full bg-neutral-900 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-1000" 
                        style={{ 
                          width: `${(cat.value / (categoryData.reduce((acc, curr) => acc + curr.value, 0) || 1)) * 100}%`,
                          backgroundColor: ['#22c55e', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4'][i % 7] 
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card className="bg-accent/[0.02] border-accent/10 shadow-xl shadow-black/20 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-3xl rounded-full -mr-16 -mt-16"></div>
            <div className="flex items-center justify-between mb-8 relative z-10">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-accent/10 rounded-2xl text-accent shadow-inner">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-xl">Gastos por Cartão</h3>
                  <p className="text-xs text-text-secondary">Distribuição da fatura atual</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-accent">
                  R$ {stats.cardSpending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center relative z-10">
              <div className="h-[240px] relative">
                {cardBreakdown.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={cardBreakdown}
                          innerRadius={65}
                          outerRadius={90}
                          paddingAngle={6}
                          dataKey="value"
                          stroke="none"
                        >
                          {cardBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#141414', 
                            border: '1px solid #262626',
                            borderRadius: '16px',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
                          }}
                          itemStyle={{ color: '#fff' }}
                          labelStyle={{ color: '#fff' }}
                          wrapperStyle={{ zIndex: 1000 }}
                          formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <CreditCard className="w-6 h-6 text-accent/20 mb-1" />
                      <span className="text-[10px] uppercase tracking-widest text-text-secondary font-bold">Cartões</span>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-text-secondary text-xs italic">
                    Nenhum gasto no cartão
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {cardBreakdown.map((card) => (
                  <div key={card.name} className="group">
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: card.color }}></div>
                        <span className="text-text-secondary font-medium group-hover:text-white transition-colors">{card.name}</span>
                      </div>
                      <span className="font-bold">R$ {card.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="h-1.5 w-full bg-neutral-900 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-1000" 
                        style={{ 
                          width: `${(card.value / (stats.cardSpending || 1)) * 100}%`,
                          backgroundColor: card.color 
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Lembretes de Contas a Pagar */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Clock className="w-5 h-5 text-red-500" />
                Contas a Pagar
              </h3>
              <span className="text-xs font-bold bg-red-500/10 text-red-500 px-2.5 py-1 rounded-full">
                {recurringBillsReminders.length} Pendentes
              </span>
            </div>
            <div className="space-y-4">
              {recurringBillsReminders.length === 0 ? (
                <div className="py-8 text-center text-text-secondary text-sm italic">
                  Todas as contas fixas deste mês foram pagas!
                </div>
              ) : (
                recurringBillsReminders.map((bill) => (
                  <div key={bill.id} className="flex items-center justify-between p-4 bg-background border border-border rounded-2xl group hover:border-red-500/30 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center text-red-500">
                        <ArrowDownRight className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold">{bill.name}</p>
                        <p className="text-xs text-text-secondary">Vence dia {bill.due_day}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-black text-red-500">R$ {bill.amount.toLocaleString('pt-BR')}</p>
                      <button 
                        onClick={() => handlePayBill(bill)}
                        className="p-2 bg-neutral-800 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                        title="Marcar como pago"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Lembretes de Receitas a Receber */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Clock className="w-5 h-5 text-accent" />
                Receitas a Receber
              </h3>
              <span className="text-xs font-bold bg-accent/10 text-accent px-2.5 py-1 rounded-full">
                {recurringIncomesReminders.length} Pendentes
              </span>
            </div>
            <div className="space-y-4">
              {recurringIncomesReminders.length === 0 ? (
                <div className="py-8 text-center text-text-secondary text-sm italic">
                  Todas as receitas fixas deste mês foram recebidas!
                </div>
              ) : (
                recurringIncomesReminders.map((income) => (
                  <div key={income.id} className="flex items-center justify-between p-4 bg-background border border-border rounded-2xl group hover:border-accent/30 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent">
                        <ArrowUpRight className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold">{income.name}</p>
                        <p className="text-xs text-text-secondary">Recebe dia {income.due_day}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-black text-accent">R$ {income.amount.toLocaleString('pt-BR')}</p>
                      <button 
                        onClick={() => handleReceiveIncome(income)}
                        className="p-2 bg-neutral-800 hover:bg-accent hover:text-white rounded-xl transition-all"
                        title="Marcar como recebido"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </SidebarLayout>
  );
}
