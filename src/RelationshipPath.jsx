import { useState } from 'react'
import { findPath, classifyRelationship } from './RelationshipEngine'

const MAX_HOPS = 10

function Avatar({ person, size = 42 }) {
  const initial = (person?.name || '?').trim().charAt(0).toUpperCase()
  if (person?.photoUrl) {
    return <img src={person.photoUrl} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid #eee' }} />
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#e8eef7', color: '#5a6b85', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: Math.round(size * 0.42), border: '2px solid #eee', flexShrink: 0 }}>
      {initial}
    </div>
  )
}

// Label for the arrow between two adjacent path nodes: "leftNode is <label> of rightNode".
// classifyRelationship(right, left) yields how `left` relates to `right`.
function edgeLabel(leftId, rightId, persons, lang) {
  const rel = classifyRelationship(rightId, leftId, persons, lang)
  if (!rel) return 'related to'
  return rel.englishLabel.toLowerCase() + ' of'
}

export default function RelationshipPathCard({ aId, bId, persons, language = 'english', famId, onClose }) {
  const [copied, setCopied] = useState(false)
  const A = persons.find(p => p.id === aId)
  const B = persons.find(p => p.id === bId)
  if (!A || !B) return null

  const lang = (language || 'english').toLowerCase()
  const path = findPath(aId, bId, persons)
  const hops = path ? path.length - 1 : 0

  const overall = classifyRelationship(aId, bId, persons, lang)
  const specific = overall && overall.key !== 'relative' && overall.key !== 'self'
  const summaryEn = specific ? `${B.name} is ${A.name}'s ${overall.englishLabel}` : `${A.name} and ${B.name} are relatives`
  const regionalTerm = overall && lang !== 'english' && overall.label !== overall.englishLabel ? overall.label : null

  const url = `${window.location.origin}${window.location.pathname}?family=${famId}`
  const shareText = `${A.name} and ${B.name} are related: ${summaryEn}${regionalTerm ? ` (${regionalTerm})` : ''}. See our family tree: ${url}`

  const doShare = async () => {
    try { await navigator.clipboard.writeText(shareText); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { window.prompt('Copy this:', shareText) }
  }

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 460, maxHeight: '85vh', overflowY: 'auto', padding: 20, boxShadow: '0 12px 40px rgba(0,0,0,0.3)', fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>How they're related</div>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 22, color: '#ccc', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {!path ? (
          <div style={{ padding: '24px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>🔍</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#666' }}>No connection found</div>
            <div style={{ fontSize: 12, marginTop: 6, color: '#999' }}>{A.name} and {B.name} aren't linked in this family tree yet.</div>
          </div>
        ) : hops > MAX_HOPS ? (
          <div style={{ padding: '24px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>🌐</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#666' }}>Distantly related</div>
            <div style={{ fontSize: 12, marginTop: 6, color: '#999' }}>{A.name} and {B.name} are more than 10 steps apart.</div>
          </div>
        ) : (
          <>
            {/* Path chain — scrolls horizontally on small screens */}
            <div style={{ display: 'flex', alignItems: 'flex-start', overflowX: 'auto', paddingBottom: 10, marginBottom: 14 }}>
              {path.map((id, i) => {
                const p = persons.find(x => x.id === id)
                const edge = i < path.length - 1 ? edgeLabel(id, path[i + 1], persons, lang) : null
                return (
                  <div key={id} style={{ display: 'flex', alignItems: 'flex-start', flexShrink: 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 66 }}>
                      <Avatar person={p} />
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#333', marginTop: 5, textAlign: 'center', lineHeight: 1.2 }}>
                        {p?.name?.length > 16 ? p.name.slice(0, 14) + '…' : p?.name}
                      </div>
                    </div>
                    {edge && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 64, paddingTop: 10 }}>
                        <div style={{ fontSize: 9, color: '#4A6FA5', fontWeight: 700, whiteSpace: 'nowrap', marginBottom: 2 }}>{edge}</div>
                        <div style={{ fontSize: 15, color: '#bbb', lineHeight: 1 }}>→</div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Summary */}
            <div style={{ background: '#f7f9fc', borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a' }}>{summaryEn}</div>
              {regionalTerm && (
                <div style={{ fontSize: 14, color: '#4A6FA5', marginTop: 5, fontWeight: 600 }}>
                  {regionalTerm}
                  <span style={{ fontSize: 10, color: '#aaa', fontWeight: 400, marginLeft: 6 }}>({overall.englishLabel})</span>
                </div>
              )}
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 5 }}>{hops} step{hops !== 1 ? 's' : ''} apart</div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={doShare}
                style={{ flex: 1, padding: '11px', borderRadius: 8, border: 'none', background: '#1a1a1a', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                {copied ? 'Copied ✓' : 'Share'}
              </button>
              <button onClick={onClose}
                style={{ padding: '11px 20px', borderRadius: 8, border: '1px solid #ddd', background: '#f5f5f5', color: '#666', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
