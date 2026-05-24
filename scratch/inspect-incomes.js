const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://qquvzecmkftzadvwvuej.supabase.co';
const supabaseAnonKey = 'sb_publishable_ooJsSpLYmtXQV59fgE3AIw_NFbi0j-k';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInsert() {
  const dummyUuid = '00000000-0000-0000-0000-000000000000';
  
  console.log('Testing insert with status field using dummy UUIDs...');
  const { data, error } = await supabase.from('incomes').insert([{
    description: 'Test Status Column',
    amount: 1,
    date: '2026-05-24T12:00:00',
    category_id: dummyUuid,
    person_id: dummyUuid,
    status: 'pending'
  }]).select();
  
  if (error) {
    console.log('Insert error:', error.message, 'Code:', error.code, 'Details:', error.details);
  } else {
    console.log('Insert SUCCESS! status column exists in table!', data);
    await supabase.from('incomes').delete().eq('id', data[0].id);
  }
}
testInsert();
