import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://plmwckgshtxwgvwmbsvq.supabase.co'
const supabaseAnonKey = 'sb_publishable_H60EYC6LxlxbtMWUmUhLWw_Jq0oR2ew'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function elevate() {
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'agent_test_eazyhub@example.com',
    password: 'password123'
  })
  
  if (authErr) {
    console.error("Login failed", authErr)
    return
  }
  
  const userId = authData.user.id
  console.log("Logged in, user ID is", userId)
  
  const { error: insertErr } = await supabase
    .from('admin_users')
    .upsert({
      id: userId,
      role: 'super_admin',
      company_id: 3
    })
    
  if (insertErr) {
    console.error("Failed to insert into admin_users", insertErr)
  } else {
    console.log("Successfully elevated agent_test_eazyhub@example.com to super_admin!")
  }
}

elevate()
