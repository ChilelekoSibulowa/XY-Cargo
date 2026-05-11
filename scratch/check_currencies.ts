import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function checkCurrencies() {
  const { data, error } = await supabase
    .from('currencies')
    .select('code, exchange_rate, is_default, is_active')
  
  if (error) {
    console.error(error)
    return
  }
  
  console.log(JSON.stringify(data, null, 2))
}

checkCurrencies()
