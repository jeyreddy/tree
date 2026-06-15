import { useState } from 'react'

export default function PersonForm({ mode, persons, fam, onSave, onCancel }) {
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
    birthYear: null, deathYear: null,
  })
  const [ftab, setFtab] = useState('basic')
  const u = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }))
  const title = isEdit ? `Edit ${f.name}` : isAnc ? '↑ Add ancestor' : isSp ? '♥ Add spouse' : '↓ Add ' + (target ? `under ${target.name}` : 'first person')
  const thisYear = new Date().getFullYear()

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 14 }}>{title}</div>

      {/* Tab bar — scrollable on narrow screens */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {[['basic', 'Basic'], ['identity', 'Identity'], ['work', 'Work'], ['links', 'Profiles']].map(([t, l]) => (
          <button key={t} onClick={() => setFtab(t)} style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0,
            background: ftab === t ? '#1a1a1a' : '#f0f0f0',
            color: ftab === t ? '#fff' : '#999',
          }}>{l}</button>
        ))}
      </div>

      {ftab === 'basic' && <>
        <div style={{ marginBottom: 12 }}>
          <label className="label">Name *</label>
          <input value={f.name || ''} onChange={u('name')} style={{ fontSize: 15, padding: '12px' }} />
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ flex: '1 1 180px' }}>
            <label className="label">Clan / Family Name</label>
            <input value={f.clan || ''} onChange={u('clan')} />
          </div>
          <div style={{ flex: '1 1 180px' }}>
            <label className="label">Current City</label>
            <input value={f.location || ''} onChange={u('location')} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ flex: '1 1 120px' }}>
            <label className="label">Gender</label>
            <select value={f.gender} onChange={u('gender')} style={{ width: '100%', padding: '12px' }}>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </div>
          <div style={{ flex: '1 1 120px' }}>
            <label className="label">Status</label>
            <select value={f.status} onChange={u('status')} style={{ width: '100%', padding: '12px' }}>
              <option value="alive">Living</option>
              <option value="deceased">Deceased</option>
            </select>
          </div>
          {isEdit && (
            <div style={{ flex: '1 1 100px', display: 'flex', alignItems: 'flex-end' }}>
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, padding: '12px 0' }}>
                <input type="checkbox" checked={f.verified || false}
                  onChange={e => setF(p => ({ ...p, verified: e.target.checked }))}
                  style={{ width: 18, height: 18 }} />
                Verified
              </label>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ flex: '1 1 100px' }}>
            <label className="label">Birth Year</label>
            <input type="number" value={f.birthYear || ''}
              onChange={e => setF(p => ({ ...p, birthYear: e.target.value ? parseInt(e.target.value) : null }))}
              placeholder="1955" min="1850" max={thisYear} />
          </div>
          <div style={{ flex: '1 1 100px' }}>
            <label className="label">Death Year</label>
            <input type="number" value={f.deathYear || ''}
              onChange={e => setF(p => ({ ...p, deathYear: e.target.value ? parseInt(e.target.value) : null }))}
              placeholder="2020" min="1850" max={thisYear}
              disabled={f.status !== 'deceased'} />
          </div>
          <div style={{ flex: '1 1 100px' }}>
            <label className="label">Age</label>
            <div style={{ padding: '10px 12px', background: '#f5f5f5', borderRadius: 8, fontSize: 14, color: '#555', minHeight: 42, display: 'flex', alignItems: 'center' }}>
              {f.birthYear
                ? f.status === 'deceased' && f.deathYear
                  ? `${f.deathYear - f.birthYear} yrs`
                  : `${thisYear - f.birthYear} yrs`
                : '—'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ flex: '1 1 180px' }}>
            <label className="label">Role in Family</label>
            <input value={f.role || ''} onChange={u('role')} placeholder="e.g. Eldest Son" />
          </div>
          <div style={{ flex: '1 1 180px' }}>
            <label className="label">Phone</label>
            <input value={f.phone || ''} onChange={u('phone')} placeholder="+91..." />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label className="label">Notes</label>
          <textarea value={f.notes || ''} onChange={u('notes')} rows={3}
            placeholder="Any details you remember — partial info is fine"
            style={{ fontSize: 14 }} />
        </div>
      </>}

      {ftab === 'identity' && <>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ flex: '1 1 180px' }}>
            <label className="label">Gotra</label>
            <input value={f.gotra || ''} onChange={u('gotra')} placeholder="e.g. Bharadwaja" />
          </div>
          <div style={{ flex: '1 1 180px' }}>
            <label className="label">Native Village</label>
            <input value={f.nativePlace || ''} onChange={u('nativePlace')} placeholder="e.g. Atmakur" />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label className="label">Languages (comma-separated)</label>
          <input value={(f.languages || []).join(', ')}
            onChange={e => setF(p => ({ ...p, languages: e.target.value.split(',').map(x => x.trim()).filter(Boolean) }))}
            placeholder="Telugu, English, Hindi" />
        </div>
      </>}

      {ftab === 'work' && <>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ flex: '1 1 180px' }}>
            <label className="label">Job Title</label>
            <input value={f.occupation?.role || ''}
              onChange={e => setF(p => ({ ...p, occupation: { ...p.occupation, role: e.target.value } }))}
              placeholder="e.g. Software Engineer" />
          </div>
          <div style={{ flex: '1 1 180px' }}>
            <label className="label">Company</label>
            <input value={f.occupation?.company || ''}
              onChange={e => setF(p => ({ ...p, occupation: { ...p.occupation, company: e.target.value } }))}
              placeholder="e.g. Deloitte" />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label className="label">Education (one per line: School, Year, Degree)</label>
          <textarea
            value={(f.education || []).map(e => `${e.institution || ''}, ${e.year || ''}, ${e.degree || ''}`).join('\n')}
            onChange={e => setF(p => ({
              ...p,
              education: e.target.value.split('\n').filter(l => l.trim()).map(l => {
                const [institution, year, degree] = l.split(',').map(s => s.trim())
                return { institution: institution || '', year: year || '', degree: degree || '' }
              })
            }))}
            rows={3} placeholder={"JNTU, 2018, B.Tech\nIIT Madras, 2020, M.Tech"} />
        </div>
      </>}

      {ftab === 'links' && <>
        <p style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>Paste profile links. Helps connect the family network.</p>
        {[['linkedin', 'LinkedIn', 'https://linkedin.com/in/...'],
          ['facebook', 'Facebook', 'https://facebook.com/...'],
          ['instagram', 'Instagram', '@handle or URL'],
          ['whatsapp', 'WhatsApp', '+91...']].map(([k, l, ph]) => (
          <div key={k} style={{ marginBottom: 12 }}>
            <label className="label">{l}</label>
            <input value={f.profiles?.[k] || ''}
              onChange={e => setF(p => ({ ...p, profiles: { ...p.profiles, [k]: e.target.value } }))}
              placeholder={ph} />
          </div>
        ))}
      </>}

      <div style={{
        display: 'flex', gap: 8, marginTop: 16,
        position: 'sticky', bottom: 0, background: '#fff',
        padding: '12px 0', borderTop: '1px solid #f0f0f0',
      }}>
        <button className="btn btn-dark" style={{ flex: 1, padding: '12px', fontSize: 15 }}
          onClick={() => { if (!f.name.trim()) return alert('Name is required'); onSave(f) }}>
          Save
        </button>
        <button className="btn btn-grey" style={{ padding: '12px 24px', fontSize: 15 }}
          onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
