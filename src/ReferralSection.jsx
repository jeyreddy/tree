import { useState } from 'react'
import { db } from './db'

const TOPICS = ['Photos', 'Village history', 'Family stories', 'Old documents', 'Contact info', 'Relationships', 'Other']

const BLUE = '#2c5aa0'

// The KNA prompt shown in DetailPopup: "Who knows about <target>?" — lists who has
// been pointed to as knowing something about this person, plus an inline add form.
export function ReferralSection({ target, persons, referrals, setReferrals, familyId, userName, onNavigate }) {
  const [open, setOpen] = useState(false)
  const incoming = referrals.filter(r => r.target_person_id === target.id)
  const first = target.name.split(' ')[0]

  const removeReferral = async (id) => {
    await db.deleteReferral(id)
    setReferrals(prev => prev.filter(r => r.id !== id))
  }

  const addReferral = async (ref) => {
    await db.addReferral(ref)
    setReferrals(prev => [...prev, ref])
    setOpen(false)
  }

  return (
    <div style={{ marginTop: 10, marginBottom: 10, background: '#f0f6ff', border: '1px solid #d6e4fb', borderRadius: 10, padding: 10 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: BLUE, marginBottom: incoming.length || open ? 8 : 4 }}>
        Who knows about {first}?
      </div>

      {incoming.length === 0 && !open && (
        <div style={{ fontSize: 11, color: '#8aa4c8', marginBottom: 8, lineHeight: 1.4 }}>
          Point the family to whoever remembers {first}'s photos, stories, or village history.
        </div>
      )}

      {incoming.map(ref => {
        const source = persons.find(p => p.id === ref.source_person_id)
        return (
          <div key={ref.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', marginBottom: 4, background: '#fff', borderRadius: 6, fontSize: 11, flexWrap: 'wrap' }}>
            <span onClick={() => onNavigate(ref.source_person_id)} style={{ color: BLUE, fontWeight: 600, cursor: 'pointer' }}>
              {source?.name || 'Unknown'}
            </span>
            {ref.topic && <span style={{ fontSize: 9, fontWeight: 600, color: '#3c6cb0', background: '#e5effd', borderRadius: 8, padding: '1px 7px' }}>{ref.topic}</span>}
            {ref.note && <span style={{ color: '#888' }}>{ref.note}</span>}
            <button onClick={() => removeReferral(ref.id)} title="Remove"
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button>
          </div>
        )
      })}

      {open ? (
        <AddForm target={target} persons={persons} referrals={referrals} familyId={familyId} userName={userName}
          onDone={addReferral} onCancel={() => setOpen(false)} />
      ) : (
        <button onClick={() => setOpen(true)}
          style={{ width: '100%', padding: '9px', marginTop: 4, borderRadius: 8, border: `1px dashed #9dbdf0`, background: '#fff', color: BLUE, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
          + Add someone who knows
        </button>
      )}
    </div>
  )
}

function AddForm({ target, persons, referrals, familyId, userName, onDone, onCancel }) {
  const [sourceId, setSourceId] = useState('')
  const [search, setSearch] = useState('')
  const [topic, setTopic] = useState('')
  const [customTopic, setCustomTopic] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const selected = sourceId ? persons.find(p => p.id === sourceId) : null
  const q = search.trim().toLowerCase()
  const candidates = persons.filter(p => p.id !== target.id &&
    (!q || p.name.toLowerCase().includes(q) || (p.clan || '').toLowerCase().includes(q)))
  const finalTopic = topic === 'Other' ? customTopic.trim() : topic

  const submit = async () => {
    if (!sourceId) return alert('Choose who should we ask.')
    if (sourceId === target.id) return alert("A person can't be listed as knowing about themselves.")
    if (!finalTopic) return alert('Pick what kind of knowledge.')
    const dup = referrals.some(r => r.source_person_id === sourceId && r.target_person_id === target.id && (r.topic || '') === finalTopic)
    if (dup) return alert('That referral already exists.')
    setSaving(true)
    await onDone({
      id: 'ref_' + Date.now().toString(36),
      family_id: familyId,
      source_person_id: sourceId,
      target_person_id: target.id,
      note: note.trim(),
      topic: finalTopic,
      added_by: userName || 'Anonymous',
      created_at: new Date().toISOString(),
    })
  }

  const inp = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cdd6e6', fontSize: 13, boxSizing: 'border-box', outline: 'none' }
  const label = { fontSize: 11, fontWeight: 600, color: '#5a6b85', marginBottom: 4, display: 'block' }

  return (
    <div style={{ marginTop: 6, background: '#fff', border: '1px solid #dbe6f7', borderRadius: 8, padding: 10 }}>
      {/* 1. Source person — searchable */}
      <label style={label}>Who should we ask?</label>
      {selected ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: '#eef4fd', borderRadius: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>{selected.name}{selected.clan ? ` (${selected.clan})` : ''}</span>
          <button onClick={() => { setSourceId(''); setSearch('') }}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: BLUE, fontSize: 11, cursor: 'pointer' }}>change</button>
        </div>
      ) : (
        <div style={{ marginBottom: 10 }}>
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search family members…" style={inp} />
          <div style={{ maxHeight: 132, overflowY: 'auto', border: '1px solid #eee', borderTop: 'none', borderRadius: '0 0 6px 6px' }}>
            {candidates.length === 0
              ? <div style={{ padding: '8px 10px', fontSize: 12, color: '#bbb' }}>No matches</div>
              : candidates.slice(0, 40).map(p => (
                <div key={p.id} onClick={() => { setSourceId(p.id); setSearch('') }}
                  style={{ padding: '8px 10px', fontSize: 13, cursor: 'pointer', borderTop: '1px solid #f4f4f4' }}
                  onMouseDown={e => e.preventDefault()}>
                  {p.name}{p.clan ? <span style={{ color: '#aaa', fontSize: 11 }}> · {p.clan}</span> : ''}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 2. Topic pills */}
      <label style={label}>What kind of knowledge?</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: topic === 'Other' ? 6 : 10 }}>
        {TOPICS.map(t => {
          const on = topic === t
          return (
            <button key={t} onClick={() => setTopic(t)}
              style={{ minHeight: 44, padding: '0 14px', borderRadius: 22, cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
                border: on ? `2px solid ${BLUE}` : '1px solid #cdd6e6', background: on ? BLUE : '#fff', color: on ? '#fff' : '#556' }}>
              {t}
            </button>
          )
        })}
      </div>
      {topic === 'Other' && (
        <input value={customTopic} onChange={e => setCustomTopic(e.target.value)} placeholder="Custom topic" style={{ ...inp, marginBottom: 10 }} />
      )}

      {/* 3. Note */}
      <label style={label}>What do they know?</label>
      <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. has old wedding photos, knows village elders" style={{ ...inp, marginBottom: 12 }} />

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={submit} disabled={saving}
          style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: BLUE, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving…' : 'Save referral'}
        </button>
        <button onClick={onCancel} disabled={saving}
          style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #ddd', background: '#f5f5f5', color: '#666', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
