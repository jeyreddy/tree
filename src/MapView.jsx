import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const CLAN_COLORS = ['#C4A35A', '#6B8E6B', '#5C7FB5', '#9B6BA0', '#C97B5D', '#7BAAAA', '#A0522D', '#708090']

function getClanColor(clan, allClans) {
  if (!clan) return '#888'
  const idx = allClans.indexOf(clan)
  return idx >= 0 ? CLAN_COLORS[idx % CLAN_COLORS.length] : '#888'
}

const LOCATIONS = {
  'hyderabad': [17.385, 78.487],
  'secunderabad': [17.444, 78.499],
  'delhi': [28.614, 77.209],
  'new delhi': [28.614, 77.209],
  'mumbai': [19.076, 72.878],
  'bombay': [19.076, 72.878],
  'bengaluru': [12.972, 77.595],
  'bangalore': [12.972, 77.595],
  'chennai': [13.083, 80.271],
  'madras': [13.083, 80.271],
  'kolkata': [22.573, 88.364],
  'calcutta': [22.573, 88.364],
  'pune': [18.520, 73.857],
  'ahmedabad': [23.023, 72.571],
  'jaipur': [26.912, 75.787],
  'visakhapatnam': [17.687, 83.218],
  'vizag': [17.687, 83.218],
  'vijayawada': [16.506, 80.648],
  'guntur': [16.307, 80.437],
  'tirupati': [13.629, 79.419],
  'warangal': [17.978, 79.594],
  'karimnagar': [18.439, 79.129],
  'nellore': [14.443, 79.987],
  'kurnool': [15.828, 78.037],
  'ongole': [15.506, 80.050],
  'rajahmundry': [17.001, 81.804],
  'kakinada': [16.989, 82.247],
  'eluru': [16.711, 81.095],
  'tenali': [16.243, 80.643],
  'machilipatnam': [16.188, 81.138],
  'amaravati': [16.513, 80.517],
  'anantapur': [14.682, 77.601],
  'kadapa': [14.467, 78.824],
  'srikakulam': [18.297, 83.898],
  'nizamabad': [18.672, 78.094],
  'khammam': [17.247, 80.151],
  'mahbubnagar': [16.749, 77.983],
  'nalgonda': [17.058, 79.268],
  'medak': [18.044, 78.261],
  'adilabad': [19.664, 78.532],
  'nandyal': [15.478, 78.484],
  'proddatur': [14.750, 78.548],
  'hindupur': [13.829, 77.491],
  'chittoor': [13.217, 79.101],
  'singapore': [1.352, 103.820],
  'dubai': [25.205, 55.271],
  'abu dhabi': [24.466, 54.367],
  'london': [51.507, -0.128],
  'uk': [51.507, -0.128],
  'sydney': [-33.869, 151.209],
  'melbourne': [-37.814, 144.963],
  'australia': [-25.274, 133.775],
  'usa': [39.833, -98.584],
  'united states': [39.833, -98.584],
  'new york': [40.713, -74.006],
  'california': [36.778, -119.418],
  'texas': [31.000, -100.000],
  'new jersey': [40.058, -74.406],
  'canada': [56.130, -106.347],
  'germany': [51.166, 10.452],
  'middle east': [24.0, 53.0],
  'malaysia': [4.211, 101.976],
  'japan': [36.205, 138.252],
}

function resolveGeo(location) {
  if (!location) return null
  const key = location.toLowerCase().trim()
  if (LOCATIONS[key]) return LOCATIONS[key]
  for (const [k, v] of Object.entries(LOCATIONS)) {
    if (key.includes(k) || k.includes(key)) return v
  }
  return null
}

