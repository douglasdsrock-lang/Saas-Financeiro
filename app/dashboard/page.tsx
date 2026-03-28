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
  Pie
} from 'recharts';

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
    cardSpending: 0
  });

  const [chartData, setChartData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [recurringBillsReminders, setRecurringBillsReminders] = useState<any[]>([]);
  const [recurringIncomesReminders, setRecurringIncomesReminders] = useState<any[]>([]);

  const fetchDashboardData = React.useCallback(async (isBackground = false) => {
    if (!supabase) {
      setError('Supabase não inicializado. Verifique as configurações.');
      setLoading(false);
      return;
    }
    if (!isBackground) setLoading(true);
    setError(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) return;

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
        recurringIncomes
      ] = await Promise.all([
        fetchTable('incomes', supabase.from('incomes').select('*').eq('user_id', user.id).gte('date', startStr).lte('date', endStr)),
        fetchTable('expenses', supabase.from('expenses').select('*, categories(name)').eq('user_id', user.id).gte('date', startStr).lte('date', endStr)),
        fetchTable('investments', supabase.from('investments').select('*').eq('user_id', user.id).gte('date', startStr).lte('date', endStr)),
        fetchTable('card_purchases', supabase.from('card_purchases').select('*').eq('user_id', user.id).gte('date', startStr).lte('date', endStr)),
        fetchTable('recurring_bills', supabase.from('recurring_bills').select('*, categories(name)').eq('user_id', user.id).eq('active', true)),
        fetchTable('recurring_incomes', supabase.from('recurring_incomes').select('*, categories(name)').eq('user_id', user.id).eq('active', true))
      ]);

      const totalIncome = incomes.reduce((sum: number, i: any) => sum + Number(i.amount), 0);
      const totalExpense = expenses.reduce((sum: number, i: any) => sum + Number(i.amount), 0);
      const totalInvested = investments.reduce((sum: number, i: any) => sum + Number(i.amount), 0);
      const cardSpending = cardPurchases.reduce((sum: number, i: any) => sum + Number(i.total_amount), 0);
      const balance = totalIncome - totalExpense - totalInvested;

      setStats({
        totalIncome,
        totalExpense,
        totalInvested,
        balance,
        cardSpending
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

      // Process Category Data
      const catMap: Record<string, number> = {};
      expenses.forEach((e: any) => {
        const name = e.categories?.name || 'Outros';
        catMap[name] = (catMap[name] || 0) + Number(e.amount);
      });
      setCategoryData(Object.entries(catMap).map(([name, value]) => ({ name, value })));

      // Check for unpaid recurring items
      const unpaidRecurringBills = recurringBills.filter((bill: any) => {
        return !expenses.some((exp: any) => exp.recurring_bill_id === bill.id);
      });
      setRecurringBillsReminders(unpaidRecurringBills);

      const unpaidRecurringIncomes = recurringIncomes.filter((inc: any) => {
        return !incomes.some((income: any) => income.recurring_income_id === inc.id);
      });
      setRecurringIncomesReminders(unpaidRecurringIncomes);
    } catch (error: any) {
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
          />
          <StatCard 
            title="Saídas" 
            value={`R$ ${stats.totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={TrendingDown}
            color="red"
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
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold">Fluxo de Caixa</h3>
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
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                  <XAxis 
                    dataKey="day" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#a3a3a3', fontSize: 10 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#a3a3a3', fontSize: 10 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#141414', 
                      border: '1px solid #262626',
                      borderRadius: '16px',
                      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'
                    }}
                    cursor={{ fill: '#262626' }}
                  />
                  <Bar dataKey="entradas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="saidas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="space-y-8">
            <Card>
              <h3 className="text-xl font-bold mb-6">Gastos por Categoria</h3>
              <div className="h-[250px]">
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#22c55e', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444'][index % 5]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#141414', 
                          border: '1px solid #262626',
                          borderRadius: '12px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-text-secondary text-sm italic">
                    Sem dados para exibir
                  </div>
                )}
              </div>
              <div className="mt-4 space-y-2">
                {categoryData.slice(0, 4).map((cat, i) => (
                  <div key={cat.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#22c55e', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444'][i % 5] }}></div>
                      <span className="text-text-secondary">{cat.name}</span>
                    </div>
                    <span className="font-bold">R$ {cat.value.toLocaleString('pt-BR')}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="bg-accent/5 border-accent/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-accent/20 rounded-lg text-accent">
                  <CreditCard className="w-5 h-5" />
                </div>
                <h3 className="font-bold">Gasto no Cartão</h3>
              </div>
              <p className="text-2xl font-black text-accent">
                R$ {stats.cardSpending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-text-secondary mt-1">Total de compras parceladas e à vista este mês</p>
            </Card>
          </div>
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
