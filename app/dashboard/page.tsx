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
  RefreshCcw,
  Target
} from 'lucide-react';
import { StatCard, Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { handleSupabaseError, formatDate } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, subMonths, addMonths, subDays } from 'date-fns';
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

  // DashboardPage: Rendering...
  
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpense: 0,
    totalInvested: 0,
    currentMonthInvested: 0,
    balance: 0,
    cardSpending: 0,
    predictedIncome: 0,
    predictedExpense: 0,
    predictedBalance: 0
  });

  const [chartData, setChartData] = useState<any[]>([]);
  const [projectionData, setProjectionData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [cardBreakdown, setCardBreakdown] = useState<any[]>([]);
  const [cardDebtData, setCardDebtData] = useState<any[]>([]);
  const [pendingExpenses, setPendingExpenses] = useState<any[]>([]);
  const [pendingIncomes, setPendingIncomes] = useState<any[]>([]);
  const [recurringBillsReminders, setRecurringBillsReminders] = useState<any[]>([]);
  const [recurringIncomesReminders, setRecurringIncomesReminders] = useState<any[]>([]);
  const [cardBillReminders, setCardBillReminders] = useState<any[]>([]);
  const [activeBudgets, setActiveBudgets] = useState<any[]>([]);

  const fetchDashboardData = React.useCallback(async (isBackground = false) => {
    console.log('fetchDashboardData: Starting...', { isBackground, currentDate: currentDate.toISOString() });
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
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('fetchDashboardData: Auth error', authError);
        throw authError;
      }
      const user = authData?.user;
      if (!user) {
        console.warn('fetchDashboardData: No user found');
        setLoading(false);
        return;
      }

      console.log('fetchDashboardData: User found:', user.id);
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');
      
      // Fetch expenses from the previous month to cover credit card cycles
      const extendedStartStr = format(subDays(start, 45), 'yyyy-MM-dd');

      const fetchTable = async (tableName: string, query: any) => {
        console.log(`fetchDashboardData: Fetching table ${tableName}...`);
        const { data, error } = await query;
        if (error) {
          if (error.code === '42P01') {
            console.error(`Table ${tableName} does not exist in Supabase.`);
            return [];
          }
          console.warn(`Error fetching ${tableName}:`, error);
          return [];
        }
        console.log(`fetchDashboardData: Table ${tableName} fetched:`, data?.length || 0);
        return data || [];
      };

      let [
        incomes,
        allPaidExpenses,
        pendingExpenses,
        investments,
        recurringBills,
        recurringIncomes,
        creditCards,
        banks,
        pendingInstallments,
        allCardPurchases,
        categories,
        budgetsData
      ] = await Promise.all([
        fetchTable('incomes', supabase.from('incomes').select('*').eq('user_id', user.id).gte('date', startStr).lte('date', endStr)),
        fetchTable('paid_expenses', supabase.from('expenses').select('*, categories(name)').eq('user_id', user.id).eq('status', 'paid').gte('date', extendedStartStr)),
        fetchTable('pending_expenses', supabase.from('expenses').select('*, categories(name)').eq('user_id', user.id).eq('status', 'pending')),
        fetchTable('investments', supabase.from('investments').select('*').eq('user_id', user.id)),
        fetchTable('recurring_bills', supabase.from('recurring_bills').select('*, categories(name)').eq('user_id', user.id).eq('active', true)),
        fetchTable('recurring_incomes', supabase.from('recurring_incomes').select('*, categories(name)').eq('user_id', user.id).eq('active', true)),
        fetchTable('credit_cards', supabase.from('credit_cards').select('*').eq('user_id', user.id)),
        fetchTable('banks', supabase.from('banks').select('*').eq('user_id', user.id)),
        fetchTable('installments', supabase.from('installments').select('*').eq('user_id', user.id).eq('status', 'pending')),
        fetchTable('card_purchases_all', supabase.from('card_purchases').select('*').eq('user_id', user.id)),
        fetchTable('categories', supabase.from('categories').select('*').eq('type', 'expense').eq('user_id', user.id)),
        fetchTable('category_budgets', supabase.from('category_budgets').select('*').eq('user_id', user.id))
      ]);

      // Auto-migration from localStorage to Supabase
      if (typeof window !== 'undefined') {
        const localBudgetsStr = localStorage.getItem('category_budgets');
        if (localBudgetsStr) {
          try {
            const localBudgets = JSON.parse(localBudgetsStr);
            const budgetKeys = Object.keys(localBudgets);
            // Filter to only include category IDs that actually exist in the DB categories list
            const validBudgetKeys = budgetKeys.filter(catId => categories.some((c: any) => c.id === catId));
            
            if (validBudgetKeys.length > 0) {
              console.log('Auto-migration: migrating budgets to Supabase...', localBudgets);
              const upsertPayloads = validBudgetKeys.map(catId => ({
                category_id: catId,
                limit_amount: Number(localBudgets[catId]),
                user_id: user.id
              }));
              const { error: upsertError } = await supabase
                .from('category_budgets')
                .upsert(upsertPayloads, { onConflict: 'user_id,category_id' });
              if (upsertError) {
                console.error('Auto-migration error:', upsertError.message, upsertError.details, upsertError.code);
              } else {
                console.log('Auto-migration: Success! Clearing localStorage category_budgets.');
                localStorage.removeItem('category_budgets');
                const { data: updatedBudgets, error: reFetchError } = await supabase
                  .from('category_budgets')
                  .select('*')
                  .eq('user_id', user.id);
                if (!reFetchError && updatedBudgets) {
                  budgetsData = updatedBudgets;
                }
              }
            } else {
              console.log('Auto-migration: No valid category budgets found in localStorage, clearing key.');
              localStorage.removeItem('category_budgets');
            }
          } catch (e) {
            console.error('Auto-migration parse error:', e);
          }
        }
      }

      console.log('fetchDashboardData: Promise.all finished', {
        paid: allPaidExpenses.length,
        pending: pendingExpenses.length
      });

      if (!incomes || !allPaidExpenses || !pendingExpenses || !investments) {
        console.error('fetchDashboardData: Critical data missing');
        throw new Error('Dados críticos não foram carregados corretamente.');
      }

      // Legacy cleanup: delete all installments and card purchases for this user
      // because they are legacy seed tables and not used by the current creation flow.
      if (pendingInstallments.length > 0 || allCardPurchases.length > 0) {
        console.log('Cleaning up legacy seed installments and card purchases...');
        await Promise.all([
          supabase.from('installments').delete().eq('user_id', user.id),
          supabase.from('card_purchases').delete().eq('user_id', user.id)
        ]);
        // Trigger a reload of data to reflect the changes
        setTimeout(() => fetchDashboardData(true), 200);
        return;
      }

      const isStatementPayment = (e: any) => 
        e.credit_card_id !== null && 
        e.payment_method !== 'Cartão de Crédito' && 
        e.payment_method !== 'Cartão de crédito';

      const isCardBillPaid = (cardId: string) => {
        return allPaidExpenses.some((e: any) => {
          const expenseDateStr = e.date.split('T')[0];
          return e.credit_card_id === cardId && 
                 e.payment_method !== 'Cartão de Crédito' && 
                 e.payment_method !== 'Cartão de crédito' &&
                 expenseDateStr >= startStr && expenseDateStr <= endStr;
        });
      };

      // Filter paid expenses for the calendar month stats (excluding statement payments)
      const paidExpenses = allPaidExpenses.filter((e: any) => {
        const expenseDateStr = e.date.split('T')[0];
        return expenseDateStr >= startStr && expenseDateStr <= endStr && !isStatementPayment(e);
      });

      console.log('fetchDashboardData: Data fetched, processing...', { 
        incomes: incomes.length, 
        paidExpenses: paidExpenses.length,
        allPaidExpenses: allPaidExpenses.length,
        pendingExpenses: pendingExpenses.length,
        creditCards: creditCards.length 
      });

      // Calculate Card Spending and Bills for the current month
      const cardBills: any[] = [];
      let pendingCardTotal = 0;
      let totalCardSpending = 0;
      let paidCardExpensesInCycle = 0;
      const breakdown: any[] = [];
      const currentBillExpenses: any[] = [];
      
      const allPaidCardExpenses = allPaidExpenses.filter((e: any) => 
        e.payment_method === 'Cartão de Crédito' || e.payment_method === 'Cartão de crédito'
      );
      
      const pendingCardExpenses = pendingExpenses.filter((e: any) => 
        e.payment_method === 'Cartão de Crédito' || e.payment_method === 'Cartão de crédito'
      );

      creditCards.forEach((card: any) => {
        // Bill Cycle Logic
        // The bill due in Month M (currentDate)
        // Closing day is CD. Cycle ends on CD-1 of Month M.
        const dueDay = card.due_day || 10;
        const closingDay = card.closing_day || (dueDay > 7 ? dueDay - 7 : 1);
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        // Cycle Logic: If closing day is 20, cycle is from 21st of previous month to 20th of current month
        // Example: March 21 to April 20
        const cycleEnd = new Date(year, month, closingDay, 23, 59, 59);
        const cycleStart = new Date(year, month, closingDay + 1, 0, 0, 0);
        // Adjust start to previous month
        cycleStart.setMonth(cycleStart.getMonth() - 1);
        
        const cycleStartStr = format(cycleStart, 'yyyy-MM-dd');
        const cycleEndStr = format(cycleEnd, 'yyyy-MM-dd');

        console.log(`DEBUG: Card: ${card.name}, Due: ${dueDay}, Closing: ${closingDay}, Cycle: ${cycleStartStr} to ${cycleEndStr}`);

        // 1. Find expenses (paid and pending) that belong to this bill cycle
        const cyclePaidExpenses = allPaidCardExpenses.filter((e: any) => {
          const expenseDateStr = e.date.split('T')[0];
          return e.credit_card_id === card.id && expenseDateStr >= cycleStartStr && expenseDateStr <= cycleEndStr;
        });

        // For pending, we include only expenses for this card that fall within the cycle
        const cyclePendingExpenses = pendingCardExpenses.filter((e: any) => {
          const expenseDateStr = e.date.split('T')[0];
          return e.credit_card_id === card.id && expenseDateStr >= cycleStartStr && expenseDateStr <= cycleEndStr;
        });
        
        // 2. Find installments due in the cycle of the bill
        const installmentItems = pendingInstallments.filter((inst: any) => {
          const purchase = allCardPurchases.find((p: any) => p.id === inst.purchase_id);
          const dueDateStr = inst.due_date; // Assuming YYYY-MM-DD format
          return purchase && purchase.card_id === card.id && dueDateStr >= cycleStartStr && dueDateStr <= cycleEndStr;
        });

        // 3. Find RECURRING bills set to this card for this cycle
        const recurringItems = recurringBills.filter((rb: any) => {
          if (rb.payment_method !== 'Cartão de Crédito' || rb.credit_card_id !== card.id) return false;
          
          // Check if already created as expense in this SPECIFIC cycle
          const hasPaid = allPaidExpenses.some((exp: any) => {
            const expDateStr = exp.date.split('T')[0];
            return exp.recurring_bill_id === rb.id && expDateStr >= cycleStartStr && expDateStr <= cycleEndStr;
          });
          const hasPending = pendingExpenses.some((exp: any) => {
            const expDateStr = exp.date.split('T')[0];
            return exp.recurring_bill_id === rb.id && expDateStr >= cycleStartStr && expDateStr <= cycleEndStr;
          });
          return !hasPaid && !hasPending;
        });

        const paidTotal = cyclePaidExpenses.reduce((sum: number, i: any) => sum + Number(i.amount), 0);
        const pendingTotal = cyclePendingExpenses.reduce((sum: number, i: any) => sum + Number(i.amount), 0);
        
        const totalBillAmount = paidTotal + pendingTotal;
        const totalSpentInCycle = totalBillAmount;
        
        const isPaid = isCardBillPaid(card.id);
        
        // Generate a bill for EVERY card as requested
        cardBills.push({
          id: `bill-${card.id}-${format(currentDate, 'yyyy-MM')}`,
          cardId: card.id,
          name: `Fatura ${card.name}`,
          cardName: card.name,
          holderId: card.holder_id,
          amount: totalBillAmount,
          due_day: dueDay,
          isCardBill: true,
          expenseIds: [...cyclePaidExpenses.map((i: any) => i.id), ...cyclePendingExpenses.map((i: any) => i.id)],
          installmentIds: [],
          isPaid: isPaid
        });
        
        if (!isPaid) {
          pendingCardTotal += totalBillAmount;
          paidCardExpensesInCycle += cyclePaidExpenses.filter((e: any) => {
            const expenseDateStr = e.date.split('T')[0];
            return expenseDateStr >= startStr && expenseDateStr <= endStr;
          }).reduce((sum: number, i: any) => sum + Number(i.amount), 0);
        }
        
        // Use totalBillAmount for totalCardSpending to match the breakdown
        totalCardSpending += totalBillAmount;
        
        // Add to breakdown for chart (Focus on what's currently owed/pending for the current bill)
        if (totalBillAmount > 0) {
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

          breakdown.push({
            name: card.name,
            value: totalBillAmount,
            color: color
          });
        }

        // Add to currentBillExpenses for category chart
        currentBillExpenses.push(...cyclePaidExpenses, ...cyclePendingExpenses);
        recurringItems.forEach((rb: any) => {
          currentBillExpenses.push({
            ...rb,
            amount: rb.amount,
            categories: rb.categories || { name: 'Outros' },
            payment_method: 'Cartão de Crédito'
          });
        });
        installmentItems.forEach((inst: any) => {
          const purchase = allCardPurchases.find((p: any) => p.id === inst.purchase_id);
          currentBillExpenses.push({
            ...inst,
            amount: inst.amount,
            category_id: purchase?.category_id,
            categories: { name: 'Parcelamento' },
            payment_method: 'Cartão de Crédito'
          });
        });
      });

      // Also add paid card expenses of the current month to total spending and category chart
      const currentMonthPaidCard = allPaidCardExpenses.filter((e: any) => {
        const expenseDateStr = e.date.split('T')[0];
        return expenseDateStr >= startStr && expenseDateStr <= endStr;
      });
      
      // totalCardSpending was already calculated as sum of all bills (which include paid expenses).
      // We don't need to add currentMonthPaidCard again.
      currentBillExpenses.push(...currentMonthPaidCard);

      setCardBreakdown(breakdown.sort((a, b) => b.value - a.value));
      setCardBillReminders(cardBills.filter(bill => !bill.isPaid && bill.amount > 0));

      // Separate pending non-card expenses
      const pendingNonCardExpenses = pendingExpenses.filter((e: any) => 
        e.payment_method !== 'Cartão de Crédito' && e.payment_method !== 'Cartão de crédito'
      );
      const currentPendingNonCard = pendingNonCardExpenses.filter((e: any) => {
        const expenseDateStr = e.date.split('T')[0];
        return expenseDateStr <= endStr;
      });
      setPendingExpenses(currentPendingNonCard);

      // Check for unpaid recurring items
      const unpaidRecurringBills = recurringBills.filter((bill: any) => {
        const hasPaid = paidExpenses.some((exp: any) => exp.recurring_bill_id === bill.id);
        const hasPending = pendingExpenses.some((exp: any) => exp.recurring_bill_id === bill.id);
        return !hasPaid && !hasPending;
      });
      setRecurringBillsReminders(unpaidRecurringBills);

      const unpaidRecurringIncomes = recurringIncomes.filter((inc: any) => {
        return !incomes.some((income: any) => income.recurring_income_id === inc.id);
      });
      setRecurringIncomesReminders(unpaidRecurringIncomes);

      // Separate incomes by status
      const paidIncomes = incomes.filter((i: any) => i.status !== 'pending');
      const currentPendingIncomes = incomes.filter((i: any) => i.status === 'pending');
      setPendingIncomes(currentPendingIncomes);

      const totalIncome = paidIncomes.reduce((sum: number, i: any) => sum + Number(i.amount), 0);
      
      // Total Expense: Only what is actually PAID (excluding statement payments since they are filtered in paidExpenses)
      const totalPaidExpense = paidExpenses.reduce((sum: number, i: any) => sum + Number(i.amount), 0);
      
      const totalInvestedAllTime = investments.reduce((sum: number, i: any) => sum + Number(i.amount), 0);
      const currentMonthInvested = investments
        .filter((i: any) => {
          const dateStr = i.date.split('T')[0];
          return dateStr >= startStr && dateStr <= endStr;
        })
        .reduce((sum: number, i: any) => sum + Number(i.amount), 0);
      const balance = totalIncome - totalPaidExpense - currentMonthInvested;

      // Predicted values:
      // totalPaidExpense includes paid expenses (both card and non-card).
      // pendingCardTotal includes ONLY unpaid card bills for the current cycle.
      // We need: totalPaidExpense + (pendingCardTotal - paidCardExpensesInCycle) + unpaidBillsTotal + pendingNonCardTotal
      
      const unpaidBillsTotal = unpaidRecurringBills.reduce((sum: number, b: any) => sum + Number(b.amount), 0);
      const pendingNonCardTotal = currentPendingNonCard.reduce((sum: number, e: any) => sum + Number(e.amount), 0);
      const unpaidIncomesTotal = unpaidRecurringIncomes.reduce((sum: number, i: any) => sum + Number(i.amount), 0);
      const pendingIncomesTotal = currentPendingIncomes.reduce((sum: number, i: any) => sum + Number(i.amount), 0);

      const predictedIncome = totalIncome + unpaidIncomesTotal + pendingIncomesTotal;
      
      const predictedExpense = totalPaidExpense + (pendingCardTotal - paidCardExpensesInCycle) + unpaidBillsTotal + pendingNonCardTotal;
      const predictedBalance = predictedIncome - predictedExpense - currentMonthInvested;

      console.log('fetchDashboardData: Totals calculated', {
        totalPaidExpense,
        unpaidBillsTotal,
        pendingNonCardTotal,
        pendingCardTotal,
        predictedExpense
      });

      setStats({
        totalIncome,
        totalExpense: totalPaidExpense,
        totalInvested: totalInvestedAllTime,
        currentMonthInvested,
        balance,
        cardSpending: totalCardSpending,
        predictedIncome,
        predictedExpense,
        predictedBalance
      });

      // Process Chart Data (Daily) - Only paid expenses
      const daysInMonth = end.getDate();
      const dailyData = Array.from({ length: daysInMonth }, (_, i) => ({
        day: i + 1,
        entradas: 0,
        saidas: 0
      }));

      paidIncomes.forEach((i: any) => {
        const day = parseInt(i.date.split('T')[0].split('-')[2], 10);
        if (dailyData[day - 1]) dailyData[day - 1].entradas += Number(i.amount);
      });

      paidExpenses.forEach((i: any) => {
        const day = parseInt(i.date.split('T')[0].split('-')[2], 10);
        if (dailyData[day - 1]) dailyData[day - 1].saidas += Number(i.amount);
      });

      setChartData(dailyData);

      // Process Category Data - Including Card Spending, Recurring Bills and Pending Expenses
      const catMap: Record<string, number> = {};
      
      // 1. Non-card PAID expenses of the calendar month
      paidExpenses
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

      // 4. Pending expenses for the month (predicted)
      pendingExpenses.forEach((e: any) => {
        const name = e.categories?.name || 'Outros';
        catMap[name] = (catMap[name] || 0) + Number(e.amount);
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
            saidas: totalPaidExpense + unpaidBillsTotal + pendingNonCardTotal + pendingCardTotal
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

      // Process Card Debt (Future Installments + Future Card Expenses)
      const debtMap: Record<string, number> = {};
      
      // 1. Process from pendingInstallments (legacy/fallback)
      pendingInstallments.forEach((inst: any) => {
        const purchase = allCardPurchases.find((p: any) => p.id === inst.purchase_id);
        if (purchase) {
          const cardId = purchase.card_id;
          debtMap[cardId] = (debtMap[cardId] || 0) + Number(inst.amount);
        }
      });

      // 2. Process from future card expenses (from the expenses table)
      creditCards.forEach((card: any) => {
        const dueDay = card.due_day || 10;
        const closingDay = card.closing_day || (dueDay > 7 ? dueDay - 7 : 1);
        const cardCycleEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), closingDay, 23, 59, 59);
        const cardCycleEndStr = format(cardCycleEnd, 'yyyy-MM-dd');

        // Filter paid and pending expenses for this card that fall after the current billing cycle
        const futurePaid = allPaidExpenses.filter((e: any) => {
          const expenseDateStr = e.date.split('T')[0];
          return e.credit_card_id === card.id && expenseDateStr > cardCycleEndStr;
        });

        const futurePending = pendingExpenses.filter((e: any) => {
          const expenseDateStr = e.date.split('T')[0];
          return e.credit_card_id === card.id && expenseDateStr > cardCycleEndStr;
        });

        const futureTotal = [...futurePaid, ...futurePending].reduce((sum: number, e: any) => sum + Number(e.amount), 0);
        debtMap[card.id] = (debtMap[card.id] || 0) + futureTotal;
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

      // Calculate Category Budgets
      const budgets: Record<string, number> = {};
      budgetsData.forEach((item: any) => {
        budgets[item.category_id] = Number(item.limit_amount);
      });

      const budgetExpenses = [
        // 1. Non-card PAID expenses of the calendar month
        ...paidExpenses.filter((e: any) => e.payment_method !== 'Cartão de Crédito' && e.payment_method !== 'Cartão de crédito'),
        // 2. Card expenses of the current bill cycle
        ...currentBillExpenses,
        // 3. Pending non-card expenses of the calendar month
        ...currentPendingNonCard
      ];

      const activeBudgetsData = categories
        .filter((c: any) => budgets[c.id] !== undefined)
        .map((c: any) => {
          const limit = budgets[c.id];
          const spent = budgetExpenses
            .filter((e: any) => e.category_id === c.id)
            .reduce((sum: number, e: any) => sum + Number(e.amount), 0);
          const percent = limit > 0 ? (spent / limit) * 100 : 0;
          
          return {
            id: c.id,
            name: c.name,
            limit,
            spent,
            percent
          };
        });

      setActiveBudgets(activeBudgetsData);

      console.log('fetchDashboardData: Success');
    } catch (error: any) {
      console.error('fetchDashboardData: Error', error);
      setError(handleSupabaseError(error, 'Erro ao carregar dados do dashboard.'));
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  useEffect(() => {
    console.log('Dashboard useEffect: currentDate changed', currentDate);
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
        status: 'paid',
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

  const handleConfirmExpensePayment = async (expenseId: string) => {
    try {
      const { error } = await supabase
        .from('expenses')
        .update({ 
          status: 'paid', 
          date: new Date().toISOString() // Update date to payment date for correct balance impact
        })
        .eq('id', expenseId);

      if (error) throw error;
      fetchDashboardData(true);
    } catch (error: any) {
      alert(`Erro ao confirmar pagamento: ${error.message}`);
    }
  };

  const handleConfirmIncomeReceipt = async (incomeId: string) => {
    try {
      const { error } = await supabase
        .from('incomes')
        .update({ 
          status: 'paid', 
          date: new Date().toISOString() // Update date to receipt date for correct balance impact
        })
        .eq('id', incomeId);

      if (error) throw error;
      fetchDashboardData(true);
    } catch (error: any) {
      alert(`Erro ao confirmar recebimento: ${error.message}`);
    }
  };

  const handlePayCardBill = async (bill: any) => {
    if (bill.amount <= 0) {
      alert('Esta fatura não possui gastos pendentes para pagar.');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch categories to find a suitable one (e.g. "Outros" or "Cartão de Crédito")
      const { data: categories } = await supabase
        .from('categories')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('type', 'expense');
      
      const categoryId = categories?.find((c: any) => c.name.toLowerCase().includes('outros'))?.id ||
                         categories?.find((c: any) => c.name.toLowerCase().includes('cartão'))?.id ||
                         categories?.[0]?.id;

      // 2. Insert card statement payment expense
      const { error: insertError } = await supabase.from('expenses').insert([{
        description: `Pagamento Fatura ${bill.cardName}`,
        amount: bill.amount,
        date: `${format(new Date(), 'yyyy-MM-dd')}T12:00:00`,
        category_id: categoryId,
        person_id: bill.holderId,
        payment_method: 'Pix',
        credit_card_id: bill.cardId,
        is_fixed: false,
        status: 'paid',
        user_id: user.id
      }]);
      if (insertError) throw insertError;

      // 3. Update individual expenses under this bill to 'paid' (KEEPING original dates!)
      if (bill.expenseIds && bill.expenseIds.length > 0) {
        const { error: expError } = await supabase
          .from('expenses')
          .update({ 
            status: 'paid'
          })
          .in('id', bill.expenseIds);
        if (expError) throw expError;
      }

      // 4. Update installments table
      if (bill.installmentIds && bill.installmentIds.length > 0) {
        const { error: instError } = await supabase
          .from('installments')
          .update({ status: 'paid' })
          .in('id', bill.installmentIds);
        if (instError) throw instError;
      }

      fetchDashboardData(true);
    } catch (error: any) {
      alert(`Erro ao pagar fatura: ${error.message}`);
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
          
          <div className="flex items-center bg-panel/30 backdrop-blur-md border border-white/[0.04] rounded-2xl p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
            <button 
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="p-2 hover:bg-white/[0.05] rounded-xl transition-all text-text-secondary hover:text-white cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="px-6 flex items-center gap-2 font-display font-bold min-w-[160px] justify-center text-white">
              <Calendar className="w-4 h-4 text-accent" />
              {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
            </div>
            <button 
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="p-2 hover:bg-white/[0.05] rounded-xl transition-all text-text-secondary hover:text-white cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
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
            description={`Mês atual: R$ ${stats.currentMonthInvested.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          />
          <StatCard 
            title="Saldo Atual" 
            value={`R$ ${stats.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={CheckCircle2}
            color={stats.balance >= 0 ? 'accent' : 'red'}
            description={`Previsto: R$ ${stats.predictedBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
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
                      backgroundColor: 'rgba(13, 13, 18, 0.85)', 
                      backdropFilter: 'blur(12px)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '16px',
                      boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5)'
                    }}
                    itemStyle={{ color: '#fff' }}
                    labelStyle={{ color: '#fff' }}
                    wrapperStyle={{ zIndex: 1000 }}
                    formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`}
                    cursor={{ fill: 'rgba(255,255,255,0.03)', opacity: 0.4 }}
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          <Card className="lg:col-span-2 shadow-xl shadow-black/20">
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
                            backgroundColor: 'rgba(13, 13, 18, 0.85)', 
                            backdropFilter: 'blur(12px)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '16px',
                            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5)'
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
                            backgroundColor: 'rgba(13, 13, 18, 0.85)', 
                            backdropFilter: 'blur(12px)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '16px',
                            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5)'
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

          <Card className="lg:col-span-3 shadow-xl shadow-black/20 border border-white/5">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-accent/10 rounded-2xl text-accent shadow-inner">
                  <Target className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-xl">Orçamentos por Categoria</h3>
                  <p className="text-xs text-text-secondary">Acompanhamento dos limites mensais definidos</p>
                </div>
              </div>
            </div>
            
            {activeBudgets.length === 0 ? (
              <div className="py-8 text-center text-text-secondary text-sm italic">
                Nenhum limite de orçamento configurado. Configure limites na aba de Categorias em Cadastros.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeBudgets.map((b) => {
                  let progressColor = "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.3)]";
                  let textColor = "text-green-500";
                  if (b.percent >= 90) {
                    progressColor = "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]";
                    textColor = "text-red-500";
                  } else if (b.percent >= 70) {
                    progressColor = "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]";
                    textColor = "text-amber-500";
                  }
                  
                  return (
                    <div key={b.id} className="p-4 bg-background/40 border border-border/50 rounded-2xl space-y-3 hover:border-accent/20 transition-all duration-300">
                      <div className="flex justify-between items-center text-sm font-semibold">
                        <span className="text-text font-bold">{b.name}</span>
                        <span className={`font-black ${textColor}`}>
                          {b.percent.toFixed(0)}%
                        </span>
                      </div>
                      
                      <div className="w-full bg-neutral-900/60 border border-white/5 rounded-full h-2.5 overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(b.percent, 100)}%` }}
                          transition={{ duration: 0.8 }}
                          className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                        />
                      </div>
                      
                      <div className="flex justify-between text-[11px] font-medium text-text-secondary">
                        <span>R$ {b.spent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        <span>Limite: R$ {b.limit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
                {recurringBillsReminders.length + pendingExpenses.length + cardBillReminders.length} Pendentes
              </span>
            </div>
            <div className="space-y-4">
              {recurringBillsReminders.length === 0 && pendingExpenses.length === 0 && cardBillReminders.length === 0 ? (
                <div className="py-8 text-center text-text-secondary text-sm italic">
                  Todas as contas deste mês foram pagas!
                </div>
              ) : (
                <>
                  {/* Card Bills */}
                  {cardBillReminders.map((bill) => (
                    <div key={bill.id} className="flex items-center justify-between p-4 bg-background border border-border rounded-2xl group hover:border-accent/30 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent">
                          <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold">{bill.name}</p>
                          <p className="text-xs text-text-secondary">Vence dia {bill.due_day}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="font-black text-accent">R$ {bill.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        <button 
                          onClick={() => handlePayCardBill(bill)}
                          className="p-2 bg-neutral-800 hover:bg-accent hover:text-white rounded-xl transition-all"
                          title="Pagar fatura"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {/* Pending Expenses (One-time) */}
                  {pendingExpenses.map((expense) => (
                    <div key={expense.id} className="flex items-center justify-between p-4 bg-background border border-border rounded-2xl group hover:border-yellow-500/30 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-yellow-500/10 rounded-xl flex items-center justify-center text-yellow-500">
                          <Clock className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold">{expense.description}</p>
                          <p className="text-xs text-text-secondary">Vencimento: {formatDate(expense.date)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="font-black text-yellow-500">R$ {Number(expense.amount).toLocaleString('pt-BR')}</p>
                        <button 
                          onClick={() => handleConfirmExpensePayment(expense.id)}
                          className="p-2 bg-neutral-800 hover:bg-green-500 hover:text-white rounded-xl transition-all"
                          title="Confirmar pagamento"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Recurring Bills */}
                  {recurringBillsReminders.map((bill) => (
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
                  ))}
                </>
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
                {recurringIncomesReminders.length + pendingIncomes.length} Pendentes
              </span>
            </div>
            <div className="space-y-4">
              {recurringIncomesReminders.length === 0 && pendingIncomes.length === 0 ? (
                <div className="py-8 text-center text-text-secondary text-sm italic">
                  Todas as receitas deste mês foram recebidas!
                </div>
              ) : (
                <>
                  {/* Pending Incomes (One-time) */}
                  {pendingIncomes.map((income) => (
                    <div key={income.id} className="flex items-center justify-between p-4 bg-background border border-border rounded-2xl group hover:border-yellow-500/30 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-yellow-500/10 rounded-xl flex items-center justify-center text-yellow-500">
                          <Clock className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold">{income.description}</p>
                          <p className="text-xs text-text-secondary">Recebimento: {formatDate(income.date)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="font-black text-yellow-500">R$ {Number(income.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        <button 
                          onClick={() => handleConfirmIncomeReceipt(income.id)}
                          className="p-2 bg-neutral-800 hover:bg-green-500 hover:text-white rounded-xl transition-all"
                          title="Confirmar recebimento"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Recurring Incomes */}
                  {recurringIncomesReminders.map((income) => (
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
                        <p className="font-black text-accent">R$ {income.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        <button 
                          onClick={() => handleReceiveIncome(income)}
                          className="p-2 bg-neutral-800 hover:bg-accent hover:text-white rounded-xl transition-all"
                          title="Marcar como recebido"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    </SidebarLayout>
  );
}
