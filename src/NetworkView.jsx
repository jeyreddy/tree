import { useState, useEffect, useMemo, useRef, useCallback } from 'react'

const CLAN_COLORS = ['#C4A35A', '#6B8E6B', '#5C7FB5', '#9B6BA0', '#C97B5D', '#7BAAAA', '#A0522D', '#708090']

function getClanColor(clan, allClans) {
  if (!clan) return '#888'
  const idx = allClans.indexOf(clan)
  return idx >= 0 ? CLAN_COLORS[idx % CLAN_COLORS.length] : '#888'
}

function countDescendants(personId, persons) {
  const person = persons.find(p => p.id === personId)
  if (!person) return 0
  const spouse = person.spouseId ? persons.find(p => p.id === person.spouseId) : null
  const children = persons.filter(p =>
    p.parentId === personId || (spouse && p.parentId === spouse.id)
  )
  return children.length + children.reduce((sum, c) => sum + countDescendants(c.id, persons), 0)
}

function findPrimaryRootId(persons) {
  const noParent = persons.filter(p => !p.parentId || !persons.find(x => x.id === p.parentId))
  const rootIds = noParent.map(p => p.id)
  if (!rootIds.length) return null
  let bestRoot = rootIds[0], bestCount = -1
  rootIds.forEach(rootId => {
    const count = countDescendants(rootId, persons)
    if (count > bestCount) { bestCount = count; bestRoot = rootId }
  })
  return bestRoot
}

function buildEdges(persons, primaryRootId) {
  const edges = []
  const siblingGroups = {}

  persons.forEach(p => {
    if (p.parentId) {
      const sourceHasNoParent = !persons.find(x => x.id === p.parentId)?.parentId
      const isInLaw = sourceHasNoParent && p.parentId !== primaryRootId
      edges.push({ source: p.parentId, target: p.id, type: isInLaw ? 'inlaw-parent' : 'parent' })
    }
    if (p.spouseId && p.id < p.spouseId) {
      edges.push({ source: p.id, target: p.spouseId, type: 'spouse' })
    }
    if (p.parentId) {
      if (!siblingGroups[p.parentId]) siblingGroups[p.parentId] = []
      siblingGroups[p.parentId].push(p.id)
    }
  })

  Object.values(siblingGroups).forEach(group => {
    for (let i = 0; i < group.length - 1; i++) {
      edges.push({ source: group[i], target: group[i + 1], type: 'sibling' })
    }
  })

  return edges
}

function simulate(nodes, edges) {
  const nodeMap = {}
  nodes.forEach(n => { nodeMap[n.id] = n })

  for (let iter = 0; iter < 200; iter++) {
    const alpha = 1 - iter / 200

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x
        const dy = nodes[j].y - nodes[i].y
        const d2 = dx * dx + dy * dy || 1
        const force = 800 * alpha / d2
        nodes[i].x -= dx * force
        nodes[i].y -= dy * force
        nodes[j].x += dx * force
        nodes[j].y += dy * force
      }
    }

    edges.forEach(e => {
      const a = nodeMap[e.source]
      const b = nodeMap[e.target]
      if (!a || !b) return
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d = Math.sqrt(dx * dx + dy * dy) || 1

      let ideal = 120
      if (e.type === 'spouse') ideal = 60
      if (e.type === 'sibling') ideal = 80
      if (e.type === 'inlaw-parent') ideal = 90

      const force = (d - ideal) / d * 0.1 * alpha
      a.x += dx * force
      a.y += dy * force
      b.x -= dx * force
      b.y -= dy * force

      if (e.type === 'spouse') {
        const yDiff = (b.y - a.y) * 0.3 * alpha
        a.y += yDiff
        b.y -= yDiff
      }
    })

    nodes.forEach(n => {
      const targetY = n.generation * 150
      n.y += (targetY - n.y) * 0.05 * alpha
    })

    let cx = 0, cy = 0
    nodes.forEach(n => { cx += n.x; cy += n.y })
    cx /= nodes.length; cy /= nodes.length
    nodes.forEach(n => { n.x -= cx; n.y -= cy })
  }
}

