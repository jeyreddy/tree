import { useState } from 'react'

const inp = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 15, boxSizing: 'border-box', outline: 'none' }
const label = { fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' }

function Dots({ step }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 22 }}>
      {[1, 2, 3].map(n => (
        <div key={n} style={{ width: 8, height: 8, borderRadius: '50%', background: n <= step ? '#1a1a1a' : '#dcdcdc', transition: 'background 0.2s' }} />
      ))}
    </div>
  )
}

export default function OnboardingFlow({ familyName, initialUserName = '', onComplete, onCancel }) {
  const [step, setStep] = useState(1)
  const [name, setName] = useState(initialUserName)
  const [maleName, setMaleName] = useState('')
  const [maleClan, setMaleClan] = useState('')
  const [femaleName, setFemaleName] = useState('')
  const [femaleClan, setFemaleClan] = useState('')
  const [busy, setBusy] = useState(false)

  const canFinish = maleName.trim() && femaleName.trim() && !busy

  const finish = async () => {
    if (!canFinish) return
    setBusy(true)
    try {
      await onComplete({
        familyName,
        userName: name.trim(),
        male: { name: maleName.trim(), clan: maleClan.trim() },
        female: { name: femaleName.trim(), clan: femaleClan.trim() },
      })
    } catch (e) {
      setBusy(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, padding: '28px 24px 24px', boxShadow: '0 12px 40px rgba(0,0,0,0.15)', fontFamily: "'DM Sans', sans-serif" }}>
        <Dots step={step} />

        {step === 1 && (
          <>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.3, marginBottom: 10 }}>
              This is Kula Vruksham — your family tree, built by your family.
            </div>
            <div style={{ fontSize: 14, color: '#888', marginBottom: 6 }}>Start by adding the oldest couple you remember.</div>
            {familyName && <div style={{ fontSize: 12, color: '#bbb', marginBottom: 24 }}>Creating the <strong style={{ color: '#999' }}>{familyName}</strong> family tree</div>}
            <button className="btn btn-dark btn-full" style={{ marginTop: 8 }} onClick={() => setStep(2)}>Next</button>
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <span onClick={onCancel} style={{ fontSize: 12, color: '#bbb', cursor: 'pointer' }}>Cancel</span>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', marginBottom: 6 }}>What's your name?</div>
            <div style={{ fontSize: 13, color: '#999', marginBottom: 18 }}>So your family knows who's building the tree. You'll be the historian.</div>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && name.trim()) setStep(3) }}
              placeholder="Your name"
              style={inp}
            />
            <button className="btn btn-dark btn-full" style={{ marginTop: 20, opacity: name.trim() ? 1 : 0.4 }} disabled={!name.trim()} onClick={() => setStep(3)}>Next</button>
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <span onClick={() => setStep(1)} style={{ fontSize: 12, color: '#bbb', cursor: 'pointer' }}>Back</span>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', marginBottom: 6 }}>Who are the elders?</div>
            <div style={{ fontSize: 13, color: '#999', marginBottom: 18 }}>The oldest couple you remember. You can add everyone else after.</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 150px' }}>
                <label style={label}>Oldest man</label>
                <input value={maleName} onChange={e => setMaleName(e.target.value)} placeholder="His name" style={{ ...inp, marginBottom: 6 }} />
                <input value={maleClan} onChange={e => setMaleClan(e.target.value)} placeholder="Clan (optional)" style={inp} />
              </div>
              <div style={{ flex: '1 1 150px' }}>
                <label style={label}>His wife</label>
                <input value={femaleName} onChange={e => setFemaleName(e.target.value)} placeholder="Her name" style={{ ...inp, marginBottom: 6 }} />
                <input value={femaleClan} onChange={e => setFemaleClan(e.target.value)} placeholder="Clan (optional)" style={inp} />
              </div>
            </div>
            <button className="btn btn-dark btn-full" style={{ marginTop: 20, opacity: canFinish ? 1 : 0.4 }} disabled={!canFinish} onClick={finish}>
              {busy ? 'Building…' : 'Start building'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <span onClick={() => !busy && setStep(2)} style={{ fontSize: 12, color: '#bbb', cursor: busy ? 'default' : 'pointer' }}>Back</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
