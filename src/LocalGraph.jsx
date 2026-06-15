import { useState, useEffect, useMemo, useRef } from 'react'

const CLAN_COLORS = ['#C4A35A', '#6B8E6B', '#5C7FB5', '#9B6BA0', '#C97B5D', '#7BAAAA', '#A0522D', '#708090']

function getClanColor(clan, allClans) {
  if (!clan) return '#888'
  const idx = allClans.indexOf(clan)
  return idx >= 0 ? CLAN_COLORS[idx % CLAN_COLORS.length] : '#888'
}

function countDesc(personId, persons) {
  const person = persons.find(p => p.id === personId)
  if (!person) return 0
  const spouse = person.spouseId ? persons.find(p => p.id === person.spouseId) : null
  const children = persons.filter(p => p.parentId === personId || (spouse && p.parentId === spouse.id))
  return children.length + children.reduce((s, c) => s + countDesc(c.id, persons), 0)
}

function defaultFocus(persons) {
  if (!persons.length) return null
  const noParent = persons.filter(p => !p.parentId || !persons.find(x => x.id === p.parentId))
  if (!noParent.length) return persons[0].id
  let best = noParent[0].id, bestCount = -1
  noParent.forEach(p => {
    const c = countDesc(p.id, persons)
    if (c > bestCount) { bestCount = c; best = p.id }
  })
  return best
}

function getNeighborhood(focusId, persons, maxHops = 2) {
  const included = new Map()
  included.set(focusId, 0)
  const queue = [{ id: focusId, hops: 0 }]

  while (queue.length > 0) {
    const { id, hops } = queue.shift()
    if (hops >= maxHops) continue
    const person = persons.find(p => p.id === id)
    if (!person) continue

    const connections = []
    if (person.spouseId) connections.push(person.spouseId)
    if (person.parentId) connections.push(person.parentId)

    persons.forEach(p => {
      if (p.parentId === id) connections.push(p.id)
      if (person.spouseId && p.parentId === person.spouseId) connections.push(p.id)
    })

    if (person.parentId) {
      const parent = persons.find(p => p.id === person.parentId)
      const psId = parent?.spouseId || null
      persons.forEach(p => {
        if (p.parentId === person.parentId || (psId && p.parentId === psId)) connections.push(p.id)
      })
    }

    connections.forEach(connId => {
      if (!included.has(connId)) {
        included.set(connId, hops + 1)
        queue.push({ id: connId, hops: hops + 1 })
      }
    })
  }

  return included
}

function radialLayout(focusId, neighborhood, persons) {
  const nodes = []
  const focus = persons.find(p => p.id === focusId)
  if (!focus) return nodes

  nodes.push({ id: focusId, x: 0, y: 0, hop: 0, r: 28 })

  const hop1 = [], hop2 = []
  neighborhood.forEach((hopDist, personId) => {
    if (personId === focusId) return
    if (hopDist === 1) hop1.push(personId)
    else hop2.push(personId)
  })

  const RING1 = 160, RING2 = 310

  const parents = hop1.filter(id =>
    focus.parentId === id ||
    (focus.parentId && persons.find(x => x.id === focus.parentId)?.spouseId === id)
  )
  const spouse = hop1.filter(id => id === focus.spouseId)
  const children = hop1.filter(id => {
    const p = persons.find(x => x.id === id)
    return p?.parentId === focusId || p?.parentId === focus.spouseId
  })
  const siblings = hop1.filter(id =>
    !parents.includes(id) && !spouse.includes(id) && !children.includes(id)
  )

  parents.forEach((id, i) => {
    const spread = parents.length > 1 ? (i - (parents.length - 1) / 2) * 90 : 0
    nodes.push({ id, x: spread, y: -RING1, hop: 1, r: 22 })
  })
  spouse.forEach(id => {
    nodes.push({ id, x: RING1 * 0.85, y: 0, hop: 1, r: 24 })
  })
  children.forEach((id, i) => {
    const spread = (i - (children.length - 1) / 2) * 85
    nodes.push({ id, x: spread, y: RING1, hop: 1, r: 20 })
  })
  siblings.forEach((id, i) => {
    const spread = (i - (siblings.length - 1) / 2) * 75
    nodes.push({ id, x: -RING1 * 0.75, y: spread, hop: 1, r: 18 })
  })

  const anchorCounts = {}
  hop2.forEach((id, idx) => {
    const person = persons.find(p => p.id === id)
    if (!person) return

    let anchorNode = null
    if (person.parentId && neighborhood.get(person.parentId) === 1)
      anchorNode = nodes.find(n => n.id === person.parentId)
    else if (person.spouseId && neighborhood.get(person.spouseId) === 1)
      anchorNode = nodes.find(n => n.id === person.spouseId)
    else
      anchorNode = nodes.find(n => n.hop === 1 && (
        person.parentId === n.id || person.spouseId === n.id ||
        persons.find(p => p.id === n.id)?.parentId === person.id
      ))

    if (anchorNode) {
      const dx = anchorNode.x, dy = anchorNode.y
      const d = Math.sqrt(dx * dx + dy * dy) || 1
      const count = anchorCounts[anchorNode.id] || 0
      anchorCounts[anchorNode.id] = count + 1
      const angle = (count - 0.5) * 0.55
      const cos = Math.cos(angle), sin = Math.sin(angle)
      const rdx = dx * cos - dy * sin
      const rdy = dx * sin + dy * cos
      nodes.push({ id, x: rdx / d * RING2, y: rdy / d * RING2, hop: 2, r: 14 })
    } else {
      const angle = (idx / Math.max(hop2.length, 1)) * Math.PI * 2
      nodes.push({ id, x: Math.cos(angle) * RING2, y: Math.sin(angle) * RING2, hop: 2, r: 14 })
    }
  })

  return nodes
}