export function NetworkView({ persons, sel, setSel, clans, onAddRoot }) {
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [nodePositions, setNodePositions] = useState({})
  const svgRef = useRef(null)
  const isPanning = useRef(false)
  const lastMouse = useRef(null)
  const dragNodeIdRef = useRef(null)
  const dragNodeBaseRef = useRef(null)
  const didDragNodeRef = useRef(false)

  const { nodes, edges } = useMemo(() => {
    if (!persons.length) return { nodes: [], edges: [] }
    const hasChildren = new Set(persons.filter(p => p.parentId).map(p => p.parentId))
    const primaryRootId = findPrimaryRootId(persons)
    const nodes = persons.map((p, i) => ({
      id: p.id,
      x: (i % 8) * 140 + Math.sin(i * 2.3) * 30,
      y: (p.generation || 0) * 150 + Math.cos(i * 1.7) * 20,
      generation: p.generation || 0,
      r: hasChildren.has(p.id) ? 20 : 14,
    }))
    const edges = buildEdges(persons, primaryRootId)
    simulate(nodes, edges)
    return { nodes, edges }
  }, [persons])

  // Clear manual overrides when simulation re-runs (persons changed)
  useEffect(() => { setNodePositions({}) }, [nodes])

  const finalNodes = nodes.map(n =>
    nodePositions[n.id] ? { ...n, ...nodePositions[n.id] } : n
  )

  const nodeMap = {}
  finalNodes.forEach(n => { nodeMap[n.id] = n })

  const nodesRef = useRef([])
  nodesRef.current = finalNodes

  useEffect(() => {
    const el = svgRef.current; if (!el) return
    const onWheel = e => { e.preventDefault(); setZoom(z => Math.min(3, Math.max(0.1, z * (e.deltaY < 0 ? 1.1 : 0.9)))) }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const fitNet = useCallback(() => {
    if (!svgRef.current || !nodesRef.current.length) return
    const rect = svgRef.current.getBoundingClientRect()
    const ns = nodesRef.current
    const minX = Math.min(...ns.map(n => n.x - n.r - 20))
    const maxX = Math.max(...ns.map(n => n.x + n.r + 20))
    const minY = Math.min(...ns.map(n => n.y - n.r - 30))
    const maxY = Math.max(...ns.map(n => n.y + n.r + 30))
    const tw = maxX - minX, th = maxY - minY; if (!tw || !th) return
    const nz = Math.min(3, Math.max(0.1, Math.min((rect.width - 40) / tw, (rect.height - 40) / th)))
    setZoom(nz)
    setPan({ x: (rect.width - tw * nz) / 2 - minX * nz, y: (rect.height - th * nz) / 2 - minY * nz })
  }, [])

  useEffect(() => {
    if (nodes.length > 0) setTimeout(fitNet, 60)
  }, [nodes, fitNet])

  useEffect(() => {
    if (!sel || !svgRef.current) return
    const node = nodesRef.current.find(n => n.id === sel); if (!node) return
    const rect = svgRef.current.getBoundingClientRect()
    setPan({ x: rect.width / 2 - node.x * zoom, y: rect.height / 2 - node.y * zoom })
  }, [sel]) // eslint-disable-line react-hooks/exhaustive-deps

  const toSVGCoords = (clientX, clientY) => {
    const rect = svgRef.current.getBoundingClientRect()
    return { x: (clientX - rect.left - pan.x) / zoom, y: (clientY - rect.top - pan.y) / zoom }
  }

  const handleSVGMouseDown = (e) => {
    if (e.button !== 0) return
    isPanning.current = true; lastMouse.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.style.cursor = 'grabbing'
  }

  const handleSVGMouseMove = (e) => {
    if (dragNodeIdRef.current && dragNodeBaseRef.current) {
      const { x, y } = toSVGCoords(e.clientX, e.clientY)
      const dx = x - dragNodeBaseRef.current.mouseX, dy = y - dragNodeBaseRef.current.mouseY
      if (Math.abs(dx) + Math.abs(dy) > 1) didDragNodeRef.current = true
      setNodePositions(prev => ({
        ...prev,
        [dragNodeIdRef.current]: {
          x: dragNodeBaseRef.current.nodeX + dx,
          y: dragNodeBaseRef.current.nodeY + dy,
        },
      }))
      return
    }
    if (!isPanning.current || !lastMouse.current) return
    const dx = e.clientX - lastMouse.current.x, dy = e.clientY - lastMouse.current.y
    lastMouse.current = { x: e.clientX, y: e.clientY }
    setPan(p => ({ x: p.x + dx, y: p.y + dy }))
  }

  const handleSVGMouseUp = (e) => {
    dragNodeIdRef.current = null; dragNodeBaseRef.current = null
    isPanning.current = false
    if (e.currentTarget) e.currentTarget.style.cursor = 'grab'
  }

  const hasOverrides = Object.keys(nodePositions).length > 0

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
          <pattern id="netgrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="0.6" fill="#2a2a30" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="#1a1a1f" />
        <rect width="100%" height="100%" fill="url(#netgrid)" />

        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {edges.map((edge, i) => {
            const a = nodeMap[edge.source]
            const b = nodeMap[edge.target]
            if (!a || !b) return null
            if (edge.type === 'spouse') {
              const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
              return (
                <g key={i}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#E8A87C" strokeWidth={2} opacity={0.7} />
                  <text x={mx} y={my - 4} textAnchor="middle" fontSize={11} fill="#E8A87C"
                    style={{ userSelect: 'none', pointerEvents: 'none' }}>♥</text>
                </g>
              )
            }
            if (edge.type === 'inlaw-parent') {
              return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#C97B5D" strokeWidth={1.5} strokeDasharray="6,3" opacity={0.65} />
            }
            if (edge.type === 'sibling') {
              return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#3a3a44" strokeWidth={1} strokeDasharray="3,3" />
            }
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#3a3a50" strokeWidth={1.5} />
          })}

          {finalNodes.map(node => {
            const p = persons.find(x => x.id === node.id); if (!p) return null
            const isSelected = sel === p.id
            const isDead = p.status === 'deceased'
            const isDragging = dragNodeIdRef.current === node.id
            const clanColor = getClanColor(p.clan, clans)
            const label = p.name.length > 16 ? p.name.slice(0, 14) + '…' : p.name
            return (
              <g key={node.id}
                style={{ cursor: isDragging ? 'grabbing' : 'pointer' }}
                onClick={e => { e.stopPropagation(); if (!didDragNodeRef.current) setSel(node.id) }}
                onMouseDown={e => {
                  e.stopPropagation()
                  didDragNodeRef.current = false
                  const { x, y } = toSVGCoords(e.clientX, e.clientY)
                  dragNodeIdRef.current = node.id
                  dragNodeBaseRef.current = { mouseX: x, mouseY: y, nodeX: node.x, nodeY: node.y }
                  if (svgRef.current) svgRef.current.style.cursor = 'grabbing'
                }}
              >
                {isSelected && (
                  <circle cx={node.x} cy={node.y} r={node.r + 7} fill="none" stroke="#4A6FA5" strokeWidth={2} opacity={0.8} />
                )}
                {isDragging && (
                  <circle cx={node.x} cy={node.y} r={node.r + 5} fill="rgba(74,111,165,0.15)" />
                )}
                <circle
                  cx={node.x} cy={node.y} r={node.r}
                  fill={isDead ? 'none' : clanColor}
                  stroke={clanColor}
                  strokeWidth={isDead ? 1.5 : 0}
                  strokeDasharray={isDead ? '4,2' : undefined}
                  opacity={0.9}
                />
                {isDead && (
                  <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize={node.r - 2} fill={clanColor}
                    style={{ userSelect: 'none', pointerEvents: 'none' }}>×</text>
                )}
                <text x={node.x} y={node.y + node.r + 13} textAnchor="middle" fontSize={10} fill="#bbb"
                  fontFamily="DM Sans,sans-serif" style={{ userSelect: 'none', pointerEvents: 'none' }}>{label}</text>
                {p.clan && (
                  <text x={node.x} y={node.y + node.r + 23} textAnchor="middle" fontSize={8} fill="#555"
                    fontFamily="DM Sans,sans-serif" style={{ userSelect: 'none', pointerEvents: 'none' }}>{p.clan}</text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4, zIndex: 10 }}>
        <button onClick={fitNet} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, background: '#333', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Fit</button>
        <button onClick={() => setZoom(z => Math.min(3, z * 1.2))} style={{ padding: '4px 8px', fontSize: 14, fontWeight: 700, background: '#333', color: '#aaa', border: 'none', borderRadius: 6, cursor: 'pointer' }}>+</button>
        <button onClick={() => setZoom(z => Math.max(0.1, z / 1.2))} style={{ padding: '4px 8px', fontSize: 14, fontWeight: 700, background: '#333', color: '#aaa', border: 'none', borderRadius: 6, cursor: 'pointer' }}>−</button>
        {hasOverrides && (
          <button onClick={() => setNodePositions({})} style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, background: '#2a2a1f', color: '#C4A35A', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Reset</button>
        )}
        {onAddRoot && (
          <button onClick={onAddRoot} style={{ padding: '4px 8px', fontSize: 11, background: 'transparent', color: '#555', border: '1.5px dashed #444', borderRadius: 6, cursor: 'pointer', marginLeft: 4 }}>+ Root</button>
        )}
      </div>

      <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(15,15,22,0.92)', borderRadius: 8, padding: '8px 12px', fontSize: 10, lineHeight: 1.9, zIndex: 10, pointerEvents: 'none' }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 2 }}>
          <span style={{ color: '#888' }}>● Living</span>
          <span style={{ color: '#555' }}>○ Deceased</span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <span style={{ color: '#3a3a50' }}>── Parent-Child</span>
          <span style={{ color: '#E8A87C' }}>── ♥ Spouse</span>
          <span style={{ color: '#3a3a44' }}>··· Siblings</span>
          <span style={{ color: '#C97B5D' }}>╌╌ In-law</span>
        </div>
      </div>
    </div>
  )
}
