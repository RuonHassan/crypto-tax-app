import { createClient } from '@supabase/supabase-js'

// Try environment variables first, then fallback to hardcoded values for development
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY
const siteUrl = process.env.REACT_APP_SITE_URL || window.location.origin

// Check if the credentials are available
if (!supabaseUrl) {
  console.error('Error: Supabase URL is missing. Make sure REACT_APP_SUPABASE_URL is set in your environment variables.')
}

if (!supabaseAnonKey) {
  console.error('Error: Supabase Anon Key is missing. Make sure REACT_APP_SUPABASE_ANON_KEY is set in your environment variables.')
}

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    redirectTo: `${siteUrl}/app`
  }
})

// Export the configuration for debugging purposes
export const supabaseConfig = {
  url: supabaseUrl,
  hasKey: !!supabaseAnonKey,
  siteUrl
} 