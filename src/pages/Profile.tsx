import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Profile() {
  const navigate = useNavigate()
  // Removed unused loading state
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [location, setLocation] = useState('')
  const [email, setEmail] = useState('')
  const [userId, setUserId] = useState('')

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login'); return; }

    setUserId(user.id)
    setEmail(user.email || '')

    const { data: profile } = await supabase
      .from('customers')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (profile) {
      setName(profile.name || '')
      setPhone(profile.phone || '')
      setLocation(profile.location || '')
    }
    // Loading state removed
  }

  const saveProfile = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('customers')
      .upsert({
        id: userId,
        email: email,
        name: name,
        phone: phone,
        location: location,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })

    if (error) alert('Error: ' + error.message)
    else alert('Profile updated!')
    setSaving(false)
  }

  return (
    <div className="max-w-md mx-auto pb-20">
      <h1 className="text-2xl font-bold mb-6">My Profile</h1>
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div><label className="block text-sm font-medium mb-1">Email</label><input type="email" value={email} disabled className="input bg-gray-100" /></div>
        <div><label className="block text-sm font-medium mb-1">Full Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input" /></div>
        <div><label className="block text-sm font-medium mb-1">Phone Number</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" /></div>
        <div><label className="block text-sm font-medium mb-1">Delivery Location</label><input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="input" /></div>
        <button onClick={saveProfile} disabled={saving} className="btn-primary w-full">{saving ? 'Saving...' : 'Update Profile'}</button>
        <button onClick={async () => { await supabase.auth.signOut(); navigate('/login'); }} className="w-full border border-red-600 text-red-600 py-2 rounded-lg">Logout</button>
      </div>
    </div>
  )
}