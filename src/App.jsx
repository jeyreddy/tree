import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import { getDisplayClan } from './SVGTree'
import { LocalGraph } from './LocalGraph'

// ── DB helpers ──
const db = {
  async getFamilies() {
    const { data } = await supabase.from('families').select('*').order('created_at', { ascending: false })
    return data || []
  },

  async createFamily(id, name) {
    await supabase.from('families').insert({ id, name })
  },

  async getPersons(familyId) {
    const { data } = await supabase.from('persons').select('*').eq('family_id', familyId).order('sort_order')
    return data || []
  },

  async upsertPerson(person) {
    person.updated_at = new Date().toISOString()
    await supabase.from('persons').upsert(person)
  },

  async deletePerson(id) {
    await supabase.from('persons').delete().eq('id', id)
  },

  async updatePerson(id, fields) {
    await supabase.from('persons').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id)
  },

  async updateFamily(id, fields) {
    await supabase.from('families').update(fields).eq('id', id)
  }
}

const LABELS = {
  telugu:  { father: 'తండ్రి',  mother: 'తల్లి',   husband: 'భర్త',     wife: 'భార్య',    son: 'కొడుకు',  daughter: 'కూతురు',  children: 'పిల్లలు',      gotra: 'గోత్రం',     languages: 'భాషలు',     addFamily: 'కుటుంబం జోడించు' },
  hindi:   { father: 'पिता',    mother: 'माता',    husband: 'पति',      wife: 'पत्नी',    son: 'बेटा',    daughter: 'बेटी',    children: 'बच्चे',        gotra: 'गोत्र',      languages: 'भाषाएं',    addFamily: 'परिवार जोड़ें' },
  tamil:   { father: 'அப்பா',  mother: 'அம்மா',  husband: 'கணவர்',   wife: 'மனைவி',  son: 'மகன்',   daughter: 'மகள்',   children: 'குழந்தைகள்', gotra: 'கோத்திரம்', languages: 'மொழிகள்',  addFamily: 'குடும்பம் சேர்' },
  kannada: { father: 'ತಂದೆ',   mother: 'ತಾಯಿ',   husband: 'ಗಂಡ',     wife: 'ಹೆಂಡತಿ', son: 'ಮಗ',    daughter: 'ಮಗಳು',  children: 'ಮಕ್ಕಳು',      gotra: 'ಗೋತ್ರ',     languages: 'ಭಾಷೆಗಳು',  addFamily: 'ಕುಟುಂಬ ಸೇರಿಸಿ' },
  english: { father: 'Father', mother: 'Mother', husband: 'Husband', wife: 'Wife',   son: 'Son',    daughter: 'Daughter', children: 'Children',     gotra: 'Gotra',     languages: 'Languages', addFamily: 'Add Family' },
}

