import { useState } from 'react'
import { getCoupleChildren } from './SVGTree'

function TreeRow({ id, depth, persons, sel, setSel, expanded, setExpanded, onContextMenu }) {
  const person = persons.find(p => p.id === id)
  if (!person) return null
  const spouse = person.spouseId ? persons.find(p => p.id === person.spouseId) : null
  const kids = getCoupleChildren(person.id, spouse?.id, persons)
  const hasKids = kids.length > 0
  const isOpen = expanded.has(id)
  const isDead = person.status === 'deceased'
  const isSelected = sel === id || (spouse && sel === spouse.id)

  const toggle = e => {
    e.stopPropagation()
    setExpanded(prev => {
      const n = new Set(prev)
      isOpen ? n.delete(id) : n.add(id)
      return n
    })
  }

  return (
    <div>
      <div
        className={`tree-node ${isSelected ? 'selected' : ''} ${isDead ? 'deceased' : ''}`}
        style={{ paddingLeft: 10 + depth * 16 }}
        onClick={() => setSel(id)}
        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); onContextMenu?.(id, e) }}
      >
        <span onClick={toggle} style={{ width: 14, fontSize: 10, color: '#bbb', cursor: hasKids ? 'pointer' : 'default', textAlign: 'center', flexShrink: 0 }}>
          {hasKids ? (isOpen ? '▾' : '▸') : '·'}
        </span>
        <span style={{ fontSize: 13, fontWeight: isSelected ? 700 : 500 }}>
          {(isDead ? '✝ ' : '') + person.name}{spouse ? ` & ${spouse.name}` : ''}
        </span>
      </div>
      {isOpen && kids.map(k => (
        <TreeRow key={k.id} id={k.id} depth={depth + 1} persons={persons} sel={sel} setSel={setSel}
          expanded={expanded} setExpanded={setExpanded} onContextMenu={onContextMenu} />
      ))}
    </div>
  )
}

function PersonLink({ id, persons, setSel }) {
  const p = persons.find(x => x.id === id)
  if (!p) return null
  return (
    <span onClick={() => setSel(id)} style={{ color: '#4A6FA5', cursor: 'pointer', fontWeight: 600 }}>
      [[{p.name}]]
    </span>
  )
}

