const { createClient } = require('@supabase/supabase-js');

const supabaseUrl  = process.env.SUPABASE_URL;
const supabaseKey  = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('[supabase] SUPABASE_URL o SUPABASE_ANON_KEY no definidas — sync desactivado');
}

const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

module.exports = { supabase };
