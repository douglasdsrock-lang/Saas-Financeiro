const { createClient } = require('@supabase/supabase-js');
const { startOfMonth, endOfMonth, format, subDays } = require('date-fns');

const supabaseUrl = 'https://qquvzecmkftzadvwvuej.supabase.co';
const supabaseAnonKey = 'sb_publishable_ooJsSpLYmtXQV59fgE3AIw_NFbi0j-k';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debug() {
  console.log('Fetching user...');
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  if (!user) {
    // If not logged in, let's look at categories and budgets generally (if any exist, or if we can find a user_id)
    console.log('No user logged in. Fetching some categories to find a user_id...');
    const { data: someCats } = await supabase.from('categories').select('*').limit(5);
    if (!someCats || someCats.length === 0) {
      console.log('No categories in DB.');
      return;
    }
    const userId = someCats[0].user_id;
    console.log('Found user_id:', userId);
    await runDebugForUser(userId);
  } else {
    await runDebugForUser(user.id);
  }
}

async function runDebugForUser(userId) {
  const currentDate = new Date();
  const start = startOfMonth(currentDate);
  const end = endOfMonth(currentDate);
  const startStr = format(start, 'yyyy-MM-dd');
  const endStr = format(end, 'yyyy-MM-dd');
  const extendedStartStr = format(subDays(start, 45), 'yyyy-MM-dd');

  console.log('Date range:', { startStr, endStr, extendedStartStr });

  const [categories, budgets, paidExpenses, pendingExpenses] = await Promise.all([
    supabase.from('categories').select('*').eq('user_id', userId),
    supabase.from('category_budgets').select('*').eq('user_id', userId),
    supabase.from('expenses').select('*').eq('user_id', userId).eq('status', 'paid').gte('date', extendedStartStr),
    supabase.from('expenses').select('*').eq('user_id', userId).eq('status', 'pending')
  ]);

  console.log('Categories count:', categories.data?.length || 0);
  console.log('Budgets count:', budgets.data?.length || 0);
  console.log('Paid expenses count (extended):', paidExpenses.data?.length || 0);
  console.log('Pending expenses count:', pendingExpenses.data?.length || 0);

  console.log('Budgets:', budgets.data);

  // Let's print categories that have budgets
  const budgetedCats = categories.data?.filter(c => budgets.data?.some(b => b.category_id === c.id));
  console.log('Budgeted Categories:', budgetedCats);

  const isStatementPayment = (e) => 
    e.credit_card_id !== null && 
    e.payment_method !== 'Cartão de Crédito' && 
    e.payment_method !== 'Cartão de crédito';

  // targetMonthExpenses logic from dashboard
  const targetMonthExpenses = [
    ...(paidExpenses.data || []).filter((e) => {
      const expenseDateStr = e.date.split('T')[0];
      const inRange = expenseDateStr >= startStr && expenseDateStr <= endStr;
      const isStmt = isStatementPayment(e);
      return inRange && !isStmt;
    }),
    ...(pendingExpenses.data || []).filter((e) => {
      const expenseDateStr = e.date.split('T')[0];
      return expenseDateStr >= startStr && expenseDateStr <= endStr;
    })
  ];

  console.log('Target Month Expenses count:', targetMonthExpenses.length);

  // Let's print all targetMonthExpenses
  console.log('Target Month Expenses details (amount, category_id, payment_method, credit_card_id, date, description):');
  targetMonthExpenses.forEach(e => {
    console.log(`- R$ ${e.amount} | Cat ID: ${e.category_id} | Method: ${e.payment_method} | Date: ${e.date} | Desc: ${e.description}`);
  });

  // Calculate spent per budgeted category
  budgetedCats?.forEach(c => {
    const budget = budgets.data.find(b => b.category_id === c.id);
    const spentExpenses = targetMonthExpenses.filter(e => e.category_id === c.id);
    const spent = spentExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    console.log(`Category: ${c.name} (${c.id}) | Limit: R$ ${budget.limit_amount} | Spent: R$ ${spent} (Count: ${spentExpenses.length})`);
  });
}

debug();
