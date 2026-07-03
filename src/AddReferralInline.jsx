import { useState } from 'react'

export function AddReferralInline({ targetId, persons, familyId, userName, onAdd }) {
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
