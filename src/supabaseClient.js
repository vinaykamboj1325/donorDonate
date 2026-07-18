import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// True only once real credentials are in .env (placeholders are ignored).
export const isConfigured =
  !!url && !!key && !url.includes('YOUR-PROJECT') && !key.includes('your-anon')

export const supabase = isConfigured ? createClient(url, key) : null
