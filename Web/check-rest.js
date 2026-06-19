const https = require('https');

const supabaseUrl = 'https://qquvzecmkftzadvwvuej.supabase.co';
const supabaseAnonKey = 'sb_publishable_ooJsSpLYmtXQV59fgE3AIw_NFbi0j-k';

const url = `${supabaseUrl}/rest/v1/`;

const options = {
  method: 'GET',
  headers: {
    'apikey': supabaseAnonKey,
    'Authorization': `Bearer ${supabaseAnonKey}`
  }
};

const req = https.request(url, options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Status code:', res.statusCode);
    try {
      const json = JSON.parse(data);
      console.log('Tables:', Object.keys(json.paths).filter(p => !p.includes('{')));
      console.log('Category definitions:', json.definitions.categories);
    } catch (e) {
      console.log('Response raw text length:', data.length);
      console.log('Error parsing:', e);
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e);
});

req.end();
