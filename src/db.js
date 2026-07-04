import { supabase } from './supabase'

function reportDbError(action, error) {
  console.error(`[db] ${action} failed:`, error)
  alert(`Couldn't save — ${action} failed:\n${error.message}\n\nYour change was NOT saved. Please retry or report this.`)
}

export const db = {
  async getFamilies() {
    const { data, error } = await supabase.from('families').select('*').order('created_at', { ascending: false })
    if (error) reportDbError('load families', error)
    return data || []
  },

  async createFamily(id, name) {
    const { error } = await supabase.from('families').insert({ id, name })
    if (error) reportDbError('create family', error)
  },

  async getPersons(familyId) {
    const { data, error } = await supabase.from('persons').select('*').eq('family_id', familyId).order('sort_order')
    if (error) reportDbError('load family members', error)
    return data || []
  },

  async upsertPerson(person) {
    person.updated_at = new Date().toISOString()
    const { error } = await supabase.from('persons').upsert(person)
    if (error) reportDbError('save person', error)
  },

  async deletePerson(id) {
    const { error } = await supabase.from('persons').delete().eq('id', id)
    if (error) reportDbError('delete person', error)
  },

  async updatePerson(id, fields) {
    const { error } = await supabase.from('persons').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) reportDbError('update person', error)
  },

  async updateFamily(id, fields) {
    const { error } = await supabase.from('families').update(fields).eq('id', id)
    if (error) reportDbError('update family', error)
  },

  // Uploads a compressed photo to the public "photos" bucket at {familyId}/{personId}.{ext},
  // overwriting any existing one. Returns a cache-busted public URL, or null on failure.
  async uploadPhoto(familyId, personId, ext, blob) {
    const path = `${familyId}/${personId}.${ext}`
    const { error } = await supabase.storage.from('photos').upload(path, blob, { upsert: true, contentType: blob.type || 'image/jpeg' })
    if (error) { reportDbError('upload photo', error); return null }
    const { data } = supabase.storage.from('photos').getPublicUrl(path)
    return `${data.publicUrl}?t=${Date.now()}`
  },

  async getReferrals(familyId) {
    const { data, error } = await supabase.from('referrals').select('*').eq('family_id', familyId)
    if (error) reportDbError('load referrals', error)
    return data || []
  },

  async addReferral(referral) {
    const { error } = await supabase.from('referrals').insert(referral)
    if (error) reportDbError('add referral', error)
  },

  async deleteReferral(id) {
    const { error } = await supabase.from('referrals').delete().eq('id', id)
    if (error) reportDbError('delete referral', error)
  },

  async getViews(familyId) {
    const { data, error } = await supabase.from('person_views').select('*').eq('family_id', familyId)
    if (error) reportDbError('load views', error)
    return data || []
  },

  async addView(view) {
    const { error } = await supabase.from('person_views').insert(view)
    if (error) reportDbError('add view', error)
  },

  async getDisputes(familyId) {
    const { data, error } = await supabase.from('disputes').select('*').eq('family_id', familyId).order('created_at', { ascending: false })
    if (error) reportDbError('load disputes', error)
    return data || []
  },

  async addDispute(dispute) {
    const { error } = await supabase.from('disputes').insert(dispute)
    if (error) reportDbError('add dispute', error)
  },

  async resolveDispute(id, resolvedBy, note) {
    const { error } = await supabase.from('disputes').update({ status: 'resolved', resolved_by: resolvedBy, resolution_note: note, resolved_at: new Date().toISOString() }).eq('id', id)
    if (error) reportDbError('resolve dispute', error)
  },
}
