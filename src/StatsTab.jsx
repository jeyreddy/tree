const CLAN_COLORS = ['#C4A35A', '#6B8E6B', '#5C7FB5', '#9B6BA0', '#C97B5D', '#7BAAAA', '#A0522D', '#708090']

function titleCase(str) {
  if (!str) return ''
  return str.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

function computeCompleteness(persons) {
  if (persons.length === 0) return { score: 0, missing: [] }
  let totalFields = 0, filledFields = 0
  const checks = { missingLocation: 0, missingBirthYear: 0, missingClan: 0, missingPhone: 0, missingSpouse: 0, unverified: 0, missingOccupation: 0, missingProfiles: 0 }
  const thisYear = new Date().getFullYear()
  persons.forEach(p => {
    totalFields += 6
    if (p.name) filledFields++
    if (p.clan) filledFields++; else checks.missingClan++
    if (p.location) filledFields++; else checks.missingLocation++
    if (p.birthYear) filledFields++; else checks.missingBirthYear++
    if (p.phone) filledFields++; else checks.missingPhone++
    if (p.verified) filledFields++; else checks.unverified++
    totalFields += 1
    if (p.spouseId || p.status === 'deceased' || (p.birthYear && thisYear - p.birthYear < 20)) filledFields++
    else checks.missingSpouse++
    totalFields += 2
    if (p.occupation?.role || p.occupation?.company) filledFields++; else checks.missingOccupation++
    const hasAnyProfile = p.profiles && Object.values(p.profiles).some(v => v)
    if (hasAnyProfile) filledFields++; else checks.missingProfiles++
  })
  const score = totalFields > 0 ? Math.round(filledFields / totalFields * 100) : 0
  const missing = [
    { label: 'missing location', count: checks.missingLocation, icon: '📍' },
    { label: 'missing birth year', count: checks.missingBirthYear, icon: '📅' },
    { label: 'unverified', count: checks.unverified, icon: '❓' },
    { label: 'missing phone', count: checks.missingPhone, icon: '📱' },
    { label: 'no spouse linked', count: checks.missingSpouse, icon: '♥' },
    { label: 'no occupation', count: checks.missingOccupation, icon: '💼' },
    { label: 'no social profiles', count: checks.missingProfiles, icon: '🔗' },
    { label: 'missing clan', count: checks.missingClan, icon: '🏷' },
  ].filter(m => m.count > 0).sort((a, b) => b.count - a.count)
  return { score, missing }
}

function completenessColor(score) {
  if (score >= 80) return '#5B7553'
  if (score >= 50) return '#C4A35A'
  if (score >= 25) return '#E8A87C'
  return '#9B4F5C'
}

function computeContributors(persons) {
  const stats = {}
  persons.forEach(p => {
    if (p.addedBy) {
      if (!stats[p.addedBy]) stats[p.addedBy] = { name: p.addedBy, added: 0, edited: 0, total: 0 }
      stats[p.addedBy].added++
      stats[p.addedBy].total++
    }
    if (p.lastEditedBy && p.lastEditedBy !== p.addedBy) {
      if (!stats[p.lastEditedBy]) stats[p.lastEditedBy] = { name: p.lastEditedBy, added: 0, edited: 0, total: 0 }
      stats[p.lastEditedBy].edited++
      stats[p.lastEditedBy].total++
    }
  })
  return Object.values(stats).sort((a, b) => b.total - a.total)
}

function computeBranchStats(persons) {
  const clanGroups = {}
  persons.forEach(p => {
    const clan = titleCase(p.clan) || 'Unknown'
    if (!clanGroups[clan]) clanGroups[clan] = []
    clanGroups[clan].push(p)
  })
  const clanList = Object.keys(clanGroups).sort()
  return clanList.map((clan, i) => {
    const members = clanGroups[clan]
    let filled = 0, total = 0
    members.forEach(m => {
      total += 5
      if (m.location) filled++
      if (m.birthYear) filled++
      if (m.phone) filled++
      if (m.verified) filled++
      if (m.occupation?.role || m.occupation?.company) filled++
    })
    return { name: clan, count: members.length, completeness: total > 0 ? Math.round(filled / total * 100) : 0, color: CLAN_COLORS[i % CLAN_COLORS.length] }
  }).sort((a, b) => a.completeness - b.completeness)
}

function computeRecentActivity(persons) {
  return [...persons]
    .filter(p => p.addedBy || p.lastEditedBy)
    .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))
    .slice(0, 15)
    .map(p => ({
      name: p.name,
      by: p.lastEditedBy || p.addedBy || 'Unknown',
      action: p.lastEditedBy && p.lastEditedBy !== p.addedBy ? 'edited' : 'added',
      date: p.updated_at || p.created_at,
    }))
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea')
  ta.value = text
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  document.body.removeChild(ta)
  alert('Copied! Paste in WhatsApp.')
}