function buildLocalEdges(neighborhood, persons) {
  const nodeIds = new Set(neighborhood.keys())
  const edges = []

  persons.forEach(p => {
    if (!nodeIds.has(p.id)) return
    if (p.parentId && nodeIds.has(p.parentId)) {
      edges.push({ source: p.parentId, target: p.id, type: 'parent' })
    }
    if (p.spouseId && nodeIds.has(p.spouseId) && p.id < p.spouseId) {
      edges.push({ source: p.id, target: p.spouseId, type: 'spouse' })
    }
  })

  return edges
}

export function LocalGraph({ persons, sel, setSel, clans, REL, onContextMenu }) {
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [maxHops, setMaxHops] = useState(2)
  const [focusId, setFocusId] = useState(null)
  const [displayNodes, setDisplayNodes] = useState([])
  const [manualPositions, setManualPositions] = useState({})

  const svgRef = useRef(null)
  const isPanning = useRef(false)
  const lastMouse = useRef(null)
  const animFrameRef = useRef(null)
  const displayNodesRef = useRef([])
  const finalNodesRef = useRef([])
  const dragIdRef = useRef(null)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const dragStartPosRef = useRef(null)

  displayNodesRef.current = displayNodes

  const defaultFocusId = useMemo(() => defaultFocus(persons), [persons])

  const effectiveFocus = useMemo(() => {
    if (focusId && persons.find(p => p.id === focusId)) return focusId
    if (sel && persons.find(p => p.id === sel)) return sel
    return defaultFocusId
  }, [focusId, sel, defaultFocusId, persons])

  const neighborhood = useMemo(() => {
    if (!effectiveFocus || !persons.length) return new Map()
    return getNeighborhood(effectiveFocus, persons, maxHops)
  }, [effectiveFocus, persons, maxHops])

  const edges = useMemo(() => buildLocalEdges(neighborhood, persons), [neighborhood, persons])

  // Sync external sel → shift focus
  useEffect(() => {
    if (sel && sel !== effectiveFocus) setFocusId(sel)
  }, [sel]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clear manual drag positions when layout changes
  useEffect(() => {
    setManualPositions({})
  }, [effectiveFocus, maxHops])

  // Animate to new layout whenever focus/persons/hops change
  useEffect(() => {
    if (!effectiveFocus || !persons.length) return
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)

    const newLayout = radialLayout(effectiveFocus, getNeighborhood(effectiveFocus, persons, maxHops), persons)

    const prevPositions = {}
    displayNodesRef.current.forEach(n => { prevPositions[n.id] = { x: n.x, y: n.y } })

    const startTime = performance.now()
    const duration = 280

    function tick(now) {
      const t = Math.min(1, (now - startTime) / duration)
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t

      const interpolated = newLayout.map(n => {
        const prev = prevPositions[n.id]
        return {
          ...n,
          x: prev ? prev.x + (n.x - prev.x) * eased : n.x,
          y: prev ? prev.y + (n.y - prev.y) * eased : n.y,
        }
      })

      setDisplayNodes(interpolated)
      if (t < 1) animFrameRef.current = requestAnimationFrame(tick)
      else animFrameRef.current = null
    }

    animFrameRef.current = requestAnimationFrame(tick)
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current) }
  }, [effectiveFocus, persons, maxHops])

  // Fit view after animation settles
  const fitView = () => {
    const el = svgRef.current; if (!el) return
    const ns = finalNodesRef.current; if (!ns.length) return
    const rect = el.getBoundingClientRect()
    const pad = 50
    const minX = Math.min(...ns.map(n => n.x - n.r)) - pad
    const maxX = Math.max(...ns.map(n => n.x + n.r)) + pad
    const minY = Math.min(...ns.map(n => n.y - n.r)) - pad
    const maxY = Math.max(...ns.map(n => n.y + n.r)) + pad
    const tw = maxX - minX, th = maxY - minY; if (!tw || !th) return
    const nz = Math.min(2, Math.max(0.2, Math.min(rect.width / tw, rect.height / th)))
    setZoom(nz)
    setPan({ x: rect.width / 2 - (minX + tw / 2) * nz, y: rect.height / 2 - (minY + th / 2) * nz })
  }

  useEffect(() => {
    if (displayNodes.length > 0) setTimeout(fitView, 320)
  }, [effectiveFocus, maxHops]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = svgRef.current; if (!el) return
    const onWheel = e => { e.preventDefault(); setZoom(z => Math.min(3, Math.max(0.15, z * (e.deltaY < 0 ? 1.1 : 0.9)))) }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Apply manual drag overrides to display nodes
  const finalDisplayNodes = displayNodes.map(n =>
    manualPositions[n.id] ? { ...n, ...manualPositions[n.id] } : n
  )
  finalNodesRef.current = finalDisplayNodes

  const nodeMap = {}
  finalDisplayNodes.forEach(n => { nodeMap[n.id] = n })

  const focusPerson = persons.find(p => p.id === effectiveFocus)
  const hasManual = Object.keys(manualPositions).length > 0

  const toSVGCoords = (clientX, clientY) => {
    const rect = svgRef.current.getBoundingClientRect()
    return { x: (clientX - rect.left - pan.x) / zoom, y: (clientY - rect.top - pan.y) / zoom }
  }

  const getEdgeLabel = (edge) => {
    if (!REL || !effectiveFocus) return null
    if (edge.source !== effectiveFocus && edge.target !== effectiveFocus) return null
    const otherId = edge.source === effectiveFocus ? edge.target : edge.source
    const other = persons.find(p => p.id === otherId)
    if (!other) return null
    if (edge.type === 'spouse') return other.gender === 'F' ? REL.wife : REL.husband
    if (edge.type === 'parent') {
      if (edge.target === effectiveFocus) return other.gender === 'M' ? REL.father : REL.mother
      return other.gender === 'M' ? REL.son : REL.daughter
    }
    return null
  }

  const handleSVGMouseDown = (e) => {
    if (e.button !== 0) return
    isPanning.current = true
    lastMouse.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.style.cursor = 'grabbing'
  }

  const handleSVGMouseMove = (e) => {
    if (dragIdRef.current) {
      const { x: svgX, y: svgY } = toSVGCoords(e.clientX, e.clientY)
      const newX = svgX - dragOffsetRef.current.x
      const newY = svgY - dragOffsetRef.current.y
      setManualPositions(prev => ({ ...prev, [dragIdRef.current]: { x: newX, y: newY } }))
      return
    }
    if (!isPanning.current || !lastMouse.current) return
    const dx = e.clientX - lastMouse.current.x, dy = e.clientY - lastMouse.current.y
    lastMouse.current = { x: e.clientX, y: e.clientY }
    setPan(p => ({ x: p.x + dx, y: p.y + dy }))
  }

  const handleSVGMouseUp = (e) => {
    dragIdRef.current = null
    isPanning.current = false
    e.currentTarget.style.cursor = 'grab'
  }

  return (
    <div style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden' }}>
      <svg
        ref={svgRef}
        style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab' }}
        onMouseDown={handleSVGMouseDown}
        onMouseMove={handleSVGMouseMove}
        onMouseUp={handleSVGMouseUp}
        onMouseLeave={handleSVGMouseUp}
      >
        <defs>
          <pattern id="lgrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="0.6" fill="#2a2a30" />
          </pattern>
          <filter id="lglow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="#1a1a1f" />
        <rect width="100%" height="100%" fill="url(#lgrid)" />

        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {/* Edges */}
          {edges.map((edge, i) => {
            const a = nodeMap[edge.source], b = nodeMap[edge.target]
            if (!a || !b) return null
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
            const isFromFocus = edge.source === effectiveFocus || edge.target === effectiveFocus
            const hopA = neighborhood.get(edge.source) ?? 0
            const hopB = neighborhood.get(edge.target) ?? 0
            const isDeepEdge = hopA === 2 || hopB === 2
            const label = isFromFocus ? getEdgeLabel(edge) : null

            if (edge.type === 'spouse') {
              return (
                <g key={i} opacity={isDeepEdge ? 0.25 : 1}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#E8A87C" strokeWidth={isFromFocus ? 2.5 : 1.5} />
                  <text x={mx} y={my - 5} textAnchor="middle" fontSize={10} fill="#E8A87C"
                    style={{ userSelect: 'none', pointerEvents: 'none' }}>♥</text>
                  {label && (
                    <text x={mx} y={my + 14} textAnchor="middle" fontSize={8} fill="#E8A87C" opacity={0.75}
                      style={{ userSelect: 'none', pointerEvents: 'none' }}>{label}</text>
                  )}
                </g>
              )
            }

            return (
              <g key={i} opacity={isDeepEdge ? 0.25 : 0.7}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={isFromFocus ? '#666' : '#3a3a50'}
                  strokeWidth={isFromFocus ? 1.5 : 1} />
                {label && (
                  <text x={mx} y={my - 5} textAnchor="middle" fontSize={8} fill="#666"
                    style={{ userSelect: 'none', pointerEvents: 'none' }}>{label}</text>
                )}
              </g>
            )
          })}

          {/* Nodes */}
          {finalDisplayNodes.map(node => {
            const p = persons.find(x => x.id === node.id); if (!p) return null
            const isFocus = node.id === effectiveFocus
            const isSelected = sel === node.id && !isFocus
            const isDead = p.status === 'deceased'
            const isFemale = p.gender === 'F'
            const clanColor = getClanColor(p.clan, clans)
            const nameLabel = p.name.length > 18 ? p.name.slice(0, 16) + '…' : p.name
            const isDeep = node.hop === 2

            return (
              <g key={node.id}
                style={{ cursor: 'grab', opacity: isDeep ? 0.55 : 1 }}
                onMouseDown={e => {
                  if (e.button !== 0) return
                  e.stopPropagation()
                  dragStartPosRef.current = { x: e.clientX, y: e.clientY }
                  const { x: svgX, y: svgY } = toSVGCoords(e.clientX, e.clientY)
                  dragIdRef.current = node.id
                  dragOffsetRef.current = { x: svgX - node.x, y: svgY - node.y }
                  if (svgRef.current) svgRef.current.style.cursor = 'grabbing'
                }}
                onClick={e => {
                  e.stopPropagation()
                  if (dragStartPosRef.current) {
                    const dx = e.clientX - dragStartPosRef.current.x
                    const dy = e.clientY - dragStartPosRef.current.y
                    if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
                      setFocusId(node.id)
                      setSel(node.id)
                    }
                  }
                  dragStartPosRef.current = null
                }}
                onContextMenu={e => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (onContextMenu) onContextMenu(node.id, e)
                }}
              >
                {isFocus && (
                  <circle cx={node.x} cy={node.y} r={node.r + 12}
                    fill="none" stroke={clanColor} strokeWidth={1.5} opacity={0.3}
                    filter="url(#lglow)" />
                )}
                {isFocus && (
                  <circle cx={node.x} cy={node.y} r={node.r + 6}
                    fill="none" stroke={clanColor} strokeWidth={1} opacity={0.6} />
                )}
                {isSelected && (
                  <circle cx={node.x} cy={node.y} r={node.r + 5}
                    fill="none" stroke="#4A6FA5" strokeWidth={1.5} opacity={0.8} />
                )}
                {isFemale && !isDead && (
                  <circle cx={node.x} cy={node.y} r={Math.max(4, node.r - 5)}
                    fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
                )}
                <circle cx={node.x} cy={node.y} r={node.r}
                  fill={isDead ? 'none' : clanColor}
                  stroke={clanColor}
                  strokeWidth={isDead ? 1.5 : 0}
                  strokeDasharray={isDead ? '4,2' : undefined}
                  opacity={0.9}
                />
                {isDead && (
                  <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize={node.r}
                    fill={clanColor} style={{ userSelect: 'none', pointerEvents: 'none' }}>×</text>
                )}
                <text x={node.x} y={node.y + node.r + 13} textAnchor="middle"
                  fontSize={isFocus ? 11 : (node.hop === 1 ? 9 : 8)}
                  fontWeight={isFocus ? 700 : 400}
                  fill={isDeep ? '#888' : '#ddd'}
                  fontFamily="DM Sans,sans-serif"
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>
                  {nameLabel}
                </text>
                {p.clan && (
                  <text x={node.x} y={node.y + node.r + 23} textAnchor="middle" fontSize={7}
                    fill={clanColor} opacity={0.6}
                    fontFamily="DM Sans,sans-serif"
                    style={{ userSelect: 'none', pointerEvents: 'none' }}>{p.clan}</text>
                )}
                {p.location && !isDeep && (
                  <text x={node.x} y={node.y + node.r + 33} textAnchor="middle" fontSize={7}
                    fill="#555" fontFamily="DM Sans,sans-serif"
                    style={{ userSelect: 'none', pointerEvents: 'none' }}>
                    {p.location.length > 20 ? p.location.slice(0, 18) + '…' : p.location}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      {/* Top-right controls */}
      <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4, zIndex: 10 }}>
        {hasManual && (
          <button onClick={() => setManualPositions({})} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, background: '#7B3F3F', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Reset</button>
        )}
        <button onClick={fitView} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, background: '#333', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Fit</button>
        <button onClick={() => setZoom(z => Math.min(3, z * 1.2))} style={{ padding: '4px 8px', fontSize: 14, fontWeight: 700, background: '#333', color: '#aaa', border: 'none', borderRadius: 6, cursor: 'pointer' }}>+</button>
        <button onClick={() => setZoom(z => Math.max(0.15, z / 1.2))} style={{ padding: '4px 8px', fontSize: 14, fontWeight: 700, background: '#333', color: '#aaa', border: 'none', borderRadius: 6, cursor: 'pointer' }}>−</button>
      </div>

      {/* Top-left: hop depth control */}
      <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', alignItems: 'center', gap: 5, zIndex: 10, background: 'rgba(15,15,22,0.88)', borderRadius: 8, padding: '5px 10px' }}>
        <span style={{ fontSize: 9, color: '#555', fontWeight: 600, letterSpacing: 1 }}>HOPS</span>
        <button onClick={() => setMaxHops(h => Math.max(1, h - 1))} style={{ padding: '2px 8px', fontSize: 13, fontWeight: 700, background: '#2a2a30', color: '#aaa', border: 'none', borderRadius: 5, cursor: 'pointer', lineHeight: 1 }}>−</button>
        <span style={{ fontSize: 13, color: '#ccc', minWidth: 12, textAlign: 'center', fontWeight: 700 }}>{maxHops}</span>
        <button onClick={() => setMaxHops(h => Math.min(4, h + 1))} style={{ padding: '2px 8px', fontSize: 13, fontWeight: 700, background: '#2a2a30', color: '#aaa', border: 'none', borderRadius: 5, cursor: 'pointer', lineHeight: 1 }}>+</button>
      </div>

      {/* Bottom-left: focus label */}
      {focusPerson && (
        <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(15,15,22,0.88)', borderRadius: 8, padding: '6px 12px', zIndex: 10, pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: getClanColor(focusPerson.clan, clans), flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: '#888' }}>Focus</span>
          <span style={{ fontSize: 11, color: '#ddd', fontWeight: 600 }}>{focusPerson.name}</span>
          <span style={{ fontSize: 9, color: '#444' }}>{finalDisplayNodes.length} nodes</span>
        </div>
      )}
    </div>
  )
}
