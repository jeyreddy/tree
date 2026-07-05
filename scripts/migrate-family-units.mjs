// One-time migration to the family_unit model.
//
// NON-DESTRUCTIVE: creates family_units rows and sets persons.birth_family_unit_id.
// It does NOT touch parent_id / spouse_id — those stay as a revert path until a
// later cleanup migration drops them.
//
// Run once, AFTER the Step-1 schema SQL has created the family_units table:
//   export $(grep -v '^#' .env | xargs) && node scripts/migrate-family-units.mjs
//
// Idempotent: skips any family that already has family_units rows.
//
// Convention: partner_a = male/father slot, partner_b = female/mother slot.
// A single parent lands in the slot matching their gender; the other slot is null.
// A dangling parent_id (parent not found in the family) is treated as a root — no
// birth unit assigned — matching the app's existing findRoots behaviour.

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

const mkUnitId = (familyId, n) => `fu_${familyId.split('_')[0]}_${Date.now().toString(36)}_${n}`

async function migrate() {
  const { data: families, error: famErr } = await supabase.from('families').select('id')
  if (famErr) { console.error('load families failed:', famErr.message); process.exit(1) }

  let grandUnits = 0, grandChildren = 0
  for (const fam of families) {
    const { data: existing } = await supabase.from('family_units').select('id').eq('family_id', fam.id).limit(1)
    if (existing && existing.length) { console.log(`\n[skip] ${fam.id} already has family_units — not re-migrating.`); continue }

    const { data: persons, error } = await supabase.from('persons').select('*').eq('family_id', fam.id)
    if (error) { console.error('load persons failed:', error.message); process.exit(1) }
    if (!persons.length) { console.log(`\n[skip] ${fam.id} has no persons.`); continue }

    const byId = Object.fromEntries(persons.map(p => [p.id, p]))
    const unitByPerson = {}   // personId -> the unit they are a PARTNER in
    const units = []
    let n = 0

    // 1. Couple units from bidirectional spouse pairs
    const seen = new Set()
    for (const p of persons) {
      if (!p.spouse_id || seen.has(p.id)) continue
      const s = byId[p.spouse_id]
      if (!s) continue
      seen.add(p.id); seen.add(s.id)
      const male = p.gender === 'M' ? p : (s.gender === 'M' ? s : p)
      const female = male.id === p.id ? s : p
      const id = mkUnitId(fam.id, n++)
      units.push({ id, family_id: fam.id, partner_a_id: male.id, partner_b_id: female.id, marriage_year: null, status: 'active' })
      unitByPerson[p.id] = id
      unitByPerson[s.id] = id
    }

    // 2. Single-parent units (lazy) + assign birth_family_unit_id to every child with a valid parent
    const singleUnit = {}
    const birthAssign = {}
    for (const p of persons) {
      if (!p.parent_id) continue
      const par = byId[p.parent_id]
      if (!par) { console.log(`  [dangling] ${p.name}'s parent_id ${p.parent_id} not found — treated as root.`); continue }
      let unit = unitByPerson[par.id]
      if (!unit) {
        if (!singleUnit[par.id]) {
          const id = mkUnitId(fam.id, n++)
          units.push({
            id, family_id: fam.id,
            partner_a_id: par.gender === 'M' ? par.id : null,
            partner_b_id: par.gender === 'F' ? par.id : null,
            marriage_year: null, status: 'active',
          })
          singleUnit[par.id] = id
          unitByPerson[par.id] = id
        }
        unit = singleUnit[par.id]
      }
      birthAssign[p.id] = unit
    }

    // Write units
    for (const u of units) {
      const { error: e } = await supabase.from('family_units').insert(u)
      if (e) { console.error('  insert unit failed', u.id, e.message); process.exit(1) }
    }
    // Assign birth_family_unit_id
    for (const [childId, uid] of Object.entries(birthAssign)) {
      const { error: e } = await supabase.from('persons').update({ birth_family_unit_id: uid }).eq('id', childId)
      if (e) { console.error('  assign failed', childId, e.message); process.exit(1) }
    }

    console.log(`\n=== ${fam.id}: ${units.length} units, ${Object.keys(birthAssign).length} children assigned ===`)
    units.forEach(u => console.log(`  UNIT ${u.id}  A:${byId[u.partner_a_id]?.name || '—'}  B:${byId[u.partner_b_id]?.name || '—'}`))
    Object.entries(birthAssign).forEach(([c, uid]) => {
      const u = units.find(x => x.id === uid)
      console.log(`  CHILD ${byId[c].name}  ->  A:${byId[u.partner_a_id]?.name || '—'} / B:${byId[u.partner_b_id]?.name || '—'}`)
    })
    grandUnits += units.length; grandChildren += Object.keys(birthAssign).length
  }
  console.log(`\nDONE. ${grandUnits} family_units created, ${grandChildren} children assigned a birth unit.`)
}

migrate()
