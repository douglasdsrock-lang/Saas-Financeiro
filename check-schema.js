const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qquvzecmkftzadvwvuej.supabase.co';
const supabaseAnonKey = 'sb_publishable_ooJsSpLYmtXQV59fgE3AIw_NFbi0j-k';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log('Testing if budgets table exists...');
  const { data, error } = await supabase.from('budgets').select('*').limit(1);
  if (error) {
    console.log('Result for budgets table:', error.message, `(code: ${error.code})`);
  } else {
    console.log('Result for budgets table: SUCCESS! Found table.');
  }
}
test();
