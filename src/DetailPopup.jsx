import { useEffect } from 'react'
import { TrustIndicator, TrustSummary, FlagItForm } from './TrustIndicator'
import { classifyRelationship, findPath } from './RelationshipEngine'
import { db } from './db'
import { AddReferralInline } from './AddReferralInline'

export function DetailPopup({ person, position, persons, REL, onClose, onEdit, onAdd, onDelete, onVerify, onFocus, onForceDelete, familyId, userName, referrals = [], setReferrals, views = [], disputes = [], historianName = '', onAddDispute, onResolveDispute, onAutoView, fam = null, focusId = null }) {
  useEffect(() => { if (onAutoView && person?.id) onAutoView(person.id) }, [person?.id])
  const spouse = person.spouseId ? persons.find(p => p.id === person.spouseId) : null
  const dead = person.status === 'deceased'
  const popupW = 300, popupH = 580
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

        {person.photoUrl && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
            <img src={person.photoUrl} alt={person.name}
              style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: dead ? '2px dashed #ccc' : '2px solid #eee', filter: dead ? 'grayscale(0.4)' : 'none' }} />
          </div>
        )}

        <div style={{ fontSize: 17, fontWeight: 700, color: dead ? '#aaa' : '#1a1a1a', textDecoration: dead ? 'line-through' : 'none', marginBottom: 2, paddingRight: 24 }}>
          {dead ? '✝ ' : ''}{person.name}<TrustIndicator personId={person.id} fieldName="name" views={views} disputes={disputes} />
        </div>

        {focusId && person.id !== focusId && (() => {
          const rel = classifyRelationship(focusId, person.id, persons, fam?.language || 'english')
          if (!rel) return null
          const weightColor = { highest: '#8B6914', very_high: '#C97B5D', high: '#5B7553', medium: '#999', low: '#ccc' }
          return (
            <div style={{ borderLeft: `3px solid ${weightColor[rel.weight] || '#ccc'}`, padding: '6px 8px 6px 11px', marginBottom: 8, background: '#fafafa', borderRadius: '0 6px 6px 0' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{rel.label}</div>
              {rel.label !== rel.englishLabel && <div style={{ fontSize: 10, color: '#999' }}>{rel.englishLabel}</div>}
              {rel.note && <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>{rel.note}</div>}
            </div>
          )
        })()}

        {focusId && person.id !== focusId && (() => {
          const path = findPath(focusId, person.id, persons)
          if (!path || path.length <= 2) return null
          return (
            <div style={{ marginBottom: 8, background: '#f8f8ff', borderRadius: 6, padding: '6px 8px' }}>
              <div style={{ fontSize: 9, color: '#bbb', marginBottom: 4, fontWeight: 500, letterSpacing: 0.5 }}>HOW ARE WE RELATED?</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
                {path.map((nodeId, idx) => {
                  const p = persons.find(x => x.id === nodeId)
                  if (!p) return null
                  const isEndpoint = nodeId === focusId || nodeId === person.id
                  return (
                    <span key={nodeId} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      {idx > 0 && <span style={{ color: '#ccc', fontSize: 10 }}>→</span>}
                      <span
                        onClick={() => !isEndpoint && onFocus(nodeId)}
                        style={{
                          fontSize: 10,
                          color: nodeId === focusId ? '#C4A35A' : nodeId === person.id ? '#1a1a1a' : '#4A6FA5',
                          cursor: isEndpoint ? 'default' : 'pointer',
                          fontWeight: isEndpoint ? 600 : 400,
                          textDecoration: !isEndpoint ? 'underline' : 'none',
                        }}
                      >
                        {p.name.length > 14 ? p.name.slice(0, 12) + '…' : p.name}
                      </span>
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {person.role && <div style={{ fontSize: 11, color: '#999', marginBottom: 8 }}>{person.role}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 12, marginBottom: 8 }}>
          {[['Clan', person.clan || '—', 'clan'], ['Location', person.location || '—', 'location'], ['Status', dead ? 'Deceased' : 'Living', 'status'], ['Gen', `${person.generation}`, null]].map(([l, v, f]) => (
            <div key={l}><span style={{ display: 'block', color: '#bbb', fontSize: 10 }}>{l}{f && <TrustIndicator personId={person.id} fieldName={f} views={views} disputes={disputes} />}</span>{v}</div>
          ))}
          {person.birthYear && (
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={{ display: 'block', color: '#bbb', fontSize: 10 }}>Age<TrustIndicator personId={person.id} fieldName="birth_year" views={views} disputes={disputes} /></span>
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
            <span style={{ display: 'block', color: '#bbb', fontSize: 10 }}>Occupation<TrustIndicator personId={person.id} fieldName="occupation" views={views} disputes={disputes} /></span>
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
        {!person.parentId ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
            <button className="btn btn-gold btn-sm" onClick={() => onAdd('ancestor', 'M')}>↑ {REL?.father || 'Father'}</button>
            <button className="btn btn-gold btn-sm" onClick={() => onAdd('ancestor', 'F')}>↑ {REL?.mother || 'Mother'}</button>
          </div>
        ) : (
          <div style={{ fontSize: 10, color: '#bbb', marginBottom: 4 }}>
            To add grandparents, open their parent's own record and add Father/Mother there.
          </div>
        )}
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

        <TrustSummary person={person} views={views} disputes={disputes} userName={userName} historianName={historianName} onResolveDispute={onResolveDispute} />
        <FlagItForm person={person} familyId={familyId} userName={userName} onAdd={onAddDispute} />

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
