import { useState, useEffect, useRef } from 'react'
import { classifyRelationship, getWeightValue } from './RelationshipEngine'

const CLAN_COLORS = ['#C4A35A', '#6B8E6B', '#5C7FB5', '#9B6BA0', '#C97B5D', '#7BAAAA', '#A0522D', '#708090']
const RING_RADII = [0, 130, 260, 380, 490]
const RING_LABELS = ['You', 'Immediate Family', 'Extended Family', 'In-law Family', 'Connected Network']
const RING_FILLS = [
  'transparent',
  'rgba(200,180,140,0.10)',
  'rgba(160,160,180,0.06)',
  'rgba(140,160,180,0.04)',
  'rgba(120,120,140,0.02)',
]

function titleCase(str) {
  if (!str) return ''
  return str.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

function getClanColor(clan, allClans) {
  if (!clan) return '#888'
  const idx = allClans.indexOf(clan)
  return idx >= 0 ? CLAN_COLORS[idx % CLAN_COLORS.length] : '#888'
}

// Deterministic 0..1 from a string — for stable layout without Math.random()
function hash01(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0
  return ((h >>> 0) % 10000) / 10000
}

function countDesc(id, persons) {
  const kids = persons.filter(p => p.parentId === id)
  return kids.length + kids.reduce((s, c) => s + countDesc(c.id, persons), 0)
}

function assignRings(focusId, persons) {
  const focus = persons.find(p => p.id === focusId)
  if (!focus) return new Map()

  const assignments = new Map()
  assignments.set(focusId, { ring: 0, role: 'self' })

  const spouse = focus.spouseId ? persons.find(p => p.id === focus.spouseId) : null
  const parent = focus.parentId ? persons.find(p => p.id === focus.parentId) : null
  const parentSpouse = parent?.spouseId ? persons.find(p => p.id === parent.spouseId) : null

  // ── Ring 1: immediate family ──
  if (spouse) assignments.set(spouse.id, { ring: 1, role: 'spouse' })
  persons.forEach(p => {
    if (p.parentId === focusId || (spouse && p.parentId === spouse.id)) {
      if (!assignments.has(p.id)) assignments.set(p.id, { ring: 1, role: 'child' })
    }
  })
  if (parent) assignments.set(parent.id, { ring: 1, role: 'parent' })
  if (parentSpouse && !assignments.has(parentSpouse.id)) {
    assignments.set(parentSpouse.id, { ring: 1, role: 'parent' })
  }

  // ── Ring 2: extended family ──
  if (focus.parentId) {
    persons.forEach(p => {
      if ((p.parentId === focus.parentId || (parentSpouse && p.parentId === parentSpouse.id)) && p.id !== focusId) {
        if (!assignments.has(p.id)) assignments.set(p.id, { ring: 2, role: 'sibling' })
        if (p.spouseId && !assignments.has(p.spouseId)) {
          assignments.set(p.spouseId, { ring: 2, role: 'sibling-spouse' })
        }
        const sibSpouseId = p.spouseId
        persons.forEach(c => {
          if (c.parentId === p.id || (sibSpouseId && c.parentId === sibSpouseId)) {
            if (!assignments.has(c.id)) assignments.set(c.id, { ring: 2, role: 'nephew-niece' })
          }
        })
      }
    })
  }
  // Children's spouses
  assignments.forEach((val, id) => {
    if (val.ring === 1 && val.role === 'child') {
      const child = persons.find(p => p.id === id)
      if (child?.spouseId && !assignments.has(child.spouseId)) {
        assignments.set(child.spouseId, { ring: 2, role: 'child-spouse' })
      }
    }
  })
  // Grandchildren
  assignments.forEach((val, id) => {
    if (val.ring === 1 && val.role === 'child') {
      const child = persons.find(p => p.id === id)
      const csId = child?.spouseId
      persons.forEach(gc => {
        if (gc.parentId === id || (csId && gc.parentId === csId)) {
          if (!assignments.has(gc.id)) assignments.set(gc.id, { ring: 2, role: 'grandchild' })
        }
      })
    }
  })
  // Grandparents
  const addGp = (p) => {
    if (!p?.parentId) return
    const gp = persons.find(x => x.id === p.parentId)
    if (gp && !assignments.has(gp.id)) {
      assignments.set(gp.id, { ring: 2, role: 'grandparent' })
      if (gp.spouseId && !assignments.has(gp.spouseId)) {
        assignments.set(gp.spouseId, { ring: 2, role: 'grandparent' })
      }
    }
  }
  addGp(parent)
  addGp(parentSpouse)

  // ── Ring 3: in-law family ──
  if (spouse) {
    const sp = spouse.parentId ? persons.find(p => p.id === spouse.parentId) : null
    if (sp && !assignments.has(sp.id)) {
      assignments.set(sp.id, { ring: 3, role: 'in-law-parent' })
      if (sp.spouseId && !assignments.has(sp.spouseId)) {
        assignments.set(sp.spouseId, { ring: 3, role: 'in-law-parent' })
      }
    }
    if (spouse.parentId) {
      const spParentSpouseId = sp?.spouseId
      persons.forEach(p => {
        if ((p.parentId === spouse.parentId || (spParentSpouseId && p.parentId === spParentSpouseId)) && p.id !== spouse.id) {
          if (!assignments.has(p.id)) assignments.set(p.id, { ring: 3, role: 'spouse-sibling' })
        }
      })
    }
  }
  // Children's in-law families
  assignments.forEach((val, id) => {
    if ((val.role === 'child-spouse' || val.role === 'child') && val.ring <= 2) {
      const p = persons.find(x => x.id === id)
      if (p?.parentId && !assignments.has(p.parentId)) {
        const par = persons.find(x => x.id === p.parentId)
        if (par) {
          assignments.set(par.id, { ring: 3, role: 'child-in-law-parent' })
          if (par.spouseId && !assignments.has(par.spouseId)) {
            assignments.set(par.spouseId, { ring: 3, role: 'child-in-law-parent' })
          }
        }
      }
    }
  })

  // ── Ring 4: everyone else ──
  persons.forEach(p => {
    if (!assignments.has(p.id)) assignments.set(p.id, { ring: 4, role: 'extended' })
  })

  return assignments
}

function positionNodes(focusId, assignments, persons, cx, cy) {
  const nodes = []
  const rings = [[], [], [], [], []]
  assignments.forEach((val, id) => {
    if (val.ring >= 0 && val.ring <= 4) rings[val.ring].push({ id, ...val })
  })

  // Ring 0: center
  rings[0].forEach(n => nodes.push({ id: n.id, x: cx, y: cy, ring: 0, role: n.role, r: 30 }))

  // Ring 1: structured — parents top, spouse right, children bottom
  const r1p = rings[1].filter(n => n.role === 'parent')
  const r1s = rings[1].filter(n => n.role === 'spouse')
  const r1c = rings[1].filter(n => n.role === 'child')

  r1p.forEach((n, i) => {
    const spread = r1p.length > 1 ? (i - (r1p.length - 1) / 2) * 0.5 : 0
    const angle = -Math.PI / 2 + spread
    nodes.push({ id: n.id, x: cx + Math.cos(angle) * RING_RADII[1], y: cy + Math.sin(angle) * RING_RADII[1], ring: 1, role: n.role, r: 24 })
  })

  r1s.forEach(n => {
    nodes.push({ id: n.id, x: cx + RING_RADII[1] * 0.9, y: cy, ring: 1, role: n.role, r: 26 })
  })

  r1c.forEach((n, i) => {
    const totalSpread = Math.min(r1c.length * 0.4, 1.5)
    const spread = r1c.length > 1 ? (i - (r1c.length - 1) / 2) * (totalSpread / (r1c.length - 1 || 1)) : 0
    const angle = Math.PI / 2 + spread
    nodes.push({ id: n.id, x: cx + Math.cos(angle) * RING_RADII[1], y: cy + Math.sin(angle) * RING_RADII[1], ring: 1, role: n.role, r: 22 })
  })

  // Rings 2–4: anchor near closest inner-ring relative
  for (let ring = 2; ring <= 4; ring++) {
    const rNodes = rings[ring]
    if (!rNodes.length) continue

    rNodes.forEach((n, i) => {
      const person = persons.find(p => p.id === n.id)
      let anchor = null
      if (person?.parentId) anchor = nodes.find(x => x.id === person.parentId)
      if (!anchor && person?.spouseId) anchor = nodes.find(x => x.id === person.spouseId)

      let angle
      if (anchor) {
        angle = Math.atan2(anchor.y - cy, anchor.x - cx) + (hash01(n.id) - 0.5) * 0.55
      } else {
        angle = (i / rNodes.length) * Math.PI * 2 - Math.PI / 2
      }

      const nodeR = ring === 2 ? 18 : ring === 3 ? 15 : 12
      nodes.push({
        id: n.id,
        x: cx + Math.cos(angle) * RING_RADII[ring],
        y: cy + Math.sin(angle) * RING_RADII[ring],
        ring, role: n.role, r: nodeR,
      })
    })
  }

  // Resolve overlaps within each ring
  for (let ring = 1; ring <= 4; ring++) {
    const rn = nodes.filter(n => n.ring === ring)
    for (let iter = 0; iter < 12; iter++) {
      for (let i = 0; i < rn.length; i++) {
        for (let j = i + 1; j < rn.length; j++) {
          const a = rn[i], b = rn[j]
          const dx = b.x - a.x, dy = b.y - a.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const minD = a.r + b.r + 14
          if (dist < minD) {
            const push = (minD - dist) / 2
            const nx = dx / dist, ny = dy / dist
            a.x -= nx * push; a.y -= ny * push
            b.x += nx * push; b.y += ny * push
          }
        }
      }
    }
  }

  return nodes
}

export default function NetworkView({ persons, sel, setSel, onContextMenu, referrals = [], views = [], disputes = [], fam = null }) {
  const svgRef = useRef(null)
  const [focusId, setFocusId] = useState(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 })
  const [dragId, setDragId] = useState(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [manualPositions, setManualPositions] = useState({})
  const [breadcrumbs, setBreadcrumbs] = useState([])
  const dragStartPos = useRef(null)
  const panRef = useRef(false)
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 })

  const allClans = [...new Set(persons.map(p => titleCase(p.clan)).filter(Boolean))].sort()
  const CX = 500, CY = 400

  // Initialize focus to most-connected root
  useEffect(() => {
    if (focusId && persons.find(p => p.id === focusId)) return
    if (!persons.length) return
    let best = persons[0].id, bestCount = -1
    persons.filter(p => !p.parentId).forEach(p => {
      const c = countDesc(p.id, persons)
      if (c > bestCount) { bestCount = c; best = p.id }
    })
    setFocusId(best)
    setBreadcrumbs([best])
  }, [persons])

  // Sync external sel → navigate focus
  useEffect(() => {
    if (sel && sel !== focusId && persons.find(p => p.id === sel)) {
      setFocusId(sel)
      setManualPositions({})
      setBreadcrumbs(prev => {
        const idx = prev.indexOf(sel)
        if (idx >= 0) return prev.slice(0, idx + 1)
        return [...prev, sel].slice(-6)
      })
    }
  }, [sel])

  // Center view when focus changes
  useEffect(() => {
    if (!focusId || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    setTransform({ x: rect.width / 2 - CX, y: rect.height / 2 - CY, k: 1 })
  }, [focusId])

  // Non-passive wheel zoom
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = e => {
      e.preventDefault()
      const factor = e.deltaY > 0 ? 0.92 : 1.08
      setTransform(t => ({ ...t, k: Math.max(0.3, Math.min(2.5, t.k * factor)) }))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const navigateTo = (id) => {
    setFocusId(id)
    setSel(id)
    setManualPositions({})
    setBreadcrumbs(prev => {
      const idx = prev.indexOf(id)
      if (idx >= 0) return prev.slice(0, idx + 1)
      return [...prev, id].slice(-6)
    })
  }

  const toSVG = (clientX, clientY) => {
    const rect = svgRef.current.getBoundingClientRect()
    return { x: (clientX - rect.left - transform.x) / transform.k, y: (clientY - rect.top - transform.y) / transform.k }
  }

  const assignments = focusId ? assignRings(focusId, persons) : new Map()
  const layoutNodes = focusId ? positionNodes(focusId, assignments, persons, CX, CY) : []
  const finalNodes = layoutNodes.map(n => manualPositions[n.id] ? { ...n, ...manualPositions[n.id] } : n)
  const nodeMap = {}
  finalNodes.forEach(n => { nodeMap[n.id] = n })

  const nodeIds = new Set(finalNodes.map(n => n.id))
  const edges = []
  persons.forEach(p => {
    if (!nodeIds.has(p.id)) return
    if (p.parentId && nodeIds.has(p.parentId)) edges.push({ source: p.parentId, target: p.id, type: 'parent' })
    if (p.spouseId && nodeIds.has(p.spouseId) && p.id < p.spouseId) edges.push({ source: p.id, target: p.spouseId, type: 'spouse' })
  })
  referrals.forEach(r => {
    if (nodeIds.has(r.source_person_id) && nodeIds.has(r.target_person_id)) {
      edges.push({ source: r.source_person_id, target: r.target_person_id, type: 'referral' })
    }
  })

  const handleBgDown = (e) => {
    if (e.button !== 0) return
    panRef.current = true
    panStart.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y }
  }

  const handleMouseMove = (e) => {
    if (dragId) {
      const { x, y } = toSVG(e.clientX, e.clientY)
      setManualPositions(prev => ({ ...prev, [dragId]: { x: x - dragOffset.x, y: y - dragOffset.y } }))
      return
    }
    if (!panRef.current) return
    setTransform(t => ({
      ...t,
      x: panStart.current.tx + (e.clientX - panStart.current.x),
      y: panStart.current.ty + (e.clientY - panStart.current.y),
    }))
  }

  const handleMouseUp = () => {
    setDragId(null)
    panRef.current = false
  }

  return (
    <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
      <svg
        ref={svgRef}
        style={{ width: '100%', height: '100%', display: 'block', cursor: dragId ? 'grabbing' : 'grab', background: '#1a1a1f' }}
        onMouseDown={handleBgDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <pattern id="ringdot" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="0.4" fill="#252528" />
          </pattern>
          <marker id="ref-nv" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#4A6FA5" opacity="0.6" />
          </marker>
        </defs>
        <rect width="100%" height="100%" fill="url(#ringdot)" />

        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          {/* Concentric ring boundaries */}
          {RING_RADII.slice(1).map((r, i) => (
            <g key={`rb-${i}`} pointerEvents="none">
              <circle cx={CX} cy={CY} r={r}
                fill={RING_FILLS[i + 1]} stroke="#2c2c34" strokeWidth={0.8} strokeDasharray="6,5" />
              <text x={CX + r - 6} y={CY - r + 14}
                textAnchor="end" fontSize={9} fill="#3a3a44" fontWeight={500}
                style={{ userSelect: 'none' }}>
                {RING_LABELS[i + 1]}
              </text>
            </g>
          ))}

          {/* Edges */}
          {edges.map((e, i) => {
            const a = nodeMap[e.source], b = nodeMap[e.target]
            if (!a || !b) return null

            if (e.type === 'spouse') {
              const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
              return (
                <g key={i} pointerEvents="none">
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#E8A87C" strokeWidth={2} opacity={0.6} />
                  <text x={mx} y={my - 4} textAnchor="middle" fontSize={9} fill="#E8A87C" opacity={0.8}
                    style={{ userSelect: 'none' }}>♥</text>
                </g>
              )
            }

            if (e.type === 'referral') {
              const dx = b.x - a.x, dy = b.y - a.y
              const d = Math.sqrt(dx * dx + dy * dy) || 1
              return (
                <line key={i} pointerEvents="none"
                  x1={a.x} y1={a.y}
                  x2={b.x - (dx / d) * (b.r + 6)} y2={b.y - (dy / d) * (b.r + 6)}
                  stroke="#4A6FA5" strokeWidth={1} opacity={0.35}
                  strokeDasharray="3,3" markerEnd="url(#ref-nv)" />
              )
            }

            const srcR = assignments.get(e.source)?.ring ?? 4
            const tgtR = assignments.get(e.target)?.ring ?? 4
            let edgeOpacity = Math.max(0.10, 0.45 - Math.max(srcR, tgtR) * 0.08)
            let edgeWidth = 1
            if (e.source === focusId || e.target === focusId) {
              const otherId = e.source === focusId ? e.target : e.source
              const rel = classifyRelationship(focusId, otherId, persons, fam?.language || 'english')
              if (rel) {
                edgeWidth = Math.max(1, getWeightValue(rel) * 0.6)
                edgeOpacity = Math.min(0.8, 0.2 + getWeightValue(rel) * 0.12)
              }
            }
            return (
              <line key={i} pointerEvents="none"
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="#555" strokeWidth={edgeWidth} opacity={edgeOpacity} />
            )
          })}

          {/* Relationship labels on parent-child edges from focus */}
          {edges
            .filter(e => e.type === 'parent' && (e.source === focusId || e.target === focusId))
            .map((e, i) => {
              const otherId = e.source === focusId ? e.target : e.source
              const a = nodeMap[e.source], b = nodeMap[e.target]
              if (!a || !b) return null
              const rel = classifyRelationship(focusId, otherId, persons, fam?.language || 'english')
              if (!rel) return null
              const mx = (a.x + b.x) / 2
              const my = (a.y + b.y) / 2
              const shortLabel = rel.label.split('/')[0].split('(')[0].trim()
              return (
                <text key={`rl-${i}`} x={mx} y={my - 6}
                  textAnchor="middle" fontSize={8} fill="#888"
                  fontStyle="italic" pointerEvents="none"
                  style={{ userSelect: 'none' }}>
                  {shortLabel.length > 12 ? shortLabel.slice(0, 10) + '…' : shortLabel}
                </text>
              )
            })}

          {/* Nodes */}
          {finalNodes.map(node => {
            const person = persons.find(p => p.id === node.id)
            if (!person) return null
            const dead = person.status === 'deceased'
            const isFocus = node.id === focusId
            const isSelected = node.id === sel && !isFocus
            const cc = getClanColor(titleCase(person.clan), allClans)
            const opacity = node.ring <= 2 ? 1 : node.ring === 3 ? 0.7 : 0.45

            return (
              <g key={node.id} style={{ cursor: 'grab' }}
                onMouseDown={e => {
                  if (e.button !== 0) return
                  e.stopPropagation()
                  dragStartPos.current = { x: e.clientX, y: e.clientY }
                  const { x, y } = toSVG(e.clientX, e.clientY)
                  setDragId(node.id)
                  setDragOffset({ x: x - node.x, y: y - node.y })
                }}
                onClick={e => {
                  e.stopPropagation()
                  if (dragStartPos.current) {
                    const dx = Math.abs(e.clientX - dragStartPos.current.x)
                    const dy = Math.abs(e.clientY - dragStartPos.current.y)
                    if (dx < 5 && dy < 5) navigateTo(node.id)
                  }
                  dragStartPos.current = null
                }}
                onContextMenu={e => {
                  e.preventDefault(); e.stopPropagation()
                  if (onContextMenu) onContextMenu(node.id, e)
                }}
              >
                {/* Transparent hitbox — captures events for deceased nodes (fill=transparent) */}
                <circle cx={node.x} cy={node.y} r={node.r + 5} fill="transparent" stroke="none" />

                {isFocus && (
                  <circle cx={node.x} cy={node.y} r={node.r + 8}
                    fill="none" stroke="#E8DCC8" strokeWidth={1.5} opacity={0.3}
                    pointerEvents="none">
                    <animate attributeName="r"
                      values={`${node.r + 6};${node.r + 13};${node.r + 6}`}
                      dur="3s" repeatCount="indefinite" />
                  </circle>
                )}
                {isSelected && (
                  <circle cx={node.x} cy={node.y} r={node.r + 5}
                    fill="none" stroke="#4A6FA5" strokeWidth={2} opacity={0.6} pointerEvents="none" />
                )}
                {node.ring <= 2 && person.photoUrl ? (
                  <g pointerEvents="none" opacity={opacity}>
                    <defs>
                      <clipPath id={`photoclip-${node.id}`}>
                        <circle cx={node.x} cy={node.y} r={node.r} />
                      </clipPath>
                    </defs>
                    <image href={person.photoUrl}
                      x={node.x - node.r} y={node.y - node.r}
                      width={node.r * 2} height={node.r * 2}
                      clipPath={`url(#photoclip-${node.id})`}
                      preserveAspectRatio="xMidYMid slice"
                      style={{ filter: dead ? 'grayscale(0.5)' : 'none' }} />
                    <circle cx={node.x} cy={node.y} r={node.r}
                      fill="none" stroke={cc} strokeWidth={dead ? 1.5 : 2}
                      strokeDasharray={dead ? '4,2' : undefined} />
                  </g>
                ) : (
                  <>
                    <circle cx={node.x} cy={node.y} r={node.r}
                      fill={dead ? 'transparent' : cc}
                      stroke={dead ? cc : 'none'}
                      strokeWidth={dead ? 1.5 : 0}
                      strokeDasharray={dead ? '4,2' : undefined}
                      opacity={opacity} pointerEvents="none" />
                    {dead && (
                      <g pointerEvents="none" opacity={opacity * 0.6}>
                        <line x1={node.x - node.r * 0.35} y1={node.y - node.r * 0.35}
                          x2={node.x + node.r * 0.35} y2={node.y + node.r * 0.35}
                          stroke={cc} strokeWidth={1.5} />
                        <line x1={node.x + node.r * 0.35} y1={node.y - node.r * 0.35}
                          x2={node.x - node.r * 0.35} y2={node.y + node.r * 0.35}
                          stroke={cc} strokeWidth={1.5} />
                      </g>
                    )}
                    {!dead && person.gender === 'F' && (
                      <circle cx={node.x} cy={node.y} r={node.r * 0.4}
                        fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={1} pointerEvents="none" />
                    )}
                  </>
                )}
                {!person.verified && (
                  <circle cx={node.x + node.r - 2} cy={node.y - node.r + 2}
                    r={3.5} fill="#FFC107" pointerEvents="none" />
                )}
                {node.ring <= 2 && (() => {
                  const pViews = views.filter(v => v.person_id === node.id)
                  const uniqueViewers = [...new Set(pViews.map(v => v.viewed_by))].length
                  const hasDispute = disputes.some(d => d.person_id === node.id && d.status === 'open')
                  const arcR = node.r + 3
                  if (hasDispute) return (
                    <circle cx={node.x} cy={node.y} r={arcR}
                      fill="none" stroke="#dc3545" strokeWidth={2.5}
                      opacity={0.75} pointerEvents="none">
                      <animate attributeName="opacity" values="0.75;0.2;0.75" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                  )
                  if (uniqueViewers >= 3) return (
                    <circle cx={node.x} cy={node.y} r={arcR}
                      fill="none" stroke="#5B7553" strokeWidth={Math.min(uniqueViewers * 0.6, 3)}
                      opacity={0.55} pointerEvents="none" />
                  )
                  if (uniqueViewers >= 1) return (
                    <circle cx={node.x} cy={node.y} r={arcR}
                      fill="none" stroke="#C4A35A" strokeWidth={1.5}
                      opacity={0.35} pointerEvents="none" />
                  )
                  return null
                })()}
                <text x={node.x} y={node.y + node.r + 14}
                  textAnchor="middle" fontSize={isFocus ? 12 : 10}
                  fontWeight={isFocus ? 700 : 500}
                  fill={node.ring <= 2 ? '#ddd' : '#666'}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>
                  {person.name.length > 16 ? person.name.slice(0, 14) + '…' : person.name}
                </text>
                {person.clan && (
                  <text x={node.x} y={node.y + node.r + 25}
                    textAnchor="middle" fontSize={8} fill={cc} opacity={opacity * 0.75}
                    style={{ userSelect: 'none', pointerEvents: 'none' }}>
                    {person.clan}
                  </text>
                )}
                {node.ring <= 1 && person.location && (
                  <text x={node.x} y={node.y + node.r + 36}
                    textAnchor="middle" fontSize={7} fill="#555"
                    style={{ userSelect: 'none', pointerEvents: 'none' }}>
                    {person.location}
                  </text>
                )}
                {person.birthYear && node.ring <= 2 && (
                  <text x={node.x}
                    y={node.y + node.r + (node.ring <= 1 && person.location ? 47 : 37)}
                    textAnchor="middle" fontSize={7} fill="#666"
                    style={{ userSelect: 'none', pointerEvents: 'none' }}>
                    {person.status === 'deceased' && person.deathYear
                      ? `${person.birthYear}–${person.deathYear}`
                      : `b. ${person.birthYear} · ${new Date().getFullYear() - person.birthYear}y`}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      {/* Breadcrumb trail */}
      {breadcrumbs.length > 0 && (
        <div style={{
          position: 'absolute', top: 10, left: 10,
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'rgba(20,20,26,0.90)', borderRadius: 8,
          padding: '5px 10px', fontSize: 11,
        }}>
          {breadcrumbs.map((id, i) => {
            const p = persons.find(x => x.id === id)
            if (!p) return null
            return (
              <span key={id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {i > 0 && <span style={{ color: '#3a3a44' }}>›</span>}
                <span onClick={() => navigateTo(id)} style={{
                  cursor: 'pointer',
                  color: id === focusId ? '#E8DCC8' : '#666',
                  fontWeight: id === focusId ? 600 : 400,
                  maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {p.name}
                </span>
              </span>
            )
          })}
        </div>
      )}

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 10, left: 10,
        background: 'rgba(12,12,18,0.92)', borderRadius: 8,
        padding: '8px 12px', fontSize: 10, color: '#777',
        pointerEvents: 'none', lineHeight: 2,
      }}>
        <div style={{ display: 'flex', gap: 14, marginBottom: 1 }}>
          <span style={{ color: '#C4A35A' }}>● Living</span>
          <span style={{ color: '#444' }}>○ Deceased</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 12px' }}>
          <span style={{ color: '#555' }}>── Parent-Child</span>
          <span style={{ color: '#E8A87C' }}>── ♥ Spouse</span>
          <span style={{ color: '#4A6FA5' }}>··· Knows about</span>
        </div>
        <div style={{ marginTop: 2, color: '#3a3a44', fontSize: 9 }}>Click to re-center · Right-click for details · Drag to reposition</div>
      </div>
    </div>
  )
}
