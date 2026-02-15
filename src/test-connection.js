import { supabase } from './supabase.js'

async function testConnection() {
  const { data, error } = await supabase
    .from('user_snapshots')
    .select('*')
    .limit(1)

  console.log('Supabase test:', { data, error })
}

testConnection()
