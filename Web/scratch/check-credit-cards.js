const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qquvzecmkftzadvwvuej.supabase.co';
const supabaseAnonKey = 'sb_publishable_ooJsSpLYmtXQV59fgE3AIw_NFbi0j-k';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log('Testing credit_cards columns...');
  // Let's try to query credit_cards
  const { data, error } = await supabase.from('credit_cards').select('*').limit(1);
  if (error) {
    console.error('Error querying credit_cards:', error);
  } else {
    console.log('Credit cards structure:', data);
    // Let's try select bank and bank_id to see what exists
    const { data: d1, error: e1 } = await supabase.from('credit_cards').select('id, bank_id').limit(1);
    console.log('bank_id query error:', e1?.message || 'None');
    
    const { data: d2, error: e2 } = await supabase.from('credit_cards').select('id, bank').limit(1);
    console.log('bank query error:', e2?.message || 'None');
  }
}
check();
