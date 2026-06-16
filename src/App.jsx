import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import { getDisplayClan } from './SVGTree'
import NetworkView from './NetworkView'
import MapView from './MapView'
import PersonForm from './PersonForm'
import StatsTab from './StatsTab'

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
  },

  async getReferrals(familyId) {
    const { data } = await supabase.from('referrals').select('*').eq('family_id', familyId)
    return data || []
  },

  async addReferral(referral) {
    await supabase.from('referrals').insert(referral)
  },

  async deleteReferral(id) {
    await supabase.from('referrals').delete().eq('id', id)
  },
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
  const [contextMenu, setContextMenu] = useState(null)
  const [userName, setUserName] = useState(() => localStorage.getItem('kv-username') || '')
  const [referrals, setReferrals] = useState([])
  const [view, setView] = useState('graph')

  // Boot
  useEffect(() => {
    db.getFamilies().then(f => { setFamilies(f); setScreen('home') })
  }, [])

  const openFamily = async (f) => {
    const [rows, refs] = await Promise.all([db.getPersons(f.id), db.getReferrals(f.id)])
    setPersons(rows.map(RowToPerson))
    setReferrals(refs)
    setFam(f); setSel(null); setMode(null); setTab('tree')
    setExpanded(new Set(rows.slice(0, 15).map(r => r.id)))
    setScreen('family')
  }

  const createFamily = async (name) => {
    const id = makeId(name)
    await db.createFamily(id, name.trim())
    const historianFields = userName ? { historian: userName, historian_name: userName } : {}
    if (userName) await db.updateFamily(id, historianFields)
    const f = { id, name: name.trim(), ...historianFields }
    setFamilies(prev => [f, ...prev])
    openFamily(f)
  }

  const refresh = useCallback(async () => {
    if (!fam) return
    const rows = await db.getPersons(fam.id)
    setPersons(rows.map(RowToPerson))
  }, [fam])

  const getKids = (id) => persons.filter(p => p.parentId === id).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  const selected = sel ? persons.find(p => p.id === sel) : null
  const spouse = selected?.spouseId ? persons.find(p => p.id === selected.spouseId) : null
  const parent = selected?.parentId ? persons.find(p => p.id === selected.parentId) : null

  const savePerson = async (form) => {
    if (mode?.type === 'add') {
      form.addedBy = userName || 'Anonymous'
      form.lastEditedBy = userName || 'Anonymous'
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
      form.lastEditedBy = userName || 'Anonymous'
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

  const handleContextMenu = (personId, event) => {
    event.preventDefault()
    const person = persons.find(p => p.id === personId)
    if (person) setContextMenu({ person, position: { x: event.clientX, y: event.clientY } })
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
          <div className="header-sub">
            {persons.length} members
            {fam.historian_name && <span> · Maintained by <strong>{fam.historian_name}</strong></span>}
          </div>
        </div>
        <div className="header-tabs">
          <span
            style={{ fontSize: 10, opacity: 0.5, cursor: 'pointer', marginRight: 6 }}
            onClick={() => {
              const newName = prompt('Change your name:', userName)
              if (newName?.trim()) { setUserName(newName.trim()); localStorage.setItem('kv-username', newName.trim()) }
            }}
          >{userName || 'Set name'}</span>
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
          {[['tree', 'Tree'], ['stats', 'Stats'], ['export', '↓']].map(([t, l]) => (
            <button key={t} className={`header-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{l}</button>
          ))}
        </div>
      </div>

      {!userName && (
        <div style={{ background: '#FFF3CD', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, flexShrink: 0 }}>
          <span style={{ whiteSpace: 'nowrap', color: '#856404' }}>Who are you?</span>
          <input
            placeholder="Your name — so family knows who added what"
            style={{ flex: 1, padding: '4px 8px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}
            onKeyDown={e => {
              if (e.key === 'Enter' && e.target.value.trim()) {
                setUserName(e.target.value.trim())
                localStorage.setItem('kv-username', e.target.value.trim())
              }
            }}
          />
        </div>
      )}

      {tab === 'tree' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {persons.length === 0 ? (
            <div className="empty" style={{ flex: 1 }}>
              <div className="empty-icon">🌱</div>
              <div className="empty-title">Start your tree</div>
              <div className="empty-sub">Add the first person — yourself or the oldest ancestor you know</div>
              <button className="btn btn-dark" onClick={() => setMode({ type: 'add', dir: 'child', parentId: null })}>+ Add first person</button>
            </div>
          ) : (
            <>
              {/* Floating search + view toggle */}
              <div style={{ position: 'absolute', top: 8, left: 8, right: 8, zIndex: 1000, display: 'flex', gap: 6, pointerEvents: 'none' }}>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search people…"
                  style={{ flex: 1, padding: '7px 10px', marginBottom: 0, borderRadius: 8, border: '1px solid #e0e0e0', background: '#fff', fontSize: 13, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', pointerEvents: 'all' }}
                />
                <div style={{ display: 'flex', background: '#fff', borderRadius: 8, border: '1px solid #e0e0e0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flexShrink: 0, pointerEvents: 'all' }}>
                  <button onClick={() => setView('graph')}
                    style={{ padding: '7px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 0, background: view === 'graph' ? '#1a1a1a' : 'transparent', color: view === 'graph' ? '#fff' : '#999' }}>
                    Graph
                  </button>
                  <button onClick={() => setView('map')}
                    style={{ padding: '7px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 0, background: view === 'map' ? '#1a1a1a' : 'transparent', color: view === 'map' ? '#fff' : '#999' }}>
                    Map
                  </button>
                </div>
              </div>

              {/* Main view */}
              {view === 'map' ? (
                <MapView
                  persons={persons}
                  sel={sel}
                  setSel={id => { setSel(id); setSearch('') }}
                  onContextMenu={handleContextMenu}
                />
              ) : (
                <NetworkView
                  persons={persons}
                  sel={sel}
                  setSel={id => { setSel(id); setSearch('') }}
                  referrals={referrals}
                  onContextMenu={handleContextMenu}
                />
              )}

              {/* Search results overlay */}
              {search && (
                <div style={{ position: 'absolute', top: 44, left: 8, right: 8, background: '#fff', borderRadius: 8, border: '1px solid #e0e0e0', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 999, maxHeight: '60vh', overflowY: 'auto' }}>
                  {filtered.length === 0
                    ? <div style={{ padding: '12px 16px', fontSize: 12, color: '#bbb' }}>No results</div>
                    : filtered.map(p => (
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
              )}
            </>
          )}

          {contextMenu && (
            <DetailPopup
              person={contextMenu.person}
              position={contextMenu.position}
              persons={persons}
              REL={REL}
              onClose={() => setContextMenu(null)}
              onEdit={() => { const id = contextMenu.person.id; setContextMenu(null); setMode({ type: 'edit', id }) }}
              onAdd={(dir, gender) => { const pid = contextMenu.person.id; setContextMenu(null); setMode({ type: 'add', dir, parentId: pid, gender }) }}
              onDelete={() => { const id = contextMenu.person.id; setContextMenu(null); deletePerson(id) }}
              onVerify={() => { const id = contextMenu.person.id; setContextMenu(null); toggleVerified(id) }}
              onFocus={id => { setSel(id); setContextMenu(null) }}
              familyId={fam.id}
              userName={userName}
              referrals={referrals}
              setReferrals={setReferrals}
              onForceDelete={async () => {
                const id = contextMenu.person.id
                setContextMenu(null)
                for (const p of persons) {
                  if (p.spouseId === id) await db.updatePerson(p.id, { spouse_id: null })
                }
                for (const p of persons) {
                  if (p.parentId === id) await db.updatePerson(p.id, { parent_id: null })
                }
                await db.deletePerson(id)
                await refresh()
              }}
            />
          )}

          {mode && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
              <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, maxHeight: '85vh', overflowY: 'auto', padding: 20, boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}>
                <PersonForm mode={mode} persons={persons} fam={fam} onSave={savePerson} onCancel={() => setMode(null)} />
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'stats' && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <StatsTab persons={persons} fam={fam} />
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

// ── DETAIL POPUP (right-click floating card) ──
function DetailPopup({ person, position, persons, REL, onClose, onEdit, onAdd, onDelete, onVerify, onFocus, onForceDelete, familyId, userName, referrals = [], setReferrals }) {
  const spouse = person.spouseId ? persons.find(p => p.id === person.spouseId) : null
  const dead = person.status === 'deceased'
  const popupW = 300, popupH = 460
  let left = position.x + 12
  let top = position.y - 16
  if (left + popupW > window.innerWidth - 8) left = position.x - popupW - 12
  if (top + popupH > window.innerHeight - 8) top = window.innerHeight - popupH - 8
  if (top < 8) top = 8

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
      <div style={{
        position: 'fixed', left, top, width: popupW, maxHeight: popupH,
        overflowY: 'auto', background: '#fff', borderRadius: 12,
        boxShadow: '0 8px 30px rgba(0,0,0,0.2)', border: '1px solid #e8e8e8',
        zIndex: 100, padding: 16, fontFamily: "'DM Sans', sans-serif",
      }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', fontSize: 20, color: '#ccc', cursor: 'pointer', lineHeight: 1 }}>×</button>

        <div style={{ fontSize: 17, fontWeight: 700, color: dead ? '#aaa' : '#1a1a1a', textDecoration: dead ? 'line-through' : 'none', marginBottom: 2, paddingRight: 24 }}>
          {dead ? '✝ ' : ''}{person.name}
        </div>
        {person.role && <div style={{ fontSize: 11, color: '#999', marginBottom: 8 }}>{person.role}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 12, marginBottom: 8 }}>
          {[['Clan', person.clan || '—'], ['Location', person.location || '—'], ['Status', dead ? 'Deceased' : 'Living'], ['Gen', `${person.generation}`]].map(([l, v]) => (
            <div key={l}><span style={{ display: 'block', color: '#bbb', fontSize: 10 }}>{l}</span>{v}</div>
          ))}
          {person.birthYear && (
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={{ display: 'block', color: '#bbb', fontSize: 10 }}>Age</span>
              {dead && person.deathYear
                ? `${person.deathYear - person.birthYear} (${person.birthYear}–${person.deathYear})`
                : `${new Date().getFullYear() - person.birthYear} yrs (b. ${person.birthYear})`}
            </div>
          )}
        </div>

        {spouse && (
          <div onClick={() => { onClose(); setTimeout(() => onFocus(spouse.id), 50) }}
            style={{ background: '#fdf8f2', borderRadius: 8, padding: '8px 10px', marginBottom: 8, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#E8A87C' }}>♥</span>
            <span style={{ color: spouse.status === 'deceased' ? '#aaa' : '#333', textDecoration: spouse.status === 'deceased' ? 'line-through' : 'none' }}>{spouse.name}</span>
            {spouse.clan && <span style={{ color: '#bbb', fontSize: 10 }}>{spouse.clan}</span>}
          </div>
        )}

        {(person.occupation?.role || person.occupation?.company) && (
          <div style={{ fontSize: 12, color: '#555', marginBottom: 6 }}>
            {person.occupation.role}{person.occupation.company ? ` @ ${person.occupation.company}` : ''}
          </div>
        )}

        {person.profiles && Object.entries(person.profiles).filter(([, v]) => v).length > 0 && (
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {[['linkedin', 'in', '#0077B5'], ['facebook', 'fb', '#1877F2'], ['instagram', 'ig', '#E4405F'], ['whatsapp', 'wa', '#25D366']].map(([k, l, c]) =>
              person.profiles[k] ? <a key={k} href={k === 'whatsapp' ? undefined : person.profiles[k]} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 9, fontWeight: 700, color: '#fff', background: c, padding: '2px 6px', borderRadius: 3, textDecoration: 'none' }}>{l}</a> : null
            )}
          </div>
        )}

        {person.notes && (
          <div style={{ fontSize: 11, color: '#888', background: '#f8f8f8', borderRadius: 6, padding: 8, marginBottom: 8, lineHeight: 1.4 }}>{person.notes}</div>
        )}

        {!person.verified && (
          <div style={{ background: '#FFF3CD', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontSize: 11, color: '#856404', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Unverified
            <button onClick={onVerify} style={{ background: '#856404', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 10, cursor: 'pointer' }}>Verify ✓</button>
          </div>
        )}

        <div style={{ fontSize: 10, color: '#bbb', marginBottom: 5, fontWeight: 500, letterSpacing: 0.5 }}>{(REL?.addFamily || 'ADD FAMILY').toUpperCase()}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
          <button className="btn btn-gold btn-sm" onClick={() => onAdd('ancestor', 'M')}>↑ {REL?.father || 'Father'}</button>
          <button className="btn btn-gold btn-sm" onClick={() => onAdd('ancestor', 'F')}>↑ {REL?.mother || 'Mother'}</button>
        </div>
        {!person.spouseId && (
          <button className="btn btn-copper btn-sm btn-full" style={{ marginBottom: 4 }}
            onClick={() => onAdd('spouse', person.gender === 'M' ? 'F' : 'M')}>
            ♥ {person.gender === 'M' ? (REL?.wife || 'Wife') : (REL?.husband || 'Husband')}
          </button>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 8 }}>
          <button className="btn btn-green btn-sm" onClick={() => onAdd('child', 'M')}>↓ {REL?.son || 'Son'}</button>
          <button className="btn btn-green btn-sm" onClick={() => onAdd('child', 'F')}>↓ {REL?.daughter || 'Daughter'}</button>
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn-dark btn-sm" style={{ flex: 1 }} onClick={onEdit}>Edit</button>
          <button className="btn btn-grey btn-sm" onClick={onDelete}>Delete</button>
        </div>
        {onForceDelete && (
          <button
            style={{ width: '100%', marginTop: 4, padding: '5px 0', fontSize: 11, fontWeight: 600, background: 'none', color: '#dc3545', border: '1px solid #dc3545', borderRadius: 6, cursor: 'pointer' }}
            onClick={() => {
              if (window.confirm('Force delete? This clears all links to this person (spouse, children) and removes them.')) {
                onForceDelete()
              }
            }}
          >Force Delete (remove all links)</button>
        )}

        {/* Knowledge referrals */}
        <div style={{ marginTop: 10, borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
          <div style={{ fontSize: 10, color: '#bbb', fontWeight: 500, marginBottom: 4 }}>
            WHO KNOWS ABOUT {person.name.split(' ')[0].toUpperCase()}?
          </div>
          {referrals.filter(r => r.target_person_id === person.id).map(ref => {
            const source = persons.find(p => p.id === ref.source_person_id)
            return (
              <div key={ref.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', marginBottom: 3, background: '#f0f8ff', borderRadius: 6, fontSize: 11 }}>
                <span style={{ color: '#4A6FA5', fontWeight: 600 }}>Ask {source?.name || 'Unknown'}</span>
                {ref.note && <span style={{ color: '#999' }}>— {ref.note}</span>}
                <button onClick={async () => { await db.deleteReferral(ref.id); setReferrals(prev => prev.filter(r => r.id !== ref.id)) }}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ddd', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
              </div>
            )
          })}
          {referrals.filter(r => r.source_person_id === person.id).length > 0 && (
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 9, color: '#ccc', marginBottom: 2 }}>{person.name.split(' ')[0]} knows about:</div>
              {referrals.filter(r => r.source_person_id === person.id).map(ref => {
                const target = persons.find(p => p.id === ref.target_person_id)
                return (
                  <span key={ref.id} style={{ fontSize: 10, color: '#4A6FA5', marginRight: 6, cursor: 'pointer' }}
                    onClick={() => { onClose(); onFocus(ref.target_person_id) }}>
                    {target?.name || '?'}
                  </span>
                )
              })}
            </div>
          )}
          <AddReferralInline
            targetId={person.id}
            persons={persons}
            familyId={familyId}
            userName={userName}
            onAdd={async (ref) => { await db.addReferral(ref); setReferrals(prev => [...prev, ref]) }}
          />
        </div>

        {(person.addedBy || person.lastEditedBy) && (
          <div style={{ fontSize: 9, color: '#bbb', marginTop: 8, borderTop: '1px solid #f5f5f5', paddingTop: 6 }}>
            {person.addedBy && <span>Added by {person.addedBy}</span>}
            {person.lastEditedBy && person.lastEditedBy !== person.addedBy && <span> · Edited by {person.lastEditedBy}</span>}
          </div>
        )}
      </div>
    </>
  )
}

// ── ADD REFERRAL INLINE ──
function AddReferralInline({ targetId, persons, familyId, userName, onAdd }) {
  const [open, setOpen] = useState(false)
  const [sourceId, setSourceId] = useState('')
  const [note, setNote] = useState('')

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ width: '100%', padding: '5px', marginTop: 4, borderRadius: 6, border: '1px dashed #e0e0e0', background: 'transparent', cursor: 'pointer', fontSize: 11, color: '#bbb' }}>
        + Add "ask someone about this person"
      </button>
    )
  }

  return (
    <div style={{ marginTop: 6, padding: 8, background: '#f8f8f8', borderRadius: 8 }}>
      <div style={{ fontSize: 10, color: '#999', marginBottom: 4 }}>Who knows about this person?</div>
      <select value={sourceId} onChange={e => setSourceId(e.target.value)}
        style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #e0e0e0', fontSize: 12, marginBottom: 4 }}>
        <option value="">Select a person…</option>
        {persons.filter(p => p.id !== targetId).map(p => (
          <option key={p.id} value={p.id}>{p.name}{p.clan ? ` (${p.clan})` : ''}</option>
        ))}
      </select>
      <input value={note} onChange={e => setNote(e.target.value)}
        placeholder="What do they know? (has photos, knows history…)"
        style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #e0e0e0', fontSize: 12, marginBottom: 4 }} />
      <div style={{ display: 'flex', gap: 4 }}>
        <button className="btn btn-dark btn-sm" onClick={async () => {
          if (!sourceId) return alert('Select who knows')
          const ref = {
            id: 'ref_' + Date.now().toString(36),
            family_id: familyId,
            source_person_id: sourceId,
            target_person_id: targetId,
            note: note.trim(),
            added_by: userName || 'Anonymous',
          }
          await onAdd(ref)
          setOpen(false); setSourceId(''); setNote('')
        }}>Save</button>
        <button className="btn btn-grey btn-sm" onClick={() => { setOpen(false); setSourceId(''); setNote('') }}>Cancel</button>
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
    added_by: p.addedBy || '', last_edited_by: p.lastEditedBy || '',
    birth_year: p.birthYear || null, death_year: p.deathYear || null,
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
    addedBy: r.added_by || '', lastEditedBy: r.last_edited_by || '',
    birthYear: r.birth_year || null, deathYear: r.death_year || null,
    updated_at: r.updated_at, created_at: r.created_at,
  }
}