function PersonNote({ person, persons, referrals, setSel, onContextMenu, setTagFilter }) {
  const spouse = person.spouseId ? persons.find(p => p.id === person.spouseId) : null
  const parent = person.parentId ? persons.find(p => p.id === person.parentId) : null
  const kids = getCoupleChildren(person.id, spouse?.id, persons)
  const siblings = parent ? getCoupleChildren(parent.id, parent.spouseId, persons).filter(s => s.id !== person.id) : []
  const isDead = person.status === 'deceased'

  const tags = [
    person.clan, person.gotra, person.location, ...(person.languages || []),
  ].filter(Boolean)

  const knowsAbout = referrals.filter(r => r.source_person_id === person.id)
  const knownBy = referrals.filter(r => r.target_person_id === person.id)

  const props = [
    ['Status', isDead ? 'Deceased' : 'Living'],
    ['Gender', person.gender === 'M' ? 'Male' : 'Female'],
    person.birthYear && ['Born', person.birthYear],
    isDead && person.deathYear && ['Died', person.deathYear],
    person.nativePlace && ['Native place', person.nativePlace],
    person.phone && ['Phone', person.phone],
    person.occupation?.role && ['Occupation', [person.occupation.role, person.occupation.company].filter(Boolean).join(' at ')],
    person.role && ['Role', person.role],
    ['Verified', person.verified ? 'Yes' : 'No'],
  ].filter(Boolean)

  return (
    <div style={{ maxWidth: 640 }}>
      <h1
        onContextMenu={e => { e.preventDefault(); onContextMenu?.(person.id, e) }}
        style={{ fontSize: 24, fontWeight: 700, margin: 0, color: isDead ? '#999' : '#1a1a1a', textDecoration: isDead ? 'line-through' : 'none', cursor: 'context-menu' }}
      >
        {isDead ? '✝ ' : ''}{person.name}
      </h1>

      <div style={{ marginTop: 14, fontSize: 13, color: '#555', display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: 5, columnGap: 14 }}>
        {props.map(([k, v]) => (
          <div key={k} style={{ display: 'contents' }}>
            <div style={{ color: '#aaa' }}>{k}</div>
            <div>{v}</div>
          </div>
        ))}
      </div>

      {tags.length > 0 && (
        <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {tags.map((t, i) => (
            <span key={i} onClick={() => setTagFilter(t)}
              style={{ fontSize: 11, padding: '3px 9px', borderRadius: 12, background: '#f0f0f0', color: '#666', cursor: 'pointer' }}>
              #{t}
            </span>
          ))}
        </div>
      )}

      <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #eee' }} />

      <div style={{ fontSize: 13, lineHeight: 2 }}>
        {parent && <div>Parent: <PersonLink id={parent.id} persons={persons} setSel={setSel} /></div>}
        {spouse && <div>Spouse: <PersonLink id={spouse.id} persons={persons} setSel={setSel} /></div>}
        {siblings.length > 0 && (
          <div>Siblings: {siblings.map((s, i) => <span key={s.id}>{i > 0 && ', '}<PersonLink id={s.id} persons={persons} setSel={setSel} /></span>)}</div>
        )}
        {kids.length > 0 && (
          <div>Children: {kids.map((c, i) => <span key={c.id}>{i > 0 && ', '}<PersonLink id={c.id} persons={persons} setSel={setSel} /></span>)}</div>
        )}
      </div>

      {person.notes && (
        <>
          <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #eee' }} />
          <p style={{ fontSize: 13, color: '#444', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{person.notes}</p>
        </>
      )}

      {(knowsAbout.length > 0 || knownBy.length > 0) && (
        <>
          <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #eee' }} />
          <div style={{ fontSize: 11, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', marginBottom: 8 }}>Linked from</div>
          <div style={{ fontSize: 13, lineHeight: 1.9 }}>
            {knowsAbout.map(r => (
              <div key={r.id} style={{ color: '#777' }}>
                → knows about <PersonLink id={r.target_person_id} persons={persons} setSel={setSel} />
                {r.note && <span style={{ color: '#bbb' }}> — {r.note}</span>}
              </div>
            ))}
            {knownBy.map(r => (
              <div key={r.id} style={{ color: '#777' }}>
                ← <PersonLink id={r.source_person_id} persons={persons} setSel={setSel} /> knows about this
                {r.note && <span style={{ color: '#bbb' }}> — {r.note}</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function ExplorerView({ persons, sel, setSel, rootIds, expanded, setExpanded, referrals = [], onContextMenu, onAddRoot }) {
  const [tagFilter, setTagFilter] = useState(null)
  const person = sel ? persons.find(p => p.id === sel) : null

  const tagMatches = tagFilter
    ? persons.filter(p => [p.clan, p.gotra, p.location, ...(p.languages || [])].includes(tagFilter))
    : null

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0, paddingTop: 46 }}>
      <div style={{ width: 280, flexShrink: 0, borderRight: '1px solid #eee', overflowY: 'auto', padding: '8px 6px', background: '#fcfcfc' }}>
        {tagFilter ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px 8px' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase' }}>#{tagFilter}</span>
              <span onClick={() => setTagFilter(null)} style={{ cursor: 'pointer', fontSize: 12, color: '#bbb' }}>✕</span>
            </div>
            {tagMatches.map(p => (
              <div key={p.id} className={`tree-node ${sel === p.id ? 'selected' : ''} ${p.status === 'deceased' ? 'deceased' : ''}`}
                onClick={() => setSel(p.id)}
                onContextMenu={e => { e.preventDefault(); e.stopPropagation(); onContextMenu?.(p.id, e) }}>
                <span style={{ width: 14, flexShrink: 0 }} />
                <span style={{ fontSize: 13 }}>{(p.status === 'deceased' ? '✝ ' : '') + p.name}</span>
              </div>
            ))}
          </>
        ) : (
          <>
            {rootIds.map(id => (
              <TreeRow key={id} id={id} depth={0} persons={persons} sel={sel} setSel={setSel}
                expanded={expanded} setExpanded={setExpanded} onContextMenu={onContextMenu} />
            ))}
            {onAddRoot && (
              <div onClick={onAddRoot} style={{ margin: '10px 8px', padding: '6px 8px', fontSize: 11, color: '#bbb', border: '1.5px dashed #ddd', borderRadius: 6, cursor: 'pointer', textAlign: 'center' }}>
                + Root
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 40px', background: '#fff' }}>
        {!person ? (
          <div style={{ color: '#bbb', fontSize: 13 }}>Select a person on the left to view their record.</div>
        ) : (
          <PersonNote person={person} persons={persons} referrals={referrals} setSel={setSel}
            onContextMenu={onContextMenu} setTagFilter={setTagFilter} />
        )}
      </div>
    </div>
  )
}
