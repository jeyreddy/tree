import { useState } from 'react'

const FLAG_FIELDS = ['Name', 'Clan', 'Location', 'Birth year', 'Death year', 'Status', 'Gotra', 'Occupation', 'Parent link', 'Spouse link', 'Other']

export function TrustIndicator({ personId, fieldName, views, disputes }) {
  const uniqueViewers = [...new Set(views.filter(v => v.person_id === personId).map(v => v.viewed_by))].length
  const hasDispute = disputes.some(d => d.person_id === personId && d.field_name === fieldName && d.status === 'open')
  const base = { display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 9, padding: '1px 4px', borderRadius: 3, marginLeft: 4, verticalAlign: 'middle', lineHeight: 1 }
  if (hasDispute) return (
    <span title="Someone flagged this as incorrect" style={{ ...base, background: '#fff0f0', color: '#dc3545', border: '1px solid #fdd' }}>⚡ Disputed</span>
  )
  if (uniqueViewers >= 3) return (
    <span title={`${uniqueViewers} people have reviewed this record`} style={{ ...base, background: '#f0fff4', color: '#5B7553', border: '1px solid #d4edda' }}>✓ {uniqueViewers} seen</span>
  )
  if (uniqueViewers >= 1) return (
    <span title={`${uniqueViewers} person reviewed this`} style={{ ...base, background: '#fffbf0', color: '#C4A35A', border: '1px solid #ffe9a0' }}>◎ {uniqueViewers} seen</span>
  )
  return (
    <span title="No one has reviewed this yet" style={{ ...base, background: '#f8f8f8', color: '#bbb', border: '1px solid #eee' }}>● New</span>
  )
}

