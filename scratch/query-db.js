const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qquvzecmkftzadvwvuej.supabase.co';
const supabaseAnonKey = 'sb_publishable_ooJsSpLYmtXQV59fgE3AIw_NFbi0j-k';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkData() {
  console.log('--- Database Check ---');
  
  // 1. Fetch all expenses
  const { data: expenses, error: expErr } = await supabase.from('expenses').select('id, description, amount, date');
  if (expErr) console.error('Expenses error:', expErr.message);
  else console.log(`Expenses count: ${expenses.length}`, expenses);

  // 2. Fetch all card_purchases
  const { data: purchases, error: purErr } = await supabase.from('card_purchases').select('*');
  if (purErr) console.error('Card Purchases error:', purErr.message);
  else console.log(`Card Purchases count: ${purchases.length}`, purchases);

  // 3. Fetch all installments
  const { data: installments, error: instErr } = await supabase.from('installments').select('*');
  if (instErr) console.error('Installments error:', instErr.message);
  else console.log(`Installments count: ${installments.length}`, installments);
}

checkData();
