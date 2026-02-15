import { supabase } from './supabase.js'

// Sign up a new test user
export async function testSignUp(email = 'test@test.com', password = '123456') {
  const { data, error } = await supabase.auth.signUp({ email, password })
  console.log('Sign up:', { data, error })
  return { data, error }
}

// Sign in an existing user
export async function testSignIn(email = 'test@test.com', password = '123456') {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  console.log('Sign in:', { data, error })
  return { data, error }
}

// Expose to browser console for manual testing
window.testSignUp = testSignUp
window.testSignIn = testSignIn