export function TrustSummary({ person, views, disputes, userName, historianName, onResolveDispute }) {
  const [resolvedExpanded, setResolvedExpanded] = useState(false)
  const personViews = views.filter(v => v.person_id === person.id)
  const uniqueViewers = [...new Set(personViews.map(v => v.viewed_by))]
  const count = uniqueViewers.length
  const openDisputes = disputes.filter(d => d.person_id === person.id && d.status === 'open')
  const resolvedDisputes = disputes.filter(d => d.person_id === person.id && d.status === 'resolved')
  const dotColor = count === 0 ? '#bbb' : count < 3 ? '#C4A35A' : '#5B7553'
  const canResolve = (d) => userName && (userName === d.raised_by || userName === historianName)

  return (
    <div style={{ marginTop: 10, borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: openDisputes.length > 0 ? 8 : 4 }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: dotColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
          {count}
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#555' }}>
            {count === 0 ? 'No one has reviewed this record yet' : count === 1 ? '1 person has reviewed this' : `${count} people have reviewed this`}
          </div>
          {count > 0 && <div style={{ fontSize: 9, color: '#bbb', marginTop: 1 }}>{uniqueViewers.join(', ')}</div>}
        </div>
      </div>
      {openDisputes.map(d => (
        <div key={d.id} style={{ background: '#fff5f5', border: '1px solid #fdd', borderRadius: 8, padding: '8px 10px', marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#dc3545' }}>⚡ {d.field_name} flagged</div>
            <div style={{ fontSize: 9, color: '#bbb' }}>by {d.raised_by}</div>
          </div>
          {d.reason && <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>Why: {d.reason}</div>}
          {d.suggested_value && <div style={{ fontSize: 11, color: '#333' }}>Should be: <strong>{d.suggested_value}</strong></div>}
          {canResolve(d) && (
            <button onClick={async () => {
              const note = window.prompt('Resolution note (optional):')
              if (note === null) return
              await onResolveDispute(d.id, userName, note.trim())
            }} style={{ marginTop: 6, padding: '3px 10px', fontSize: 10, fontWeight: 600, background: '#5B7553', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
              Mark Resolved
            </button>
          )}
        </div>
      ))}
      {resolvedDisputes.length > 0 && (
        <div>
          <button onClick={() => setResolvedExpanded(e => !e)}
            style={{ fontSize: 10, color: '#bbb', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: resolvedExpanded ? 4 : 0 }}>
            {resolvedExpanded ? '▾' : '▸'} {resolvedDisputes.length} resolved {resolvedDisputes.length === 1 ? 'dispute' : 'disputes'}
          </button>
          {resolvedExpanded && resolvedDisputes.map(d => (
            <div key={d.id} style={{ background: '#f5f5f5', borderRadius: 6, padding: '6px 10px', marginBottom: 4, fontSize: 10, color: '#999' }}>
              <strong>{d.field_name}</strong> — resolved by {d.resolved_by}
              {d.resolution_note && <span> · {d.resolution_note}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function FlagItForm({ person, familyId, userName, onAdd }) {
  const [open, setOpen] = useState(false)
  const [selectedField, setSelectedField] = useState(null)
  const [suggestedValue, setSuggestedValue] = useState('')
  const [reason, setReason] = useState('')

  const getCurrentValue = (field) => {
    const map = {
      'Name': person.name, 'Clan': person.clan || '', 'Location': person.location || '',
      'Birth year': person.birthYear ? String(person.birthYear) : '',
      'Death year': person.deathYear ? String(person.deathYear) : '',
      'Status': person.status || '', 'Gotra': person.gotra || '',
      'Occupation': person.occupation?.role || person.occupation?.company || '',
    }
    return map[field] || ''
  }

  const reset = () => { setOpen(false); setSelectedField(null); setSuggestedValue(''); setReason('') }

  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ width: '100%', padding: '6px', marginTop: 6, borderRadius: 6, border: '1px dashed #fdd', background: '#fff8f8', cursor: 'pointer', fontSize: 11, color: '#dc3545', fontWeight: 500 }}>
      🤔 Something look wrong? Flag it
    </button>
  )

  return (
    <div style={{ marginTop: 6, padding: '10px', background: '#fff8f8', borderRadius: 8, border: '1px solid #fdd' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#dc3545' }}>{selectedField ? `Flag: ${selectedField}` : 'What looks wrong?'}</div>
        <button onClick={reset} style={{ background: 'none', border: 'none', fontSize: 18, color: '#ccc', cursor: 'pointer', lineHeight: 1 }}>×</button>
      </div>
      {!selectedField ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
          {FLAG_FIELDS.map(f => (
            <button key={f} onClick={() => setSelectedField(f)}
              style={{ padding: '9px 4px', fontSize: 12, fontWeight: 500, background: '#fff', border: '1px solid #fdd', borderRadius: 6, cursor: 'pointer', color: '#333', textAlign: 'center' }}>
              {f}
            </button>
          ))}
        </div>
      ) : (
        <div>
          {getCurrentValue(selectedField) && (
            <div style={{ fontSize: 10, color: '#bbb', marginBottom: 6 }}>Current: {getCurrentValue(selectedField)}</div>
          )}
          <input value={suggestedValue} onChange={e => setSuggestedValue(e.target.value)}
            placeholder="What should it be? (optional)"
            style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #fdd', fontSize: 12, marginBottom: 5, boxSizing: 'border-box' }} />
          <input value={reason} onChange={e => setReason(e.target.value)}
            placeholder="How do you know? *"
            style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #fdd', fontSize: 12, marginBottom: 8, boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 5 }}>
            <button onClick={async () => {
              if (!reason.trim()) return alert('Please explain how you know')
              if (!userName) return alert('Set your name first (top of family screen)')
              const d = {
                id: 'disp_' + Date.now().toString(36),
                family_id: familyId,
                person_id: person.id,
                field_name: selectedField,
                current_value: getCurrentValue(selectedField),
                suggested_value: suggestedValue.trim(),
                reason: reason.trim(),
                raised_by: userName,
                status: 'open',
              }
              await onAdd(d)
              reset()
            }} style={{ flex: 1, padding: '7px', fontSize: 11, fontWeight: 600, background: '#dc3545', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
              Submit Flag
            </button>
            <button onClick={() => { setSelectedField(null); setSuggestedValue(''); setReason('') }}
              style={{ padding: '7px 10px', fontSize: 11, background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
              ← Back
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
