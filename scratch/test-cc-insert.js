const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qquvzecmkftzadvwvuej.supabase.co';
const supabaseAnonKey = 'sb_publishable_ooJsSpLYmtXQV59fgE3AIw_NFbi0j-k';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log('Testing insert to credit_cards with bank and bank_id...');
  // Let's find a user_id, bank_id, and holder_id (people)
  const { data: someCats } = await supabase.from('categories').select('*').limit(1);
  if (!someCats || someCats.length === 0) {
    console.log('No categories/records to get user_id.');
    return;
  }
  const userId = someCats[0].user_id;

  const { data: banks } = await supabase.from('banks').select('*').limit(1);
  const { data: people } = await supabase.from('people').select('*').limit(1);

  if (!banks || banks.length === 0 || !people || people.length === 0) {
    console.log('Please make sure at least one bank and person exist in the database.');
    return;
  }

  const bankId = banks[0].id;
  const holderId = people[0].id;

  console.log('Using:', { userId, bankId, holderId });

  // Let's test insert with ONLY allowed fields
  const { data: d1, error: e1 } = await supabase.from('credit_cards').insert([{
    name: 'Santander Test',
    bank_id: bankId,
    holder_id: holderId,
    closing_day: 15,
    due_day: 20,
    limit_amount: 1000,
    active: true,
    user_id: userId
  }]);
  console.log('Insert without "bank" field error:', e1?.message);

  // Let's test insert WITH "bank" field
  const { data: d2, error: e2 } = await supabase.from('credit_cards').insert([{
    name: 'Santander Test 2',
    bank_id: bankId,
    holder_id: holderId,
    closing_day: 15,
    due_day: 20,
    limit_amount: 1000,
    active: true,
    user_id: userId,
    bank: banks[0].name // Sending the bank text
  }]);
  console.log('Insert WITH "bank" field error:', e2?.message || 'SUCCESS!');
  
  // Cleanup test card if inserted
  if (!e2) {
    console.log('Cleaning up inserted test card...');
    await supabase.from('credit_cards').delete().eq('name', 'Santander Test 2');
  }
}
test();