// ════════════════════════════════════
// APP
// ════════════════════════════════════
export default function App() {
  const [screen, setScreen] = useState('loading')
  const [families, setFamilies] = useState([])
  const [fam, setFam] = useState(null)
  const [persons, setPersons] = useState([])
  const [sel, setSel] = useState(null)
  const [mode, setMode] = useState(null)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(new Set())
  const [tab, setTab] = useState('tree')

  // Boot
  useEffect(() => {
    db.getFamilies().then(f => { setFamilies(f); setScreen('home') })
  }, [])

  const openFamily = async (f) => {
    const rows = await db.getPersons(f.id)
    setPersons(rows.map(RowToPerson))
    setFam(f); setSel(null); setMode(null); setTab('tree')
    setExpanded(new Set(rows.slice(0, 15).map(r => r.id)))
    setScreen('family')
  }

  const createFamily = async (name) => {
    const id = makeId(name)
    await db.createFamily(id, name.trim())
    const f = { id, name: name.trim() }
    setFamilies(prev => [f, ...prev])
    openFamily(f)
  }

  const refresh = useCallback(async () => {
    if (!fam) return
    const rows = await db.getPersons(fam.id)
    setPersons(rows.map(RowToPerson))
  }, [fam])

  const getKids = (id) => persons.filter(p => p.parentId === id).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  const clans = [...new Set(persons.map(p => p.clan).filter(Boolean))].sort()
  const selected = sel ? persons.find(p => p.id === sel) : null
  const spouse = selected?.spouseId ? persons.find(p => p.id === selected.spouseId) : null
  const parent = selected?.parentId ? persons.find(p => p.id === selected.parentId) : null

  const savePerson = async (form) => {
    if (mode?.type === 'add') {
      const id = makeId(form.name)
      const dir = mode.dir
      const targetId = mode.parentId

      if (dir === 'spouse' && targetId) {
        form.spouseId = targetId
        await db.upsertPerson(PersonToRow({ ...form, id }, fam.id))
        await db.updatePerson(targetId, { spouse_id: id })
      } else if (dir === 'ancestor' && targetId) {
        const target = persons.find(p => p.id === targetId)
        form.generation = target.generation - 1
        form.parentId = target.parentId || null
        await db.upsertPerson(PersonToRow({ ...form, id }, fam.id))
        await db.updatePerson(targetId, { parent_id: id })
        const minGen = Math.min(...persons.map(p => p.generation), form.generation)
        if (minGen < 0) {
          for (const p of persons) {
            await db.updatePerson(p.id, { generation: p.generation + Math.abs(minGen) })
          }
          await db.updatePerson(id, { generation: form.generation + Math.abs(minGen) })
        }
      } else {
        const clickTarget = persons.find(p => p.id === targetId)
        if (clickTarget) {
          const clickSpouse = clickTarget.spouseId ? persons.find(p => p.id === clickTarget.spouseId) : null
          const bloodFather = clickTarget.gender === 'M' ? clickTarget : (clickSpouse?.gender === 'M' ? clickSpouse : clickTarget)
          form.parentId = bloodFather.id
        }
        const sibs = persons.filter(p => p.parentId === form.parentId)
        form.sortOrder = sibs.length
        await db.upsertPerson(PersonToRow({ ...form, id }, fam.id))
      }
      setSel(id)
      setExpanded(prev => { const n = new Set(prev); if (form.parentId) n.add(form.parentId); n.add(id); return n })
    } else if (mode?.type === 'edit') {
      await db.upsertPerson(PersonToRow(form, fam.id))
      setSel(form.id)
    }
    setMode(null)
    await refresh()
  }

  const deletePerson = async (id) => {
    if (getKids(id).length > 0) return alert('Move or delete children first')
    const p = persons.find(x => x.id === id)
    if (p?.spouseId) await db.updatePerson(p.spouseId, { spouse_id: null })
    await db.deletePerson(id)
    setSel(null)
    await refresh()
  }

  const toggleVerified = async (id) => {
    const p = persons.find(x => x.id === id)
    if (!p) return
    await db.updatePerson(id, { verified: !p.verified })
    await refresh()
  }

  const moveSib = async (id, dir) => {
    const p = persons.find(x => x.id === id)
    if (!p) return
    const sibs = persons.filter(x => x.parentId === p.parentId).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    const idx = sibs.findIndex(x => x.id === id)
    const si = idx + dir
    if (si < 0 || si >= sibs.length) return
    await db.updatePerson(sibs[idx].id, { sort_order: sibs[si].sortOrder })
    await db.updatePerson(sibs[si].id, { sort_order: sibs[idx].sortOrder })
    await refresh()
  }

  if (screen === 'loading') return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 16, color: '#999' }}>Loading…</div>
  if (screen === 'home') return <HomeScreen families={families} onCreate={createFamily} onSelect={openFamily} />

  // ── FAMILY SCREEN ──
  const kids = selected ? getKids(selected.id) : []
  const spouseKids = spouse ? persons.filter(c => c.parentId === spouse.id && !kids.find(k => k.id === c.id)) : []
  const allKids = [...kids, ...spouseKids].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))

  const filtered = persons.filter(p => {
    if (!search) return true
    const q = search.toLowerCase()
    return [p.name, p.clan, p.location, p.occupation?.company, p.notes].some(f => (f || '').toLowerCase().includes(q))
  })

  const REL = LABELS[fam?.language || 'english'] || LABELS.english
  const getChildLabel = (child) => child.gender === 'M' ? REL.son : REL.daughter
  const getSpouseLabel = (person) => person.gender === 'M' ? REL.wife : REL.husband
  const getParentLabel = (par) => par.gender === 'M' ? REL.father : REL.mother

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="header">
        <button className="header-back" onClick={async () => { setScreen('home'); setFamilies(await db.getFamilies()) }}>←</button>
        <div style={{ flex: 1 }}>
          <div className="header-title">{fam.name}</div>
          <div className="header-sub">{persons.length} members</div>
        </div>
        <div className="header-tabs">
          <select
            value={fam.language || 'english'}
            onChange={async e => {
              const lang = e.target.value
              setFam(f => ({ ...f, language: lang }))
              await db.updateFamily(fam.id, { language: lang })
            }}
            style={{ background: '#333', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 5, padding: '2px 4px', fontSize: 10, cursor: 'pointer', marginRight: 4 }}
          >
            <option value="telugu">తెలుగు</option>
            <option value="hindi">हिंदी</option>
            <option value="tamil">தமிழ்</option>
            <option value="kannada">ಕನ್ನಡ</option>
            <option value="english">English</option>
          </select>
          {[['tree', 'Tree'], ['export', '↓']].map(([t, l]) => (
            <button key={t} className={`header-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{l}</button>
          ))}
        </div>
      </div>

      {tab === 'tree' && (
        <div className="split" style={{ flex: 1, minHeight: 0, gridTemplateColumns: '1fr 300px' }}>
          {/* Left: chart or network */}
          <div className="split-left" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '6px 8px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search people…" style={{ marginBottom: 0, padding: '7px 10px' }} />
            </div>

            {persons.length === 0 && !search ? (
              <div className="empty" style={{ flex: 1 }}>
                <div className="empty-icon">🌱</div>
                <div className="empty-title">Start your tree</div>
                <div className="empty-sub">Add the first person — yourself or the oldest ancestor you know</div>
                <button className="btn btn-dark" onClick={() => setMode({ type: 'add', dir: 'child', parentId: null })}>+ Add first person</button>
              </div>
            ) : search ? (
              <div style={{ overflowY: 'auto', flex: 1, padding: '4px 12px 12px' }}>
                {filtered.map(p => (
                  <div key={p.id} className={`tree-node ${sel === p.id ? 'selected' : ''} ${p.status === 'deceased' ? 'deceased' : ''}`}
                    onClick={() => { setSel(p.id); setSearch('') }}>
                    <span style={{ width: 14 }} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      {(p.status === 'deceased' ? '✝ ' : '') + p.name}{p.clan ? ` (${p.clan})` : ''}
                    </span>
                    <span style={{ fontSize: 10, color: '#ccc', marginLeft: 'auto' }}>{p.location || ''}</span>
                  </div>
                ))}
              </div>
            ) : (
              <LocalGraph
                persons={persons}
                sel={sel}
                setSel={id => { setSel(id); setSearch('') }}
                clans={clans}
                REL={REL}
              />
            )}
          </div>

          {/* Right: detail / form */}
          <div className="split-right">
            {mode
              ? <PersonForm mode={mode} persons={persons} fam={fam} onSave={savePerson} onCancel={() => setMode(null)} />
              : <DetailPanel person={selected} spouse={spouse} parent={parent} allKids={allKids} persons={persons}
                  REL={REL} getChildLabel={getChildLabel} getSpouseLabel={getSpouseLabel} getParentLabel={getParentLabel}
                  onSelect={setSel} onEdit={() => setMode({ type: 'edit', id: selected.id })}
                  onAdd={(dir, gender) => setMode({ type: 'add', dir, parentId: selected?.id, gender })}
                  onDelete={() => deletePerson(selected.id)}
                  onVerify={() => toggleVerified(selected.id)}
                  setExpanded={setExpanded} />
            }
          </div>
        </div>
      )}

      {tab === 'export' && (
        <div style={{ maxWidth: 500, margin: '0 auto', padding: 20 }}>
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>Export & Backup</h2>
          <button className="btn btn-dark btn-full" style={{ marginBottom: 12 }}
            onClick={() => {
              const blob = new Blob([JSON.stringify({ family: fam, persons }, null, 2)], { type: 'application/json' })
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
              a.download = `${fam.name.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.json`; a.click()
            }}>
            ↓ Download JSON backup
          </button>
          <div className="card" style={{ cursor: 'default' }}>
            <p style={{ fontSize: 13, color: '#666', lineHeight: 1.7 }}>
              <strong>Your data is in Supabase</strong> — it's already persistent and accessible from any device.
              JSON backup is your safety net. Download periodically and save to Google Drive or GitHub.
            </p>
          </div>
          <div className="card" style={{ cursor: 'default', marginTop: 8 }}>
            <p style={{ fontSize: 13, color: '#666', lineHeight: 1.7 }}>
              <strong>Sharing:</strong> Anyone with this URL can view and add to the family tree. Share it with your family on WhatsApp.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── HOME SCREEN ──
function HomeScreen({ families, onCreate, onSelect }) {
  const [newName, setNewName] = useState('')
  return (
    <div className="home">
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div className="home-title">Kula Vruksham</div>
        <div className="home-sub">Your family, mapped.</div>
      </div>
      <div className="card" style={{ cursor: 'default', border: '2px dashed #e0e0e0', padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Start a new family tree</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Family name — e.g. Yeturu, Sharma"
            onKeyDown={e => e.key === 'Enter' && newName.trim() && onCreate(newName)} />
          <button className="btn btn-dark" onClick={() => newName.trim() && onCreate(newName)}>Create</button>
        </div>
      </div>
      {families.length > 0 && <div style={{ fontSize: 12, color: '#bbb', marginTop: 24, marginBottom: 8, fontWeight: 500 }}>EXISTING FAMILIES</div>}
      {families.map(f => (
        <div key={f.id} className="card card-clickable" onClick={() => onSelect(f)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{f.name}</div>
            <div style={{ fontSize: 22, color: '#ddd' }}>→</div>
          </div>
        </div>
      ))}
      <div style={{ textAlign: 'center', marginTop: 40, fontSize: 11, color: '#ddd' }}>
        Anyone with this URL can create a family or contribute
      </div>
    </div>
  )
}

// ── DETAIL PANEL ──
function DetailPanel({ person, spouse, parent, allKids, persons, REL, getChildLabel, getSpouseLabel, getParentLabel, onSelect, onEdit, onAdd, onDelete, onVerify, setExpanded }) {
  if (!person) return <div style={{ padding: 30, textAlign: 'center', color: '#ccc', fontSize: 13 }}>← Pick someone from the tree</div>

  const dead = person.status === 'deceased'
  const profiles = person.profiles || {}
  const occ = person.occupation || {}

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: dead ? '#aaa' : '#1a1a1a', textDecoration: dead ? 'line-through' : 'none' }}>
            {dead ? '✝ ' : ''}{person.name}
          </div>
          {person.role && <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{person.role}</div>}
        </div>
        <button className="btn btn-dark btn-sm" onClick={onEdit}>Edit</button>
      </div>

      {!person.verified && (
        <div style={{ background: '#FFF3CD', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#856404', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Unverified <button className="btn btn-sm" style={{ background: '#856404', color: '#fff' }} onClick={onVerify}>Verify ✓</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: 12, marginBottom: 10 }}>
        {[['Clan', getDisplayClan(person, persons)], ['Location', person.location || '—'], ['Status', dead ? 'Deceased' : 'Living'], ['Generation', `${person.generation}`]].map(([l, v]) => (
          <div key={l}><div className="label" style={{ marginBottom: 2 }}>{l}</div><div style={{ color: '#444' }}>{v}</div></div>
        ))}
      </div>

      {spouse && (
        <div className="card card-clickable spouse-card" onClick={() => onSelect(spouse.id)}>
          <span style={{ color: '#E8A87C', fontSize: 16 }}>♥</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: spouse.status === 'deceased' ? '#aaa' : '#333', textDecoration: spouse.status === 'deceased' ? 'line-through' : 'none' }}>
              {spouse.status === 'deceased' ? '✝ ' : ''}{spouse.name}
            </div>
            <div style={{ fontSize: 10, color: '#C97B5D' }}>{getSpouseLabel(person)} · {spouse.location || ''}</div>
          </div>
        </div>
      )}

      {person.gotra && <div style={{ fontSize: 12, color: '#8B6914', marginBottom: 4 }}>{REL.gotra}: {person.gotra}</div>}
      {person.languages?.length > 0 && <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{REL.languages}: {person.languages.join(', ')}</div>}
      {(occ.role || occ.company) && <div className="card" style={{ cursor: 'default', padding: 10, marginBottom: 8, fontSize: 13 }}><strong>{occ.role}</strong>{occ.company ? ` @ ${occ.company}` : ''}</div>}

      {Object.entries(profiles).filter(([, v]) => v).length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
          {[['linkedin', 'in', '#0077B5'], ['facebook', 'fb', '#1877F2'], ['instagram', 'ig', '#E4405F'], ['whatsapp', 'wa', '#25D366']].map(([k, l, c]) =>
            profiles[k] ? <a key={k} href={k === 'whatsapp' ? undefined : profiles[k]} target="_blank" rel="noopener noreferrer" className="badge-profile" style={{ background: c }}>{l}</a> : null
          )}
        </div>
      )}

      {person.notes && <div className="card" style={{ cursor: 'default', fontSize: 13, color: '#666', lineHeight: 1.5, padding: 12 }}>{person.notes}</div>}

      {parent && <div style={{ fontSize: 12, marginBottom: 6 }}>
        <span style={{ color: '#999' }}>{getParentLabel(parent)}: </span>
        <span style={{ color: '#4A6FA5', cursor: 'pointer' }} onClick={() => onSelect(parent.id)}>{parent.name}</span>
      </div>}

      {allKids.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div className="label" style={{ marginBottom: 4 }}>{REL.children} ({allKids.length})</div>
          {allKids.map(k => (
            <div key={k.id} onClick={() => { onSelect(k.id); setExpanded(prev => { const n = new Set(prev); n.add(k.parentId); return n }) }}
              className="card card-clickable" style={{ padding: '8px 12px', fontSize: 13, color: k.status === 'deceased' ? '#aaa' : '#4A6FA5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{k.status === 'deceased' ? '✝ ' : ''}{k.name}</span>
              <span style={{ fontSize: 10, color: '#bbb' }}>{getChildLabel(k, person)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="actions">
        <div style={{ fontSize: 10, color: '#bbb', fontWeight: 500, marginBottom: 4 }}>{REL.addFamily.toUpperCase()}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <button className="btn btn-gold" style={{ textAlign: 'left', padding: '10px 12px' }} onClick={() => onAdd('ancestor', 'M')}>↑ {REL.father} (Father)</button>
          <button className="btn btn-gold" style={{ textAlign: 'left', padding: '10px 12px' }} onClick={() => onAdd('ancestor', 'F')}>↑ {REL.mother} (Mother)</button>
        </div>
        {!person.spouseId && (
          <button className="btn btn-copper btn-full" style={{ marginTop: 6 }}
            onClick={() => onAdd('spouse', person.gender === 'M' ? 'F' : 'M')}>
            ♥ {person.gender === 'M' ? `${REL.wife} (Wife)` : `${REL.husband} (Husband)`}
          </button>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
          <button className="btn btn-green" style={{ textAlign: 'left', padding: '10px 12px' }} onClick={() => onAdd('child', 'M')}>↓ {REL.son} (Son)</button>
          <button className="btn btn-green" style={{ textAlign: 'left', padding: '10px 12px' }} onClick={() => onAdd('child', 'F')}>↓ {REL.daughter} (Daughter)</button>
        </div>
        <button className="btn btn-grey btn-full" style={{ marginTop: 8 }} onClick={onDelete}>Delete</button>
      </div>
    </div>
  )
}

// ── PERSON FORM ──
function PersonForm({ mode, persons, fam, onSave, onCancel }) {
  const isEdit = mode.type === 'edit'
  const existing = isEdit ? persons.find(p => p.id === mode.id) : null
  const target = mode.parentId ? persons.find(p => p.id === mode.parentId) : null
  const dir = mode.dir || 'child'
  const isSp = dir === 'spouse', isAnc = dir === 'ancestor'
  const defaultGen = isAnc ? (target ? target.generation - 1 : 0) : isSp ? (target ? target.generation : 0) : (target ? target.generation + 1 : 0)
  const defaultGender = mode.gender || (isSp && target ? (target.gender === 'M' ? 'F' : 'M') : 'M')

  const targetSpouse = (!isSp && !isAnc && target?.spouseId) ? persons.find(p => p.id === target.spouseId) : null
  const childFather = (!isSp && !isAnc && target) ? (target.gender === 'M' ? target : (targetSpouse?.gender === 'M' ? targetSpouse : target)) : null
  const defaultClan = childFather ? (childFather.clan || '') : (target?.clan || '')

  const [f, setF] = useState(existing || {
    name: '', clan: defaultClan, gender: defaultGender,
    role: '', spouseId: null, location: isSp ? (target?.location || '') : '', status: isAnc ? 'deceased' : 'alive',
    generation: defaultGen, parentId: isAnc ? (target?.parentId || null) : (isSp ? null : mode.parentId || null),
    notes: '', verified: false, sortOrder: 0, phone: '', address: '',
    gotra: '', languages: [], nativePlace: '',
    occupation: { role: '', company: '' }, education: [],
    profiles: { linkedin: '', facebook: '', instagram: '', whatsapp: '' },
  })
  const [ftab, setFtab] = useState('basic')
  const u = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }))
  const title = isEdit ? `Edit ${f.name}` : isAnc ? '↑ Add ancestor' : isSp ? '♥ Add spouse' : '↓ Add ' + (target ? `under ${target.name}` : 'first person')

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>{title}</div>
      <div className="form-tabs">
        {[['basic', 'Basic'], ['identity', 'Identity'], ['work', 'Work'], ['links', 'Profiles']].map(([t, l]) => (
          <button key={t} className={`form-tab ${ftab === t ? 'active' : ''}`} onClick={() => setFtab(t)}>{l}</button>
        ))}
      </div>

      {ftab === 'basic' && <>
        {[['name', 'Name *'], ['clan', 'Clan / Family name'], ['location', 'Current city'], ['role', 'Role in family'], ['phone', 'Phone'], ['notes', 'Notes']].map(([k, l]) => (
          <div key={k} style={{ marginBottom: 10 }}>
            <label className="label">{l}</label>
            {k === 'notes' ? <textarea value={f[k] || ''} onChange={u(k)} rows={2} /> : <input value={f[k] || ''} onChange={u(k)} />}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <div><label className="label">Gender</label><select value={f.gender} onChange={u('gender')} style={{ width: 'auto' }}><option value="M">Male</option><option value="F">Female</option></select></div>
          <div><label className="label">Status</label><select value={f.status} onChange={u('status')} style={{ width: 'auto' }}><option value="alive">Living</option><option value="deceased">Deceased</option></select></div>
          {isEdit && <div style={{ display: 'flex', alignItems: 'end' }}><label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><input type="checkbox" checked={f.verified} onChange={e => setF(p => ({ ...p, verified: e.target.checked }))} /> Verified</label></div>}
        </div>
      </>}

      {ftab === 'identity' && <>
        {[['gotra', 'Gotra', 'e.g. Bharadwaja'], ['nativePlace', 'Native village', 'e.g. Atmakur']].map(([k, l, ph]) => (
          <div key={k} style={{ marginBottom: 10 }}><label className="label">{l}</label><input value={f[k] || ''} onChange={u(k)} placeholder={ph} /></div>
        ))}
        <div style={{ marginBottom: 10 }}><label className="label">Languages (comma-separated)</label>
          <input value={(f.languages || []).join(', ')} onChange={e => setF(p => ({ ...p, languages: e.target.value.split(',').map(x => x.trim()).filter(Boolean) }))} placeholder="Telugu, English, Hindi" />
        </div>
      </>}

      {ftab === 'work' && <>
        {[['role', 'Job title', 'e.g. Software Engineer'], ['company', 'Company', 'e.g. Deloitte']].map(([k, l, ph]) => (
          <div key={k} style={{ marginBottom: 10 }}><label className="label">{l}</label><input value={f.occupation?.[k] || ''} onChange={e => setF(p => ({ ...p, occupation: { ...p.occupation, [k]: e.target.value } }))} placeholder={ph} /></div>
        ))}
      </>}

      {ftab === 'links' && <>
        <p style={{ fontSize: 12, color: '#bbb', marginBottom: 10 }}>Paste profile links — helps connect the family network</p>
        {[['linkedin', 'LinkedIn', 'https://linkedin.com/in/...'], ['facebook', 'Facebook', ''], ['instagram', 'Instagram', ''], ['whatsapp', 'WhatsApp', '+91...']].map(([k, l, ph]) => (
          <div key={k} style={{ marginBottom: 10 }}><label className="label">{l}</label><input value={f.profiles?.[k] || ''} onChange={e => setF(p => ({ ...p, profiles: { ...p.profiles, [k]: e.target.value } }))} placeholder={ph} /></div>
        ))}
      </>}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="btn btn-dark" onClick={() => { if (!f.name.trim()) return alert('Name is required'); onSave(f) }}>Save</button>
        <button className="btn btn-grey" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

// ── Helpers ──
function makeId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20) + '_' + Date.now().toString(36)
}

function PersonToRow(p, familyId) {
  return {
    id: p.id, family_id: familyId, name: p.name || '', clan: p.clan || '',
    gender: p.gender || 'M', status: p.status || 'alive', generation: p.generation || 0,
    parent_id: p.parentId || null, spouse_id: p.spouseId || null,
    location: p.location || '', native_place: p.nativePlace || '',
    gotra: p.gotra || '', languages: p.languages || [],
    occupation: p.occupation || { role: '', company: '' }, education: p.education || [],
    profiles: p.profiles || { linkedin: '', facebook: '', instagram: '', whatsapp: '' },
    phone: p.phone || '', address: p.address || '', role: p.role || '',
    notes: p.notes || '', verified: p.verified || false, sort_order: p.sortOrder || 0,
  }
}

function RowToPerson(r) {
  return {
    id: r.id, name: r.name, clan: r.clan, gender: r.gender, status: r.status,
    generation: r.generation, parentId: r.parent_id, spouseId: r.spouse_id,
    location: r.location, nativePlace: r.native_place, gotra: r.gotra,
    languages: r.languages || [], occupation: r.occupation || { role: '', company: '' },
    education: r.education || [],
    profiles: r.profiles || { linkedin: '', facebook: '', instagram: '', whatsapp: '' },
    phone: r.phone, address: r.address, role: r.role, notes: r.notes,
    verified: r.verified, sortOrder: r.sort_order,
  }
}
