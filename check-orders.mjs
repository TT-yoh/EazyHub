import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

const supabase = createClient(url, key);
async function check() { 
  const { data, error } = await supabase.from('orders').select('*').limit(1); 
  console.log(data ? Object.keys(data[0] || {}) : error); 
} 
check();
