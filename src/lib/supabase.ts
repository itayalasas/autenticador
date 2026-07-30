import { createClient } from '@supabase/supabase-js'
import { envConfigService } from '../services/envConfigService'

let supabaseInstance: any = null
let isInitialized = false

function initializeSupabase() {
  if (isInitialized && supabaseInstance) {
    return supabaseInstance
  }

  if (!envConfigService.isLoaded()) {
    return null
  }

  const supabaseUrl = envConfigService.getVariable('VITE_SUPABASE_URL') || ''
  const supabaseAnonKey = envConfigService.getVariable('VITE_SUPABASE_ANON_KEY') || ''

  const isSupabaseConfigured = supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('placeholder') &&
    !supabaseAnonKey.includes('placeholder') &&
    supabaseUrl !== 'https://your-project-id.supabase.co' &&
    supabaseAnonKey !== 'your_supabase_anon_key_here'

  if (!isSupabaseConfigured) {
    return null
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey)
  isInitialized = true
  return supabaseInstance
}

function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = initializeSupabase()
  }

  if (!supabaseInstance) {
    throw new Error('Supabase client not initialized. Environment configuration may not be loaded.')
  }

  return supabaseInstance
}

export const signUp = async (email: string, password: string, name: string) => {
  const client = getSupabaseClient()

  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        role: 'admin'
      },
      emailRedirectTo: window.location.origin
    }
  })

  return { data, error }
}

export const signIn = async (email: string, password: string) => {
  const client = getSupabaseClient()

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password
  })

  const { authLogService } = await import('../services/authLogService')
  if (error) {
    await authLogService.logLogin('', email, false, error.message)
  } else if (data.user) {
    await authLogService.logLogin(data.user.id, email, true)
  }

  return { data, error }
}

export const signOut = async () => {
  const client = getSupabaseClient()

  const { data: { user } } = await client.auth.getUser()
  const { error } = await client.auth.signOut()

  if (!error && user) {
    const { authLogService } = await import('../services/authLogService')
    await authLogService.logLogout(user.id, user.email || 'unknown')
  }

  return { error }
}

export const getCurrentUser = async () => {
  const client = getSupabaseClient()
  const { data: { user }, error } = await client.auth.getUser()
  return { user, error }
}

export const supabase = new Proxy({} as any, {
  get(target, prop) {
    const client = getSupabaseClient()
    return client[prop]
  }
})
