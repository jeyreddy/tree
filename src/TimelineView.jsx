import { useState } from 'react'

const CLAN_COLORS = ['#C4A35A', '#6B8E6B', '#5C7FB5', '#9B6BA0', '#C97B5D', '#7BAAAA', '#A0522D', '#708090']

function titleCase(s) {
  if (!s) return ''
  return s.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}
function getClanColor(clan, allClans) {
  if (!clan) return '#ddd'
  const idx = allClans.indexOf(titleCase(clan))
  return idx >= 0 ? CLAN_COLORS[idx % CLAN_COLORS.length] : '#ddd'
}

const TYPE = {
  born:    { icon: '●', color: '#5B7553' },
  died:    { icon: '✝', color: '#888' },
  married: { icon: '♥', color: '#C97B5D' },
  added:   { icon: '＋', color: '#378ADD' },
}

// Derive events purely from already-populated person fields — no manual event entry.
function buildEvents(persons, includeActivity) {
  const events = []
  persons.forEach(p => {
    if (p.birthYear) events.push({ key: `b-${p.id}`, type: 'born', year: p.birthYear, person: p, ts: p.birthYear })
    if (p.deathYear) events.push({ key: `d-${p.id}`, type: 'died', year: p.deathYear, person: p, ts: p.deathYear })
  })
  // Marriages: one event per couple, dated by the earlier birth year of the pair
  const seen = new Set()
  persons.forEach(p => {
    if (!p.spouseId) return
    const key = [p.id, p.spouseId].sort().join('|')
    if (seen.has(key)) return
    const sp = persons.find(x => x.id === p.spouseId)
    if (!sp) return
    seen.add(key)
    const years = [p.birthYear, sp.birthYear].filter(Boolean)
    if (years.length === 0) return
    events.push({ key: `m-${key}`, type: 'married', year: Math.min(...years), person: p, spouse: sp, ts: Math.min(...years) })
  })
  if (includeActivity) {
    persons.forEach(p => {
      if (!p.created_at) return
      const d = new Date(p.created_at)
      if (isNaN(d)) return
      events.push({ key: `a-${p.id}`, type: 'added', year: d.getFullYear(), person: p, ts: d.getTime() })
    })
  }
  // Newest first
  return events.sort((a, b) => b.ts - a.ts)
}

function EventAvatar({ person, color }) {
  if (person?.photoUrl) {
    return <img src={person.photoUrl} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid #eee' }} />
  }
  const initial = (person?.name || '?').trim().charAt(0).toUpperCase()
  return (
    <div style={{ width: 24, height: 24, borderRadius: '50%', background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
      {initial}
    </div>
  )
}

function describe(e) {
  switch (e.type) {
    case 'born':    return <><strong>{e.person.name}</strong> born</>
    case 'died':    return <><strong>{e.person.name}</strong> passed away</>
    case 'married': return <><strong>{e.person.name}</strong> & <strong>{e.spouse.name}</strong> married</>
    case 'added':   return <><strong>{e.person.name}</strong> added to tree{e.person.addedBy ? ` by ${e.person.addedBy}` : ''}</>
    default:        return e.person.name
  }
}

export default function TimelineView({ persons, setSel, onContextMenu }) {
  const [showActivity, setShowActivity] = useState(false)
  const allClans = [...new Set(persons.map(p => titleCase(p.clan)).filter(Boolean))].sort()

  const hasLifeEvents = persons.some(p => p.birthYear || p.deathYear)
  const events = buildEvents(persons, showActivity)

  if (!hasLifeEvents) {
    const missing = persons.filter(p => !p.birthYear).length
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '58px 16px 24px', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🕰️</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#666', marginBottom: 6 }}>Add birth years to see your family timeline</div>
          <div style={{ fontSize: 13, color: '#999' }}>
            {missing} of {persons.length} {persons.length === 1 ? 'person is' : 'people are'} missing a birth year. Add years in a person's Basic tab.
          </div>
        </div>
      </div>
    )
  }

  // Group by decade, newest decade first (events already sorted newest-first)
  const groups = []
  let current = null
  events.forEach(e => {
    const decade = Math.floor(e.year / 10) * 10
    if (!current || current.decade !== decade) {
      current = { decade, items: [] }
      groups.push(current)
    }
    current.items.push(e)
  })

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '58px 16px 24px', background: '#fafafa' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#888', cursor: 'pointer', marginBottom: 10, justifyContent: 'flex-end' }}>
          <input type="checkbox" checked={showActivity} onChange={e => setShowActivity(e.target.checked)}
            style={{ width: 15, height: 15, accentColor: '#378ADD', cursor: 'pointer' }} />
          Show tree activity
        </label>

        {groups.map(g => (
          <div key={g.decade}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 8px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#bbb', letterSpacing: 0.5 }}>{g.decade}s</div>
              <div style={{ flex: 1, height: 1, background: '#e6e6e6' }} />
            </div>

            {g.items.map(e => {
              const clanColor = getClanColor(e.person.clan, allClans)
              const t = TYPE[e.type]
              return (
                <div key={e.key} style={{ display: 'flex', gap: 12, padding: '5px 0', alignItems: 'stretch' }}>
                  <div style={{ width: 52, flexShrink: 0, textAlign: 'right', fontSize: 18, fontWeight: 700, color: '#333', fontVariantNumeric: 'tabular-nums', paddingTop: 8 }}>
                    {e.year}
                  </div>
                  <div
                    onClick={() => setSel?.(e.person.id)}
                    onContextMenu={ev => { ev.preventDefault(); onContextMenu?.(e.person.id, ev) }}
                    style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #eee', borderLeft: `3px solid ${clanColor}`, borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }}>
                    <EventAvatar person={e.person} color={clanColor} />
                    <span style={{ color: t.color, fontSize: 14, flexShrink: 0, width: 16, textAlign: 'center' }}>{t.icon}</span>
                    <span style={{ fontSize: 13, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{describe(e)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
