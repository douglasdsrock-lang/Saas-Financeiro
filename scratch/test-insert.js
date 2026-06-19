const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qquvzecmkftzadvwvuej.supabase.co';
const supabaseAnonKey = 'sb_publishable_ooJsSpLYmtXQV59fgE3AIw_NFbi0j-k';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('Fetching user...');
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error('Auth error:', authError);
    return;
  }
  console.log('User id:', user?.id || 'No user logged in');
  if (!user) {
    console.log('Please log in first or we need to sign in.');
    // Let's list the categories first
    const { data: categories, error: catError } = await supabase.from('categories').select('*').limit(5);
    console.log('Categories:', categories, 'Error:', catError?.message);
    return;
  }

  // Let's fetch one category
  const { data: categories } = await supabase.from('categories').select('*').limit(1);
  if (!categories || categories.length === 0) {
    console.log('No categories found. Cannot test budget insert.');
    return;
  }

  const catId = categories[0].id;
  console.log('Testing insert for category:', catId);

  const { data, error } = await supabase.from('category_budgets').upsert({
    category_id: catId,
    limit_amount: 100.50,
    user_id: user.id
  });

  if (error) {
    console.error('Upsert failed:');
    console.error('Message:', error.message);
    console.error('Details:', error.details);
    console.error('Code:', error.code);
    console.error('Error object:', error);
  } else {
    console.log('Upsert succeeded!', data);
  }
}
run();