export default function MapView({ persons, sel, setSel, onContextMenu }) {
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const markersRef = useRef([])
  const linesRef = useRef([])
  const [mapReady, setMapReady] = useState(false)

  const allClans = [...new Set(persons.map(p => p.clan).filter(Boolean))].sort()
  const unlocated = persons.filter(p => !resolveGeo(p.location))

  // Init map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return
    const map = L.map(mapRef.current, { center: [17.5, 78.5], zoom: 6 })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map)
    mapInstance.current = map
    setMapReady(true)
    return () => {
      map.remove()
      mapInstance.current = null
      setMapReady(false)
    }
  }, [])

  // Render markers + lines when persons or map readiness changes
  useEffect(() => {
    const map = mapInstance.current
    if (!map) return

    markersRef.current.forEach(m => m.remove())
    linesRef.current.forEach(l => l.remove())
    markersRef.current = []
    linesRef.current = []

    // Group persons by resolved geo
    const locationGroups = {}
    persons.forEach(p => {
      const geo = resolveGeo(p.location)
      if (!geo) return
      const key = geo.join(',')
      if (!locationGroups[key]) locationGroups[key] = { geo, persons: [] }
      locationGroups[key].persons.push(p)
    })

    const bounds = []

    Object.values(locationGroups).forEach(({ geo, persons: group }) => {
      bounds.push(geo)
      const allDead = group.every(p => p.status === 'deceased')
      const color = getClanColor(group[0]?.clan, allClans)
      const radius = 7 + Math.min(group.length * 2, 12)

      const marker = L.circleMarker(geo, {
        radius,
        fillColor: color,
        color: allDead ? '#aaa' : color,
        weight: 1.5,
        opacity: 1,
        fillOpacity: allDead ? 0.25 : 0.75,
        dashArray: allDead ? '4,3' : null,
      }).addTo(map)

      const popupHtml = `
        <div style="font-family:'DM Sans',sans-serif;min-width:140px">
          <div style="font-size:10px;color:#999;margin-bottom:6px;font-weight:600;letter-spacing:0.4px">${(group[0]?.location || '').toUpperCase()}</div>
          ${group.map(p => `
            <div data-id="${p.id}" style="padding:5px 0;cursor:pointer;font-size:13px;border-bottom:1px solid #f5f5f5;display:flex;align-items:center;gap:6px">
              <span style="color:${p.status === 'deceased' ? '#bbb' : '#1a1a1a'};${p.status === 'deceased' ? 'text-decoration:line-through' : ''}">${p.status === 'deceased' ? '✝ ' : ''}${p.name}</span>
              ${p.clan ? `<span style="font-size:10px;color:#bbb">${p.clan}</span>` : ''}
            </div>
          `).join('')}
        </div>
      `

      marker.bindPopup(popupHtml, { className: 'kv-popup', maxWidth: 240 })

      marker.on('click', () => {
        if (group.length === 1) setSel(group[0].id)
        marker.openPopup()
      })

      marker.on('contextmenu', (e) => {
        if (group.length === 1 && onContextMenu) {
          onContextMenu(group[0].id, e.originalEvent)
        } else {
          marker.openPopup()
        }
      })

      marker.on('popupopen', () => {
        setTimeout(() => {
          const el = marker.getPopup()?.getElement()
          if (!el) return
          el.querySelectorAll('[data-id]').forEach(node => {
            const pid = node.getAttribute('data-id')
            node.addEventListener('click', () => { setSel(pid); map.closePopup() })
            node.addEventListener('contextmenu', (e) => {
              e.preventDefault()
              if (onContextMenu) onContextMenu(pid, e)
            })
          })
        }, 50)
      })

      markersRef.current.push(marker)
    })

    // Migration lines: parent → child at different locations
    const drawnMigration = new Set()
    persons.forEach(child => {
      const childGeo = resolveGeo(child.location)
      if (!childGeo || !child.parentId) return
      const parent = persons.find(p => p.id === child.parentId)
      if (!parent) return
      const parentGeo = resolveGeo(parent.location)
      if (!parentGeo) return
      if (parentGeo[0] === childGeo[0] && parentGeo[1] === childGeo[1]) return
      const lineKey = parentGeo.join(',') + '|' + childGeo.join(',')
      if (drawnMigration.has(lineKey)) return
      drawnMigration.add(lineKey)

      const line = L.polyline([parentGeo, childGeo], {
        color: getClanColor(child.clan, allClans),
        weight: 1.2,
        opacity: 0.3,
        dashArray: '5,4',
      }).addTo(map)
      linesRef.current.push(line)
    })

    // Spouse connection lines
    const drawnSpouse = new Set()
    persons.forEach(p => {
      if (!p.spouseId) return
      const pGeo = resolveGeo(p.location)
      const spouse = persons.find(x => x.id === p.spouseId)
      if (!spouse) return
      const sGeo = resolveGeo(spouse.location)
      if (!pGeo || !sGeo) return
      if (pGeo[0] === sGeo[0] && pGeo[1] === sGeo[1]) return
      const lineKey = [p.id, spouse.id].sort().join('|')
      if (drawnSpouse.has(lineKey)) return
      drawnSpouse.add(lineKey)

      const line = L.polyline([pGeo, sGeo], {
        color: '#C97B5D',
        weight: 1.5,
        opacity: 0.4,
      }).addTo(map)
      linesRef.current.push(line)
    })

    if (bounds.length > 1) {
      try { map.fitBounds(bounds, { padding: [50, 50] }) } catch (_) {}
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 10)
    }
  }, [persons, mapReady])

  // Pan to selected person
  useEffect(() => {
    const map = mapInstance.current
    if (!map || !sel) return
    const person = persons.find(p => p.id === sel)
    if (!person) return
    const geo = resolveGeo(person.location)
    if (!geo) return
    map.setView(geo, Math.max(map.getZoom(), 9), { animate: true })
  }, [sel])

  return (
    <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
      <div ref={mapRef} style={{ position: 'absolute', inset: 0 }} />

      {unlocated.length > 0 && (
        <div style={{
          position: 'absolute', bottom: 16, right: 16, zIndex: 1000,
          background: 'rgba(255,255,255,0.95)', borderRadius: 8,
          padding: '8px 12px', fontSize: 11, color: '#999',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)', maxWidth: 190,
        }}>
          <div style={{ fontWeight: 600, color: '#666', marginBottom: 3 }}>{unlocated.length} without location</div>
          <div style={{ lineHeight: 1.5 }}>
            {unlocated.slice(0, 5).map(p => p.name).join(', ')}
            {unlocated.length > 5 ? ` +${unlocated.length - 5} more` : ''}
          </div>
        </div>
      )}

      <div style={{
        position: 'absolute', bottom: 16, left: 16, zIndex: 1000,
        background: 'rgba(255,255,255,0.95)', borderRadius: 8,
        padding: '8px 12px', fontSize: 10, color: '#999',
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
      }}>
        <div style={{ fontWeight: 600, color: '#666', marginBottom: 5 }}>Legend</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <div style={{ width: 20, borderBottom: '1.5px solid #C97B5D' }} />
          <span>Spouse link</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 20, borderBottom: '1.5px dashed #888' }} />
          <span>Migration</span>
        </div>
      </div>
    </div>
  )
}
