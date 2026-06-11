import { useState, useEffect, useCallback, useRef } from 'react'

const CLAN_COLORS = ['#C4A35A', '#6B8E6B', '#5C7FB5', '#9B6BA0', '#C97B5D', '#7BAAAA', '#A0522D', '#708090']
const CARD_W = 140, CARD_H = 55, COUPLE_GAP = 12, SIB_GAP = 16, GEN_GAP = 60, CONN_DROP = 25

export function findRoots(persons) {
  const noParent = persons.filter(p => !p.parentId || !persons.find(x => x.id === p.parentId))
  const roots = []
  const handled = new Set()

  noParent.forEach(p => {
    if (handled.has(p.id)) return
    const isMarriedInSpouse = persons.some(other =>
      other.spouseId === p.id && other.parentId && persons.find(x => x.id === other.parentId)
    )
    if (isMarriedInSpouse) { handled.add(p.id); return }

    if (p.spouseId && !handled.has(p.spouseId)) {
      const spouse = persons.find(x => x.id === p.spouseId)
      if (spouse && !spouse.parentId) {
        handled.add(p.id); handled.add(p.spouseId)
        const primary = p.gender === 'M' ? p : (spouse.gender === 'M' ? spouse : (p.sortOrder <= spouse.sortOrder ? p : spouse))
        roots.push(primary.id)
      } else {
        handled.add(p.id); roots.push(p.id)
      }
    } else if (!handled.has(p.id)) {
      handled.add(p.id); roots.push(p.id)
    }
  })

  return roots
}

function getCoupleChildren(personId, spouseId, persons) {
  const childIds = new Set()
  const children = []
  persons.forEach(p => {
    if ((p.parentId === personId || (spouseId && p.parentId === spouseId)) && !childIds.has(p.id)) {
      childIds.add(p.id); children.push(p)
    }
  })
  return children.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
}

function getClanColor(clan, allClans) {
  if (!clan) return '#ddd'
  const idx = allClans.indexOf(clan)
  return idx >= 0 ? CLAN_COLORS[idx % CLAN_COLORS.length] : '#ddd'
}

export function getDisplayClan(person, persons) {
  if (person.spouseId) {
    const spouse = persons.find(p => p.id === person.spouseId)
    if (spouse && spouse.clan && person.clan && spouse.clan !== person.clan) {
      const marriedIn = !person.parentId && spouse.parentId
      const isWife = person.gender === 'F'
      if (marriedIn || isWife) return `${person.clan} → ${spouse.clan}`
    }
  }
  return person.clan || ''
}

function layoutFamily(personId, startX, startY, persons) {
  const person = persons.find(p => p.id === personId)
  if (!person) return { width: CARD_W, cards: [], connectors: [], coupleCenter: startX + CARD_W / 2 }
  const spouse = person.spouseId ? persons.find(p => p.id === person.spouseId) : null
  const children = getCoupleChildren(person.id, spouse?.id, persons)
  const coupleW = spouse ? CARD_W * 2 + COUPLE_GAP : CARD_W

  if (children.length === 0) {
    return {
      width: coupleW,
      cards: [
        { id: person.id, x: startX, y: startY, w: CARD_W, h: CARD_H },
        ...(spouse ? [{ id: spouse.id, x: startX + CARD_W + COUPLE_GAP, y: startY, w: CARD_W, h: CARD_H }] : [])
      ],
      connectors: spouse ? [{ type: 'spouse', x1: startX + CARD_W, y1: startY + CARD_H / 2, x2: startX + CARD_W + COUPLE_GAP, y2: startY + CARD_H / 2 }] : [],
      coupleCenter: startX + coupleW / 2,
    }
  }

  let childX = startX
  const childLayouts = []
  children.forEach((child, i) => {
    if (i > 0) childX += SIB_GAP
    const childLayout = layoutFamily(child.id, childX, startY + CARD_H + GEN_GAP, persons)
    childLayouts.push(childLayout)
    childX += childLayout.width
  })

  const childrenTotalW = childX - startX
  const totalW = Math.max(coupleW, childrenTotalW)
  const coupleX = startX + childrenTotalW / 2 - coupleW / 2
  const coupleCenter = coupleX + coupleW / 2

  const cards = [
    { id: person.id, x: coupleX, y: startY, w: CARD_W, h: CARD_H },
    ...(spouse ? [{ id: spouse.id, x: coupleX + CARD_W + COUPLE_GAP, y: startY, w: CARD_W, h: CARD_H }] : []),
    ...childLayouts.flatMap(cl => cl.cards),
  ]

  const connectors = [
    ...(spouse ? [{ type: 'spouse', x1: coupleX + CARD_W, y1: startY + CARD_H / 2, x2: coupleX + CARD_W + COUPLE_GAP, y2: startY + CARD_H / 2 }] : []),
    { type: 'parent-children', parentX: coupleCenter, parentY: startY + CARD_H, children: childLayouts.map(cl => cl.coupleCenter), childY: startY + CARD_H + GEN_GAP },
    ...childLayouts.flatMap(cl => cl.connectors),
  ]

  return { width: totalW, cards, connectors, coupleCenter }
}

