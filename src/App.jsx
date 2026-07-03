import { useState, useEffect, useCallback, useRef } from 'react'
import { db } from './db'
import { SVGTree, findRoots, getDisplayClan } from './SVGTree'
import NetworkView from './NetworkView'
import MapView from './MapView'
import ExplorerView from './ExplorerView'
import PersonForm from './PersonForm'
import StatsTab from './StatsTab'
import { DetailPopup } from './DetailPopup'

const LABELS = {
  telugu:  { father: 'తండ్రి',  mother: 'తల్లి',   husband: 'భర్త',     wife: 'భార్య',    son: 'కొడుకు',  daughter: 'కూతురు',  children: 'పిల్లలు',      gotra: 'గోత్రం',     languages: 'భాషలు',     addFamily: 'కుటుంబం జోడించు' },
  hindi:   { father: 'पिता',    mother: 'माता',    husband: 'पति',      wife: 'पत्नी',    son: 'बेटा',    daughter: 'बेटी',    children: 'बच्चे',        gotra: 'गोत्र',      languages: 'भाषाएं',    addFamily: 'परिवार जोड़ें' },
  tamil:   { father: 'அப்பா',  mother: 'அம்மா',  husband: 'கணவர்',   wife: 'மனைவி',  son: 'மகன்',   daughter: 'மகள்',   children: 'குழந்தைகள்', gotra: 'கோத்திரம்', languages: 'மொழிகள்',  addFamily: 'குடும்பம் சேர்' },
  kannada: { father: 'ತಂದೆ',   mother: 'ತಾಯಿ',   husband: 'ಗಂಡ',     wife: 'ಹೆಂಡತಿ', son: 'ಮಗ',    daughter: 'ಮಗಳು',  children: 'ಮಕ್ಕಳು',      gotra: 'ಗೋತ್ರ',     languages: 'ಭಾಷೆಗಳು',  addFamily: 'ಕುಟುಂಬ ಸೇರಿಸಿ' },
  english: { father: 'Father', mother: 'Mother', husband: 'Husband', wife: 'Wife',   son: 'Son',    daughter: 'Daughter', children: 'Children',     gotra: 'Gotra',     languages: 'Languages', addFamily: 'Add Family' },
}

