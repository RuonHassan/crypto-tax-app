import { createClient } from '@supabase/supabase-js'

// Temporarily hardcoded for debugging purposes
// WARNING: These should be stored in environment variables in production
const supabaseUrl = 'https://dkdbooncywawqqmfbbll.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrZGJvb25jeXdhd3FxbWZiYmxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA5NDI3NzksImV4cCI6MjA1NjUxODc3OX0.St73lJ1rEo3lvUiNEJz8aqBMYbSyjTJQ4_s4rUdZRJg'

// Check if the credentials are available
if (!supabaseUrl) {
  console.error('Error: Supabase URL is missing.')
}

if (!supabaseAnonKey) {
  console.error('Error: Supabase Anon Key is missing.')
}

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseAnonKey) 