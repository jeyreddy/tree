import { useState, useEffect, useMemo, useRef, useCallback } from 'react'

const CLAN_COLORS = ['#C4A35A', '#6B8E6B', '#5C7FB5', '#9B6BA0', '#C97B5D', '#7BAAAA', '#A0522D', '#708090']

function getClanColor(clan, allClans) {
  if (!clan) return '#888'
  const idx = allClans.indexOf(clan)
  return idx >= 0 ? CLAN_COLORS[idx % CLAN_COLORS.length] : '#888'
}

function buildEdges(persons) {
  const edges = []
  const siblingGroups = {}

  persons.forEach(p => {
    if (p.parentId) {
      edges.push({ source: p.parentId, target: p.id, type: 'parent' })
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

    // Repulsion between all nodes
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

    // Attraction along edges
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

    // Generation row gravity
    nodes.forEach(n => {
      const targetY = n.generation * 150
      n.y += (targetY - n.y) * 0.05 * alpha
    })

    // Center gravity
    let cx = 0, cy = 0
    nodes.forEach(n => { cx += n.x; cy += n.y })
    cx /= nodes.length; cy /= nodes.length
    nodes.forEach(n => { n.x -= cx; n.y -= cy })
  }
}

export function NetworkView({ persons, sel, setSel, clans, onAddRoot }) {
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const svgRef = useRef(null)
  const isPanning = useRef(false)
  const lastMouse = useRef(null)

  const { nodes, edges } = useMemo(() => {
    if (!persons.length) return { nodes: [], edges: [] }
    const hasChildren = new Set(persons.filter(p => p.parentId).map(p => p.parentId))
    const nodes = persons.map((p, i) => ({
      id: p.id,
      x: (i % 8) * 140 + Math.sin(i * 2.3) * 30,
      y: (p.generation || 0) * 150 + Math.cos(i * 1.7) * 20,
      generation: p.generation || 0,
      r: hasChildren.has(p.id) ? 20 : 14,
    }))
    const edges = buildEdges(persons)
    simulate(nodes, edges)
    return { nodes, edges }
  }, [persons])

  const nodesRef = useRef(nodes)
  nodesRef.current = nodes

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

  return (
    <div style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden' }}>
      <svg
        ref={svgRef}
        style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab' }}
        onMouseDown={e => {
          if (e.button !== 0) return
          isPanning.current = true; lastMouse.current = { x: e.clientX, y: e.clientY }
          e.currentTarget.style.cursor = 'grabbing'
        }}
        onMouseMove={e => {
          if (!isPanning.current || !lastMouse.current) return
          const dx = e.clientX - lastMouse.current.x, dy = e.clientY - lastMouse.current.y
          lastMouse.current = { x: e.clientX, y: e.clientY }
          setPan(p => ({ x: p.x + dx, y: p.y + dy }))
        }}
        onMouseUp={e => { isPanning.current = false; e.currentTarget.style.cursor = 'grab' }}
        onMouseLeave={e => { isPanning.current = false; e.currentTarget.style.cursor = 'grab' }}
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
            const a = nodes.find(n => n.id === edge.source)
            const b = nodes.find(n => n.id === edge.target)
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
            if (edge.type === 'sibling') {
              return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#3a3a44" strokeWidth={1} strokeDasharray="3,3" />
            }
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#3a3a50" strokeWidth={1.5} />
          })}

          {nodes.map(node => {
            const p = persons.find(x => x.id === node.id); if (!p) return null
            const isSelected = sel === p.id
            const isDead = p.status === 'deceased'
            const clanColor = getClanColor(p.clan, clans)
            const label = p.name.length > 16 ? p.name.slice(0, 14) + '…' : p.name
            return (
              <g key={node.id} onClick={e => { e.stopPropagation(); setSel(node.id) }} style={{ cursor: 'pointer' }}>
                {isSelected && (
                  <circle cx={node.x} cy={node.y} r={node.r + 7} fill="none" stroke="#4A6FA5" strokeWidth={2} opacity={0.8} />
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
        </div>
      </div>
    </div>
  )
}