// ── Text normalization ──
function titleCase(str) {
  if (!str) return ''
  return str.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

function normalizePerson(p) {
  return {
    ...p,
    name: p.name?.trim() || '',
    clan: titleCase(p.clan),
    location: titleCase(p.location),
    nativePlace: titleCase(p.nativePlace),
    gotra: titleCase(p.gotra),
    role: p.role?.trim() || '',
    languages: (p.languages || []).map(l => titleCase(l)),
  }
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
  const [views, setViews] = useState([])
  const [disputes, setDisputes] = useState([])

  // Boot
  useEffect(() => {
    db.getFamilies().then(f => { setFamilies(f); setScreen('home') })
  }, [])

  const openFamily = async (f) => {
    const [rows, refs, vws, disps] = await Promise.all([db.getPersons(f.id), db.getReferrals(f.id), db.getViews(f.id), db.getDisputes(f.id)])
    const mapped = rows.map(RowToPerson)
    const normalized = mapped.map(normalizePerson)
    setPersons(normalized)
    setReferrals(refs)
    setViews(vws)
    setDisputes(disps)
    setFam(f); setSel(null); setMode(null); setTab('tree')
    setExpanded(new Set(rows.map(r => r.id)))
    setScreen('family')
    for (let i = 0; i < mapped.length; i++) {
      const p = mapped[i], clean = normalized[i]
      if (clean.clan !== p.clan || clean.location !== p.location ||
          clean.nativePlace !== p.nativePlace || clean.gotra !== p.gotra) {
        await db.upsertPerson(PersonToRow(clean, f.id))
      }
    }
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
    form = normalizePerson(form)
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

  const openEdit = (id) => setMode({ type: 'edit', id })
  const openAdd = (id, dir, gender) => setMode({ type: 'add', dir, parentId: id, gender })

  const isDescendant = (ancestorId, candidateId) => {
    const kids = persons.filter(p => p.parentId === ancestorId)
    return kids.some(k => k.id === candidateId || isDescendant(k.id, candidateId))
  }

  // Links two EXISTING people as spouses or as parent/child — the drag-and-drop
  // counterpart to the "Add Father/Wife/Son" buttons, which only ever create new people.
  const relinkPersons = async (draggedId, targetId, mode) => {
    if (draggedId === targetId) return
    const dragged = persons.find(p => p.id === draggedId)
    const target = persons.find(p => p.id === targetId)
    if (!dragged || !target) return

    if (mode === 'spouse') {
      if (dragged.spouseId || target.spouseId) {
        alert(`${dragged.spouseId ? dragged.name : target.name} already has a spouse — unlink them first (Edit) before connecting a new one.`)
        return
      }
      if (!window.confirm(`Connect ${dragged.name} and ${target.name} as spouses?`)) return
      await db.updatePerson(dragged.id, { spouse_id: target.id })
      await db.updatePerson(target.id, { spouse_id: dragged.id })
    } else if (mode === 'child') {
      if (dragged.spouseId === target.id || target.spouseId === dragged.id) {
        alert(`${dragged.name} and ${target.name} are already linked as spouses — one can't also be the other's child.`)
        return
      }
      if (isDescendant(dragged.id, target.id)) {
        alert(`Can't do that — ${target.name} is already a descendant of ${dragged.name}, so this would create a loop.`)
        return
      }
      if (target.id === dragged.parentId) return
      const targetSpouse = target.spouseId ? persons.find(p => p.id === target.spouseId) : null
      const bloodParent = target.gender === 'M' ? target : (targetSpouse?.gender === 'M' ? targetSpouse : target)
      const replacing = dragged.parentId ? ` (replacing their current parent)` : ''
      if (!window.confirm(`Make ${dragged.name} a child of ${bloodParent.name}${replacing}?`)) return
      await db.updatePerson(dragged.id, { parent_id: bloodParent.id })
    }
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

  const clans = [...new Set(persons.map(p => p.clan).filter(Boolean))].sort()
  const rootIds = findRoots(persons)
  const addRootAction = persons.length > 0 ? () => setMode({ type: 'add', dir: 'child', parentId: null }) : undefined

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
                  <button onClick={() => setView('tree')}
                    style={{ padding: '7px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 0, background: view === 'tree' ? '#1a1a1a' : 'transparent', color: view === 'tree' ? '#fff' : '#999' }}>
                    Tree
                  </button>
                  <button onClick={() => setView('explorer')}
                    style={{ padding: '7px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 0, background: view === 'explorer' ? '#1a1a1a' : 'transparent', color: view === 'explorer' ? '#fff' : '#999' }}>
                    Explorer
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
              ) : view === 'tree' ? (
                <SVGTree
                  persons={persons}
                  sel={sel}
                  setSel={id => { setSel(id); setSearch('') }}
                  clans={clans}
                  rootIds={rootIds}
                  onAddRoot={addRootAction}
                  onContextMenu={handleContextMenu}
                />
              ) : view === 'explorer' ? (
                <ExplorerView
                  persons={persons}
                  sel={sel}
                  setSel={id => { setSel(id); setSearch('') }}
                  rootIds={rootIds}
                  expanded={expanded}
                  setExpanded={setExpanded}
                  referrals={referrals}
                  onContextMenu={handleContextMenu}
                  onAddRoot={addRootAction}
                  onEdit={openEdit}
                  onAdd={openAdd}
                  onDelete={deletePerson}
                  onVerify={toggleVerified}
                  onRelink={relinkPersons}
                  REL={REL}
                />
              ) : (
                <NetworkView
                  persons={persons}
                  sel={sel}
                  setSel={id => { setSel(id); setSearch('') }}
                  referrals={referrals}
                  onContextMenu={handleContextMenu}
                  views={views}
                  disputes={disputes}
                  fam={fam}
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
              onEdit={() => { const id = contextMenu.person.id; setContextMenu(null); openEdit(id) }}
              onAdd={(dir, gender) => { const pid = contextMenu.person.id; setContextMenu(null); openAdd(pid, dir, gender) }}
              onDelete={() => { const id = contextMenu.person.id; setContextMenu(null); deletePerson(id) }}
              onVerify={() => { const id = contextMenu.person.id; setContextMenu(null); toggleVerified(id) }}
              onFocus={id => { setSel(id); setContextMenu(null) }}
              familyId={fam.id}
              userName={userName}
              referrals={referrals}
              setReferrals={setReferrals}
              views={views}
              disputes={disputes}
              historianName={fam?.historian_name || ''}
              onAddDispute={async (d) => { await db.addDispute(d); setDisputes(prev => [d, ...prev]) }}
              onResolveDispute={async (id, resolvedBy, note) => {
                await db.resolveDispute(id, resolvedBy, note)
                setDisputes(prev => prev.map(d => d.id === id ? { ...d, status: 'resolved', resolved_by: resolvedBy, resolution_note: note, resolved_at: new Date().toISOString() } : d))
              }}
              onAutoView={async (personId) => {
                if (!userName) return
                const alreadyViewed = views.some(v => v.person_id === personId && v.viewed_by === userName)
                if (!alreadyViewed) {
                  const view = { id: 'view_' + Date.now().toString(36), family_id: fam.id, person_id: personId, viewed_by: userName }
                  await db.addView(view)
                  setViews(prev => [...prev, view])
                }
              }}
              fam={fam}
              focusId={sel}
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
          <StatsTab persons={persons} fam={fam} views={views} disputes={disputes} />
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
