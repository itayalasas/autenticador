import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Declare variables at module level
let supabase: any
let signUp: (email: string, password: string, name: string) => Promise<any>
let signIn: (email: string, password: string) => Promise<any>
let signOut: () => Promise<any>
let getCurrentUser: () => Promise<any>

// Check if Supabase is properly configured
const isSupabaseConfigured = supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('placeholder') && 
  !supabaseAnonKey.includes('placeholder') &&
  supabaseUrl !== 'https://your-project-id.supabase.co' &&
  supabaseAnonKey !== 'your_supabase_anon_key_here'

if (!isSupabaseConfigured) {
  console.warn('⚠️ Supabase not configured. Using mock client for development.')
  
  // Create a mock client that will show helpful error messages
  const mockClient = {
    auth: {
      signUp: () => Promise.reject(new Error('Supabase not configured. Please click the Supabase button in settings to configure.')),
      signInWithPassword: () => Promise.reject(new Error('Supabase not configured. Please click the Supabase button in settings to configure.')),
      signOut: () => Promise.reject(new Error('Supabase not configured. Please click the Supabase button in settings to configure.')),
      getUser: () => Promise.reject(new Error('Supabase not configured. Please click the Supabase button in settings to configure.')),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } })
        })
      }),
      insert: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
      update: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
      delete: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } })
    })
  }
  
  // Assign mock implementations
  supabase = mockClient
  
  signUp = async (email: string, password: string, name: string) => {
    throw new Error('❌ Supabase not configured. Please click the Supabase button in settings to configure.')
  }
  
  signIn = async (email: string, password: string) => {
    throw new Error('❌ Supabase not configured. Please click the Supabase button in settings to configure.')
  }
  
  signOut = async () => {
    throw new Error('❌ Supabase not configured. Please click the Supabase button in settings to configure.')
  }
  
  getCurrentUser = async () => {
    throw new Error('❌ Supabase not configured. Please click the Supabase button in settings to configure.')
  }
} else {
  // Create real Supabase client
  supabase = createClient(supabaseUrl, supabaseAnonKey)
  
  // Auth helpers
  signUp = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role: 'admin'
        }
      }
    })
    return { data, error }
  }
  
  signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  }
  
  signOut = async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  }
  
  getCurrentUser = async () => {
    const { data: { user }, error } = await supabase.auth.getUser()
    return { user, error }
  }
}

// Export all variables at module level
export { supabase, signUp, signIn, signOut, getCurrentUser }