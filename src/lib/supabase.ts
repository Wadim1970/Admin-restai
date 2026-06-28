import { createClient } from '@supabase/supabase-js'

export const supabaseRestaurants = createClient(
  import.meta.env.VITE_SUPABASE_RESTAURANTS_URL,
  import.meta.env.VITE_SUPABASE_RESTAURANTS_ANON_KEY
)

export const supabaseWaiters = createClient(
  import.meta.env.VITE_SUPABASE_WAITERS_URL,
  import.meta.env.VITE_SUPABASE_WAITERS_ANON_KEY
)
