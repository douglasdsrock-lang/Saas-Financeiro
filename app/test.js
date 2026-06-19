const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('./lib/supabase-config.json', 'utf8'));
const supabase = createClient(config.url, config.anonKey);

async function test() {
  const { data, error } = await supabase.from('expenses').select('*').limit(1);
  if (error) {
    console.error('Error fetching expenses:', error);
  } else {
    console.log('Expense keys:', data.length > 0 ? Object.keys(data[0]) : 'no expenses');
  }
}
test();