export default function StatsTab({ persons, fam, views = [], disputes = [] }) {
  const { score: completenessScore, missing: missingData } = computeCompleteness(persons)
  const contributors = computeContributors(persons)
  const branchStats = computeBranchStats(persons)
  const recentActivity = computeRecentActivity(persons)

  const trustedCount = persons.filter(p => {
    const unique = [...new Set(views.filter(v => v.person_id === p.id).map(v => v.viewed_by))].length
    return unique >= 3
  }).length
  const seenCount = persons.filter(p => {
    const unique = [...new Set(views.filter(v => v.person_id === p.id).map(v => v.viewed_by))].length
    return unique >= 1 && unique < 3
  }).length
  const openDisputes = disputes.filter(d => d.status === 'open')

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 20 }}>

      {/* ── COMPLETENESS SCORE ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Family Completeness</h2>
          <span style={{ fontSize: 24, fontWeight: 700, color: completenessColor(completenessScore) }}>
            {completenessScore}%
          </span>
        </div>
        <div style={{ height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ height: '100%', width: `${completenessScore}%`, background: completenessColor(completenessScore), borderRadius: 4, transition: 'width 0.5s ease' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {missingData.map(({ label, count, icon }) => (
            <div key={label} style={{ background: '#fafafa', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #f0f0f0' }}>
              <span style={{ fontSize: 16 }}>{icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>{count}</div>
                <div style={{ fontSize: 10, color: '#999' }}>{label}</div>
              </div>
            </div>
          ))}
        </div>
        {completenessScore === 100 && (
          <div style={{ background: '#d4edda', borderRadius: 8, padding: '12px 16px', marginTop: 12, fontSize: 14, color: '#155724', textAlign: 'center', fontWeight: 600 }}>
            🌳 Family tree is complete! Amazing work.
          </div>
        )}
      </div>

      {/* ── DATA TRUST ── */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Data Trust</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          <div style={{ background: '#f0fff4', borderRadius: 10, padding: '12px 8px', textAlign: 'center', border: '1px solid #d4edda' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#5B7553' }}>{trustedCount}</div>
            <div style={{ fontSize: 10, color: '#5B7553', fontWeight: 600 }}>Trusted</div>
            <div style={{ fontSize: 9, color: '#bbb' }}>3+ reviewers</div>
          </div>
          <div style={{ background: '#fffbf0', borderRadius: 10, padding: '12px 8px', textAlign: 'center', border: '1px solid #ffe9a0' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#C4A35A' }}>{seenCount}</div>
            <div style={{ fontSize: 10, color: '#C4A35A', fontWeight: 600 }}>Seen</div>
            <div style={{ fontSize: 9, color: '#bbb' }}>1–2 reviewers</div>
          </div>
          <div style={{ background: openDisputes.length > 0 ? '#fff5f5' : '#fafafa', borderRadius: 10, padding: '12px 8px', textAlign: 'center', border: `1px solid ${openDisputes.length > 0 ? '#fdd' : '#f0f0f0'}` }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: openDisputes.length > 0 ? '#dc3545' : '#bbb' }}>{openDisputes.length}</div>
            <div style={{ fontSize: 10, color: openDisputes.length > 0 ? '#dc3545' : '#bbb', fontWeight: 600 }}>Disputes</div>
            <div style={{ fontSize: 9, color: '#bbb' }}>open flags</div>
          </div>
        </div>
        {openDisputes.length > 0 && openDisputes.map(d => {
          const p = persons.find(x => x.id === d.person_id)
          return (
            <div key={d.id} style={{ padding: '8px 10px', marginBottom: 6, background: '#fff5f5', borderRadius: 8, border: '1px solid #fdd', fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <strong>{p?.name || 'Unknown'}</strong>
                <span style={{ fontSize: 10, color: '#bbb' }}>by {d.raised_by}</span>
              </div>
              <div style={{ color: '#dc3545', fontSize: 11 }}>{d.field_name} · {d.reason}</div>
              {d.suggested_value && <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>Should be: {d.suggested_value}</div>}
            </div>
          )
        })}
      </div>

      {/* ── CONTRIBUTOR LEADERBOARD ── */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Contributors</h2>
        {contributors.length === 0 && (
          <div style={{ color: '#ccc', fontSize: 13, textAlign: 'center', padding: 20 }}>
            No contributions tracked yet. Set your name to start.
          </div>
        )}
        {contributors.map((contrib, i) => (
          <div key={contrib.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', marginBottom: 6, background: i === 0 ? '#fdf8f0' : '#fff', borderRadius: 10, border: `1px solid ${i === 0 ? '#E8DCC8' : '#f0f0f0'}` }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, background: i === 0 ? '#C4A35A' : i === 1 ? '#999' : i === 2 ? '#A0522D' : '#e0e0e0', color: i < 3 ? '#fff' : '#888' }}>
              {i + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>
                {contrib.name}
                {contrib.name === fam?.historian_name && (
                  <span style={{ fontSize: 9, background: '#C4A35A', color: '#fff', padding: '2px 6px', borderRadius: 4, marginLeft: 6, fontWeight: 700, letterSpacing: 0.5 }}>HISTORIAN</span>
                )}
              </div>
              <div style={{ fontSize: 10, color: '#999' }}>{contrib.added} added · {contrib.edited} edited</div>
            </div>
            <div style={{ width: 60, textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#333' }}>{contrib.total}</div>
              <div style={{ fontSize: 9, color: '#bbb' }}>entries</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── BRANCH COVERAGE ── */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Branch Coverage</h2>
        <p style={{ fontSize: 12, color: '#999', marginBottom: 10 }}>Which branches need more detail? Your family can help fill their own.</p>
        {branchStats.map(branch => (
          <div key={branch.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 4, background: '#fafafa', borderRadius: 8 }}>
            <div style={{ width: 4, height: 32, borderRadius: 2, background: branch.color }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{branch.name}</div>
              <div style={{ fontSize: 10, color: '#999' }}>{branch.count} members · {branch.completeness}% complete</div>
            </div>
            <div style={{ width: 60 }}>
              <div style={{ height: 4, background: '#e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${branch.completeness}%`, background: branch.color, borderRadius: 2 }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── RECENT ACTIVITY ── */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Recent Activity</h2>
        {recentActivity.length === 0 && (
          <div style={{ color: '#ccc', fontSize: 13, textAlign: 'center', padding: 20 }}>No activity yet</div>
        )}
        {recentActivity.map((activity, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid #f5f5f5', fontSize: 12 }}>
            <span style={{ color: '#ccc', fontSize: 10, whiteSpace: 'nowrap' }}>
              {activity.date ? new Date(activity.date).toLocaleDateString() : '—'}
            </span>
            <span style={{ color: '#666' }}>
              <strong>{activity.by}</strong> {activity.action} <strong>{activity.name}</strong>
            </span>
          </div>
        ))}
      </div>

      {/* ── SHARE ── */}
      <button className="btn btn-dark" style={{ width: '100%', marginTop: 16, padding: 14, fontSize: 14 }}
        onClick={() => {
          const text =
            `🌳 ${fam?.name || 'Family'} Tree — ${completenessScore}% complete!\n\n` +
            `${persons.length} family members documented.\n` +
            `Trust: ${trustedCount} entries trusted (3+ reviewers)${openDisputes.length > 0 ? `, ${openDisputes.length} disputes open` : ''}.\n` +
            (missingData.length > 0
              ? `\nStill needed:\n${missingData.slice(0, 4).map(m => `${m.icon} ${m.count} ${m.label}`).join('\n')}\n`
              : '\n✅ All data complete!\n') +
            `\nContributors:\n${contributors.slice(0, 3).map((c, i) => `${i + 1}. ${c.name} (${c.total} entries)`).join('\n')}\n` +
            `\nHelp us fill the gaps! Open: ${window.location.href}`
          if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => alert('Copied! Paste in WhatsApp to share with family.')).catch(() => fallbackCopy(text))
          } else {
            fallbackCopy(text)
          }
        }}>
        📋 Copy Progress for WhatsApp
      </button>
    </div>
  )
}
