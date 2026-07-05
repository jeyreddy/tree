// family_unit projection layer.
//
// family_units is the source of truth for who-is-married-to-whom and who-are-a-child's-
// parents. This module projects that model onto each person object as parentId / spouseId /
// parents so the existing views keep working unchanged, while parent_id / spouse_id columns
// are no longer read or written. Children point to a birth_family_unit_id (a couple or a
// single parent), never to one person.

export const makeUnitId = () => `fu_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`

// The unit a person is a partner in (their couple / single-parent unit). First match if
// somehow multiple (remarriage). Used when placing a new child under a couple.
export function unitOfPartner(personId, units) {
  return units.find(u => u.partner_a_id === personId || u.partner_b_id === personId) || null
}

// Enriches RowToPerson objects with derived relationship fields projected from family_units.
// - spouseId  : primary spouse (the other partner in their first unit)   [compat, singular]
// - spouseIds : every spouse across all their units                       [remarriage-capable]
// - fatherId / motherId : partner_a / partner_b of their birth unit
// - parentId  : primary parent (father preferred, else single mother)     [compat, singular]
// - parentIds : both parents
// - birthUnitId / partnerUnitIds
export function enrichPersons(persons, units) {
  const unitById = Object.fromEntries(units.map(u => [u.id, u]))
  return persons.map(p => {
    const partnerUnits = units.filter(u => u.partner_a_id === p.id || u.partner_b_id === p.id)
    const spouseIds = partnerUnits
      .map(u => (u.partner_a_id === p.id ? u.partner_b_id : u.partner_a_id))
      .filter(Boolean)
    const birthUnit = p.birth_family_unit_id ? unitById[p.birth_family_unit_id] : null
    const fatherId = birthUnit ? (birthUnit.partner_a_id || null) : null
    const motherId = birthUnit ? (birthUnit.partner_b_id || null) : null
    return {
      ...p,
      spouseId: spouseIds[0] || null,
      spouseIds,
      fatherId,
      motherId,
      parentId: fatherId || motherId || null,
      parentIds: [fatherId, motherId].filter(Boolean),
      birthUnitId: p.birth_family_unit_id || null,
      partnerUnitIds: partnerUnits.map(u => u.id),
    }
  })
}