export function SVGTree({ persons, sel, setSel, clans, rootIds, onAddRoot }) {
  const [pan, setPan] = useState({ x: 40, y: 40 })
  const [zoom, setZoom] = useState(1)
  const svgRef = useRef(null)
  const isPanning = useRef(false)
  const lastMouse = useRef(null)

  const allCards = [], allConnectors = []
  let rx = 0
  for (const rootId of rootIds) {
    const layout = layoutFamily(rootId, rx, 0, persons)
    allCards.push(...layout.cards)
    allConnectors.push(...layout.connectors)
    rx += layout.width + SIB_GAP * 2
  }
  const seenIds = new Set()
  const uniqueCards = allCards.filter(card => {
    if (seenIds.has(card.id)) return false
    seenIds.add(card.id); return true
  })
  const cardsRef = useRef(uniqueCards)
  cardsRef.current = uniqueCards

  useEffect(() => {
    const el = svgRef.current; if (!el) return
    const onWheel = e => { e.preventDefault(); setZoom(z => Math.min(3, Math.max(0.1, z * (e.deltaY < 0 ? 1.1 : 0.9)))) }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const fitTree = useCallback(() => {
    if (!svgRef.current || !cardsRef.current.length) return
    const rect = svgRef.current.getBoundingClientRect()
    const cs = cardsRef.current
    const minX = Math.min(...cs.map(c => c.x)), maxX = Math.max(...cs.map(c => c.x + c.w))
    const minY = Math.min(...cs.map(c => c.y)), maxY = Math.max(...cs.map(c => c.y + c.h))
    const tw = maxX - minX, th = maxY - minY; if (!tw || !th) return
    const nz = Math.min(3, Math.max(0.1, Math.min((rect.width - 40) / tw, (rect.height - 40) / th)))
    setZoom(nz)
    setPan({ x: (rect.width - tw * nz) / 2 - minX * nz, y: (rect.height - th * nz) / 2 - minY * nz })
  }, [])

  const prevLen = useRef(-1)
  useEffect(() => {
    if (persons.length > 0 && persons.length !== prevLen.current) {
      prevLen.current = persons.length
      setTimeout(fitTree, 60)
    }
  }, [persons.length, fitTree])

  useEffect(() => {
    if (!sel || !svgRef.current) return
    const card = cardsRef.current.find(c => c.id === sel); if (!card) return
    const rect = svgRef.current.getBoundingClientRect()
    setPan({ x: rect.width / 2 - (card.x + card.w / 2) * zoom, y: rect.height / 2 - (card.y + card.h / 2) * zoom })
  }, [sel]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden' }}>
      <svg
        ref={svgRef}
        style={{ width: '100%', height: '100%', display: 'block', background: '#fafafa', cursor: 'grab' }}
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
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {allConnectors.map((conn, i) => {
            if (conn.type === 'spouse') {
              const mx = (conn.x1 + conn.x2) / 2
              return (
                <g key={`s${i}`}>
                  <line x1={conn.x1} y1={conn.y1} x2={conn.x2} y2={conn.y2} stroke="#E8A87C" strokeWidth={1.5} />
                  <text x={mx} y={conn.y1 - 2} textAnchor="middle" fontSize={7} fill="#E8A87C"
                    style={{ userSelect: 'none', pointerEvents: 'none' }}>♥</text>
                </g>
              )
            }
            if (conn.type === 'parent-children') {
              const dropY = conn.parentY + CONN_DROP
              return (
                <g key={`pc${i}`}>
                  <line x1={conn.parentX} y1={conn.parentY} x2={conn.parentX} y2={dropY} stroke="#ddd" strokeWidth={1} />
                  {conn.children.length > 1 && (
                    <line x1={Math.min(...conn.children)} y1={dropY} x2={Math.max(...conn.children)} y2={dropY} stroke="#ddd" strokeWidth={1} />
                  )}
                  {conn.children.map((cx, j) => (
                    <line key={j} x1={cx} y1={dropY} x2={cx} y2={conn.childY} stroke="#ddd" strokeWidth={1} />
                  ))}
                </g>
              )
            }
            return null
          })}

          {uniqueCards.map(card => {
            const p = persons.find(x => x.id === card.id); if (!p) return null
            const isSelected = sel === p.id, isDead = p.status === 'deceased'
            const clanColor = getClanColor(p.clan, clans)
            const displayClan = getDisplayClan(p, persons)
            const displayName = (isDead ? '✝ ' : '') + (p.name.length > 18 ? p.name.slice(0, 16) + '…' : p.name)
            return (
              <g key={card.id} onClick={e => { e.stopPropagation(); setSel(card.id) }} style={{ cursor: 'pointer' }}>
                {isSelected && <rect x={card.x - 2} y={card.y - 2} width={card.w + 4} height={card.h + 4} rx={8} fill="none" stroke="#4A6FA5" strokeWidth={1.5} />}
                <rect x={card.x} y={card.y} width={card.w} height={card.h} rx={6}
                  fill={isDead ? '#f5f5f5' : '#fff'} stroke={isDead ? '#ccc' : '#e8e8e8'}
                  strokeWidth={1} strokeDasharray={isDead ? '4,2' : undefined} />
                <rect x={card.x} y={card.y} width={3} height={card.h} rx={1} fill={clanColor} />
                <text x={card.x + 10} y={card.y + 15} fontSize={11} fontWeight="600"
                  fill={isDead ? '#aaa' : '#1a1a1a'}
                  textDecoration={isDead ? 'line-through' : undefined}
                  fontFamily="DM Sans,sans-serif">{displayName}</text>
                {displayClan && (
                  <text x={card.x + 10} y={card.y + 28} fontSize={9} fill={clanColor} fontFamily="DM Sans,sans-serif">
                    {displayClan.length > 22 ? displayClan.slice(0, 21) + '…' : displayClan}
                  </text>
                )}
                {p.location && (
                  <text x={card.x + 10} y={card.y + 41} fontSize={8} fill="#aaa" fontFamily="DM Sans,sans-serif">
                    {p.location.length > 22 ? p.location.slice(0, 21) + '…' : p.location}
                  </text>
                )}
                {!p.verified && <circle cx={card.x + card.w - 8} cy={card.y + 7} r={3} fill="#FFC107" />}
              </g>
            )
          })}
        </g>
      </svg>

      <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4, zIndex: 10 }}>
        <button onClick={fitTree} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Fit</button>
        <button onClick={() => setZoom(z => Math.min(3, z * 1.2))} style={{ padding: '4px 8px', fontSize: 14, fontWeight: 700, background: '#f0f0f0', color: '#555', border: 'none', borderRadius: 6, cursor: 'pointer' }}>+</button>
        <button onClick={() => setZoom(z => Math.max(0.1, z / 1.2))} style={{ padding: '4px 8px', fontSize: 14, fontWeight: 700, background: '#f0f0f0', color: '#555', border: 'none', borderRadius: 6, cursor: 'pointer' }}>−</button>
        {onAddRoot && (
          <button onClick={onAddRoot} style={{ padding: '4px 8px', fontSize: 11, background: 'transparent', color: '#bbb', border: '1.5px dashed #ddd', borderRadius: 6, cursor: 'pointer', marginLeft: 4 }}>+ Root</button>
        )}
      </div>
    </div>
  )
}
