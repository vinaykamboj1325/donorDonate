import { supabase } from './supabaseClient'

// --- Registration ------------------------------------------------------------
export async function registerDonor(p) {
  const { data, error } = await supabase.rpc('register_donor', {
    p_name: p.name.trim(),
    p_blood_group: p.blood_group,
    p_donor_type: p.donor_type,
    p_city: p.city.trim(),
    p_area: p.area.trim(),
    p_phone: p.phone.trim(),
    p_pin: p.pin.trim(),
  })
  if (error) throw error
  return data
}

// --- Search (never returns phone) --------------------------------------------
export async function searchDonors({ bloodGroup, city, area, donorType, onlyAvailable }) {
  let q = supabase
    .from('donors')
    .select('id, name, blood_group, donor_type, city, area, available, last_available_at')
    .order('available', { ascending: false })
    .order('last_available_at', { ascending: false })
    .limit(50)

  if (bloodGroup) q = q.eq('blood_group', bloodGroup)
  if (city) q = q.ilike('city', `%${city.trim()}%`)
  if (area) q = q.ilike('area', `%${area.trim()}%`)
  if (onlyAvailable) q = q.eq('available', true)
  if (donorType === 'blood') q = q.in('donor_type', ['blood', 'both'])
  else if (donorType === 'plasma') q = q.in('donor_type', ['plasma', 'both'])

  const { data, error } = await q
  if (error) throw error
  return data
}

// --- Request a donor (donor phone stays private) -----------------------------
export async function createRequest(p) {
  const { data, error } = await supabase.rpc('create_request', {
    p_donor_id: p.donorId,
    p_requester_name: p.requesterName.trim(),
    p_requester_phone: p.requesterPhone.trim(),
    p_hospital: p.hospital?.trim() || null,
    p_units: Number(p.units) || 1,
    p_urgency: p.urgency,
    p_note: p.note?.trim() || null,
  })
  if (error) throw error
  return data
}

// --- Donor dashboard (phone + PIN) --------------------------------------------
export async function getMyProfile(phone, pin) {
  const { data, error } = await supabase.rpc('get_my_profile', {
    p_phone: phone.trim(),
    p_pin: pin.trim(),
  })
  if (error) throw error
  return data
}

export async function getMyRequests(phone, pin) {
  const { data, error } = await supabase.rpc('get_my_requests', {
    p_phone: phone.trim(),
    p_pin: pin.trim(),
  })
  if (error) throw error
  return data
}

export async function setAvailability(phone, pin, available) {
  const { data, error } = await supabase.rpc('set_availability', {
    p_phone: phone.trim(),
    p_pin: pin.trim(),
    p_available: available,
  })
  if (error) throw error
  return data
}

export async function updateRequestStatus(requestId, phone, pin, status) {
  const { data, error } = await supabase.rpc('update_request_status', {
    p_request_id: requestId,
    p_phone: phone.trim(),
    p_pin: pin.trim(),
    p_status: status,
  })
  if (error) throw error
  return data
}
