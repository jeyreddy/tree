// RelationshipEngine.js — Pure utility module for kinship classification

export const WEIGHT_VALUES = { highest: 10, very_high: 8, high: 6, medium: 4, low: 2 }

const TERMS = {
  english: {
    self:            { label: 'Self',             englishLabel: 'Self',             note: '',                                                      weight: 'highest'   },
    husband:         { label: 'Husband',           englishLabel: 'Husband',           note: 'Life partner',                                          weight: 'highest'   },
    wife:            { label: 'Wife',              englishLabel: 'Wife',              note: 'Life partner',                                          weight: 'highest'   },
    father:          { label: 'Father',            englishLabel: 'Father',            note: 'Patriarch of the household',                            weight: 'very_high' },
    mother:          { label: 'Mother',            englishLabel: 'Mother',            note: 'Matriarch of the household',                            weight: 'very_high' },
    son:             { label: 'Son',               englishLabel: 'Son',               note: '',                                                      weight: 'very_high' },
    daughter:        { label: 'Daughter',          englishLabel: 'Daughter',          note: '',                                                      weight: 'very_high' },
    brother:         { label: 'Brother',           englishLabel: 'Brother',           note: '',                                                      weight: 'high'      },
    sister:          { label: 'Sister',            englishLabel: 'Sister',            note: '',                                                      weight: 'high'      },
    grandfather:     { label: 'Grandfather',       englishLabel: 'Grandfather',       note: '',                                                      weight: 'high'      },
    grandmother:     { label: 'Grandmother',       englishLabel: 'Grandmother',       note: '',                                                      weight: 'high'      },
    grandson:        { label: 'Grandson',          englishLabel: 'Grandson',          note: '',                                                      weight: 'high'      },
    granddaughter:   { label: 'Granddaughter',     englishLabel: 'Granddaughter',     note: '',                                                      weight: 'high'      },
    paternal_uncle:  { label: 'Paternal Uncle',    englishLabel: 'Paternal Uncle',    note: "Father's brother",                                      weight: 'medium'    },
    paternal_aunt:   { label: 'Paternal Aunt',     englishLabel: 'Paternal Aunt',     note: "Father's sister",                                       weight: 'medium'    },
    maternal_uncle:  { label: 'Maternal Uncle',    englishLabel: 'Maternal Uncle',    note: "Mother's brother — preferred match in Dravidian kinship", weight: 'very_high' },
    maternal_aunt:   { label: 'Maternal Aunt',     englishLabel: 'Maternal Aunt',     note: "Mother's sister",                                       weight: 'very_high' },
    nephew:          { label: 'Nephew',            englishLabel: 'Nephew',            note: '',                                                      weight: 'medium'    },
    niece:           { label: 'Niece',             englishLabel: 'Niece',             note: '',                                                      weight: 'medium'    },
    cousin:          { label: 'Cousin',            englishLabel: 'Cousin',            note: '',                                                      weight: 'medium'    },
    brother_in_law:  { label: 'Brother-in-law',    englishLabel: 'Brother-in-law',    note: '',                                                      weight: 'medium'    },
    sister_in_law:   { label: 'Sister-in-law',     englishLabel: 'Sister-in-law',     note: '',                                                      weight: 'medium'    },
    father_in_law:   { label: 'Father-in-law',     englishLabel: 'Father-in-law',     note: '',                                                      weight: 'medium'    },
    mother_in_law:   { label: 'Mother-in-law',     englishLabel: 'Mother-in-law',     note: '',                                                      weight: 'medium'    },
    son_in_law:      { label: 'Son-in-law',        englishLabel: 'Son-in-law',        note: '',                                                      weight: 'medium'    },
    daughter_in_law: { label: 'Daughter-in-law',   englishLabel: 'Daughter-in-law',   note: '',                                                      weight: 'medium'    },
    relative:        { label: 'Relative',          englishLabel: 'Relative',          note: '',                                                      weight: 'low'       },
  },
  telugu: {
    self:            { label: 'స్వయం',                   englishLabel: 'Self',             note: '',                                                                          weight: 'highest'   },
    husband:         { label: 'భర్త',                    englishLabel: 'Husband',           note: 'జీవిత భాగస్వామి',                                                           weight: 'highest'   },
    wife:            { label: 'భార్య',                   englishLabel: 'Wife',              note: 'జీవిత భాగస్వామి',                                                           weight: 'highest'   },
    father:          { label: 'నాన్న / తండ్రి',          englishLabel: 'Father',            note: 'ఇంటి పెద్ద',                                                               weight: 'very_high' },
    mother:          { label: 'అమ్మ / తల్లి',            englishLabel: 'Mother',            note: 'ఇంటి ఆధారం',                                                               weight: 'very_high' },
    son:             { label: 'కొడుకు',                  englishLabel: 'Son',               note: '',                                                                          weight: 'very_high' },
    daughter:        { label: 'కూతురు',                  englishLabel: 'Daughter',          note: '',                                                                          weight: 'very_high' },
    brother:         { label: 'అన్న / తమ్ముడు',         englishLabel: 'Brother',           note: '',                                                                          weight: 'high'      },
    sister:          { label: 'అక్క / చెల్లి',          englishLabel: 'Sister',            note: '',                                                                          weight: 'high'      },
    grandfather:     { label: 'తాత',                     englishLabel: 'Grandfather',       note: '',                                                                          weight: 'high'      },
    grandmother:     { label: 'నాయనమ్మ / అమ్మమ్మ',     englishLabel: 'Grandmother',       note: '',                                                                          weight: 'high'      },
    grandson:        { label: 'మనవడు',                   englishLabel: 'Grandson',          note: '',                                                                          weight: 'high'      },
    granddaughter:   { label: 'మనవరాలు',                 englishLabel: 'Granddaughter',     note: '',                                                                          weight: 'high'      },
    paternal_uncle:  { label: 'పెద్దనాన్న / చిన్నాన్న', englishLabel: 'Paternal Uncle',    note: 'తండ్రి సోదరుడు',                                                            weight: 'medium'    },
    paternal_aunt:   { label: 'పెద్దమ్మ / చిన్నమ్మ',    englishLabel: 'Paternal Aunt',     note: 'తండ్రి సోదరి',                                                             weight: 'medium'    },
    maternal_uncle:  { label: 'మేనమామ',                  englishLabel: 'Maternal Uncle',    note: 'తెలుగు కుటుంబాలలో అత్యంత ముఖ్యమైన సంబంధం — వివాహ అనుసంధానం',              weight: 'very_high' },
    maternal_aunt:   { label: 'మేనత్త',                  englishLabel: 'Maternal Aunt',     note: 'తెలుగు కుటుంబాలలో ముఖ్యమైన బంధం',                                          weight: 'very_high' },
    nephew:          { label: 'మేనల్లుడు',               englishLabel: 'Nephew',            note: '',                                                                          weight: 'medium'    },
    niece:           { label: 'మేనకోడలు',                englishLabel: 'Niece',             note: '',                                                                          weight: 'medium'    },
    cousin:          { label: 'బంధువు',                  englishLabel: 'Cousin',            note: '',                                                                          weight: 'medium'    },
    brother_in_law:  { label: 'బావ / మరిది',             englishLabel: 'Brother-in-law',    note: '',                                                                          weight: 'medium'    },
    sister_in_law:   { label: 'వదిన / మరదలు',           englishLabel: 'Sister-in-law',     note: '',                                                                          weight: 'medium'    },
    father_in_law:   { label: 'మామగారు',                 englishLabel: 'Father-in-law',     note: '',                                                                          weight: 'medium'    },
    mother_in_law:   { label: 'అత్తగారు',                englishLabel: 'Mother-in-law',     note: '',                                                                          weight: 'medium'    },
    son_in_law:      { label: 'అల్లుడు',                 englishLabel: 'Son-in-law',        note: '',                                                                          weight: 'medium'    },
    daughter_in_law: { label: 'కోడలు',                   englishLabel: 'Daughter-in-law',   note: '',                                                                          weight: 'medium'    },
    relative:        { label: 'బంధువు',                  englishLabel: 'Relative',          note: '',                                                                          weight: 'low'       },
  },
  hindi: {
    self:            { label: 'स्वयं',             englishLabel: 'Self',             note: '',                                                   weight: 'highest'   },
    husband:         { label: 'पति',               englishLabel: 'Husband',           note: 'जीवन साथी',                                          weight: 'highest'   },
    wife:            { label: 'पत्नी',             englishLabel: 'Wife',              note: 'जीवन साथी',                                          weight: 'highest'   },
    father:          { label: 'पिता',              englishLabel: 'Father',            note: 'घर के मुखिया',                                       weight: 'very_high' },
    mother:          { label: 'माँ',               englishLabel: 'Mother',            note: 'घर की आधार',                                        weight: 'very_high' },
    son:             { label: 'बेटा',              englishLabel: 'Son',               note: '',                                                   weight: 'very_high' },
    daughter:        { label: 'बेटी',              englishLabel: 'Daughter',          note: '',                                                   weight: 'very_high' },
    brother:         { label: 'भाई',               englishLabel: 'Brother',           note: '',                                                   weight: 'high'      },
    sister:          { label: 'बहन',               englishLabel: 'Sister',            note: '',                                                   weight: 'high'      },
    grandfather:     { label: 'दादा / नाना',       englishLabel: 'Grandfather',       note: '',                                                   weight: 'high'      },
    grandmother:     { label: 'दादी / नानी',       englishLabel: 'Grandmother',       note: '',                                                   weight: 'high'      },
    grandson:        { label: 'पोता',              englishLabel: 'Grandson',          note: '',                                                   weight: 'high'      },
    granddaughter:   { label: 'पोती',              englishLabel: 'Granddaughter',     note: '',                                                   weight: 'high'      },
    paternal_uncle:  { label: 'चाचा / ताऊ',        englishLabel: 'Paternal Uncle',    note: 'पिता के भाई',                                        weight: 'medium'    },
    paternal_aunt:   { label: 'बुआ / चाची',        englishLabel: 'Paternal Aunt',     note: 'पिता की बहन',                                        weight: 'medium'    },
    maternal_uncle:  { label: 'मामा',              englishLabel: 'Maternal Uncle',    note: 'माँ के भाई — द्रविड़ वंश में महत्वपूर्ण',            weight: 'very_high' },
    maternal_aunt:   { label: 'मौसी / मामी',       englishLabel: 'Maternal Aunt',     note: 'माँ की बहन',                                        weight: 'medium'    },
    nephew:          { label: 'भतीजा',             englishLabel: 'Nephew',            note: '',                                                   weight: 'medium'    },
    niece:           { label: 'भतीजी',             englishLabel: 'Niece',             note: '',                                                   weight: 'medium'    },
    cousin:          { label: 'चचेरे भाई/बहन',     englishLabel: 'Cousin',            note: '',                                                   weight: 'medium'    },
    brother_in_law:  { label: 'जीजा / देवर',       englishLabel: 'Brother-in-law',    note: '',                                                   weight: 'medium'    },
    sister_in_law:   { label: 'भाभी / साली',       englishLabel: 'Sister-in-law',     note: '',                                                   weight: 'medium'    },
    father_in_law:   { label: 'ससुर',              englishLabel: 'Father-in-law',     note: '',                                                   weight: 'medium'    },
    mother_in_law:   { label: 'सास',               englishLabel: 'Mother-in-law',     note: '',                                                   weight: 'medium'    },
    son_in_law:      { label: 'दामाद',             englishLabel: 'Son-in-law',        note: '',                                                   weight: 'medium'    },
    daughter_in_law: { label: 'बहू',               englishLabel: 'Daughter-in-law',   note: '',                                                   weight: 'medium'    },
    relative:        { label: 'रिश्तेदार',         englishLabel: 'Relative',          note: '',                                                   weight: 'low'       },
  },
  tamil: {
    self:            { label: 'தாமே',                    englishLabel: 'Self',             note: '',                                                               weight: 'highest'   },
    husband:         { label: 'கணவர்',                   englishLabel: 'Husband',           note: 'வாழ்க்கை துணை',                                                  weight: 'highest'   },
    wife:            { label: 'மனைவி',                   englishLabel: 'Wife',              note: 'வாழ்க்கை துணை',                                                  weight: 'highest'   },
    father:          { label: 'அப்பா',                   englishLabel: 'Father',            note: 'குடும்பத் தலைவர்',                                                weight: 'very_high' },
    mother:          { label: 'அம்மா',                   englishLabel: 'Mother',            note: 'குடும்பத்தின் ஆதாரம்',                                           weight: 'very_high' },
    son:             { label: 'மகன்',                    englishLabel: 'Son',               note: '',                                                               weight: 'very_high' },
    daughter:        { label: 'மகள்',                    englishLabel: 'Daughter',          note: '',                                                               weight: 'very_high' },
    brother:         { label: 'அண்ணன் / தம்பி',         englishLabel: 'Brother',           note: '',                                                               weight: 'high'      },
    sister:          { label: 'அக்கா / தங்கை',          englishLabel: 'Sister',            note: '',                                                               weight: 'high'      },
    grandfather:     { label: 'தாத்தா',                  englishLabel: 'Grandfather',       note: '',                                                               weight: 'high'      },
    grandmother:     { label: 'பாட்டி',                  englishLabel: 'Grandmother',       note: '',                                                               weight: 'high'      },
    grandson:        { label: 'பேரன்',                   englishLabel: 'Grandson',          note: '',                                                               weight: 'high'      },
    granddaughter:   { label: 'பேத்தி',                  englishLabel: 'Granddaughter',     note: '',                                                               weight: 'high'      },
    paternal_uncle:  { label: 'சித்தப்பா / பெரியப்பா',  englishLabel: 'Paternal Uncle',    note: 'தந்தையின் சகோதரர்',                                              weight: 'medium'    },
    paternal_aunt:   { label: 'சித்தி / பெரியம்மா',     englishLabel: 'Paternal Aunt',     note: 'தந்தையின் சகோதரி',                                              weight: 'medium'    },
    maternal_uncle:  { label: 'மாமா',                    englishLabel: 'Maternal Uncle',    note: 'தாயின் சகோதரர் — திராவிட மரபில் முக்கியமான உறவு',               weight: 'very_high' },
    maternal_aunt:   { label: 'அத்தை',                   englishLabel: 'Maternal Aunt',     note: 'தாயின் சகோதரி',                                                 weight: 'very_high' },
    nephew:          { label: 'மருமகன்',                 englishLabel: 'Nephew',            note: '',                                                               weight: 'medium'    },
    niece:           { label: 'மருமகள்',                 englishLabel: 'Niece',             note: '',                                                               weight: 'medium'    },
    cousin:          { label: 'உறவினர்',                 englishLabel: 'Cousin',            note: '',                                                               weight: 'medium'    },
    brother_in_law:  { label: 'மாமனார் / மைத்துனர்',   englishLabel: 'Brother-in-law',    note: '',                                                               weight: 'medium'    },
    sister_in_law:   { label: 'மாமியார் / நாத்தனார்',  englishLabel: 'Sister-in-law',     note: '',                                                               weight: 'medium'    },
    father_in_law:   { label: 'மாமனார்',                 englishLabel: 'Father-in-law',     note: '',                                                               weight: 'medium'    },
    mother_in_law:   { label: 'மாமியார்',                englishLabel: 'Mother-in-law',     note: '',                                                               weight: 'medium'    },
    son_in_law:      { label: 'மருமகன்',                 englishLabel: 'Son-in-law',        note: '',                                                               weight: 'medium'    },
    daughter_in_law: { label: 'மருமகள்',                 englishLabel: 'Daughter-in-law',   note: '',                                                               weight: 'medium'    },
    relative:        { label: 'உறவினர்',                 englishLabel: 'Relative',          note: '',                                                               weight: 'low'       },
  },
  kannada: {
    self:            { label: 'ಸ್ವಯಂ',                  englishLabel: 'Self',             note: '',                                                                        weight: 'highest'   },
    husband:         { label: 'ಗಂಡ',                     englishLabel: 'Husband',           note: 'ಜೀವನ ಸಂಗಾತಿ',                                                             weight: 'highest'   },
    wife:            { label: 'ಹೆಂಡತಿ',                 englishLabel: 'Wife',              note: 'ಜೀವನ ಸಂಗಾತಿ',                                                             weight: 'highest'   },
    father:          { label: 'ತಂದೆ',                   englishLabel: 'Father',            note: 'ಕುಟುಂಬ ನಾಯಕ',                                                             weight: 'very_high' },
    mother:          { label: 'ತಾಯಿ',                   englishLabel: 'Mother',            note: 'ಕುಟುಂಬದ ಆಧಾರ',                                                            weight: 'very_high' },
    son:             { label: 'ಮಗ',                      englishLabel: 'Son',               note: '',                                                                        weight: 'very_high' },
    daughter:        { label: 'ಮಗಳು',                   englishLabel: 'Daughter',          note: '',                                                                        weight: 'very_high' },
    brother:         { label: 'ಅಣ್ಣ / ತಮ್ಮ',           englishLabel: 'Brother',           note: '',                                                                        weight: 'high'      },
    sister:          { label: 'ಅಕ್ಕ / ತಂಗಿ',           englishLabel: 'Sister',            note: '',                                                                        weight: 'high'      },
    grandfather:     { label: 'ತಾತ',                    englishLabel: 'Grandfather',       note: '',                                                                        weight: 'high'      },
    grandmother:     { label: 'ಅಜ್ಜಿ',                  englishLabel: 'Grandmother',       note: '',                                                                        weight: 'high'      },
    grandson:        { label: 'ಮೊಮ್ಮಗ',                englishLabel: 'Grandson',          note: '',                                                                        weight: 'high'      },
    granddaughter:   { label: 'ಮೊಮ್ಮಗಳು',              englishLabel: 'Granddaughter',     note: '',                                                                        weight: 'high'      },
    paternal_uncle:  { label: 'ದೊಡ್ಡಪ್ಪ / ಚಿಕ್ಕಪ್ಪ',  englishLabel: 'Paternal Uncle',    note: 'ತಂದೆಯ ಸಹೋದರ',                                                           weight: 'medium'    },
    paternal_aunt:   { label: 'ದೊಡ್ಡಮ್ಮ / ಚಿಕ್ಕಮ್ಮ',  englishLabel: 'Paternal Aunt',     note: 'ತಂದೆಯ ಸಹೋದರಿ',                                                          weight: 'medium'    },
    maternal_uncle:  { label: 'ಮಾವ',                    englishLabel: 'Maternal Uncle',    note: 'ತಾಯಿಯ ಸಹೋದರ — ದ್ರಾವಿಡ ಸಂಪ್ರದಾಯದಲ್ಲಿ ಮಹತ್ವದ ಸಂಬಂಧ',                    weight: 'very_high' },
    maternal_aunt:   { label: 'ಅತ್ತೆ',                  englishLabel: 'Maternal Aunt',     note: 'ತಾಯಿಯ ಸಹೋದರಿ',                                                           weight: 'very_high' },
    nephew:          { label: 'ಸೋದರಳಿಯ',               englishLabel: 'Nephew',            note: '',                                                                        weight: 'medium'    },
    niece:           { label: 'ಸೋದರಳಿಯ ಮಗಳು',          englishLabel: 'Niece',             note: '',                                                                        weight: 'medium'    },
    cousin:          { label: 'ಬಂಧು',                   englishLabel: 'Cousin',            note: '',                                                                        weight: 'medium'    },
    brother_in_law:  { label: 'ಮೈದುನ / ಬಾವ',          englishLabel: 'Brother-in-law',    note: '',                                                                        weight: 'medium'    },
    sister_in_law:   { label: 'ನಾದಿನಿ / ಅತ್ತಿಗೆ',     englishLabel: 'Sister-in-law',     note: '',                                                                        weight: 'medium'    },
    father_in_law:   { label: 'ಮಾವ',                    englishLabel: 'Father-in-law',     note: '',                                                                        weight: 'medium'    },
    mother_in_law:   { label: 'ಅತ್ತೆ',                  englishLabel: 'Mother-in-law',     note: '',                                                                        weight: 'medium'    },
    son_in_law:      { label: 'ಅಳಿಯ',                   englishLabel: 'Son-in-law',        note: '',                                                                        weight: 'medium'    },
    daughter_in_law: { label: 'ಸೊಸೆ',                  englishLabel: 'Daughter-in-law',   note: '',                                                                        weight: 'medium'    },
    relative:        { label: 'ಸಂಬಂಧಿ',                 englishLabel: 'Relative',          note: '',                                                                        weight: 'low'       },
  },
}

export const LABELS = TERMS

export function getWeightValue(rel) {
  return rel ? (WEIGHT_VALUES[rel.weight] ?? 0) : 0
}

// BFS shortest path — returns [fromId, …, toId] or null
export function findPath(fromId, toId, persons) {
  if (fromId === toId) return [fromId]
  const visited = new Set([fromId])
  const queue = [[fromId, [fromId]]]
  while (queue.length) {
    const [curr, path] = queue.shift()
    if (path.length > 9) continue
    const p = persons.find(x => x.id === curr)
    if (!p) continue
    const neighbors = []
    if (p.parentId) neighbors.push(p.parentId)
    if (p.spouseId) neighbors.push(p.spouseId)
    persons.forEach(q => { if (q.parentId === curr) neighbors.push(q.id) })
    if (p.parentId) {
      const par = persons.find(x => x.id === p.parentId)
      if (par?.spouseId) neighbors.push(par.spouseId)
    }
    for (const nid of neighbors) {
      if (visited.has(nid)) continue
      visited.add(nid)
      const next = [...path, nid]
      if (nid === toId) return next
      queue.push([nid, next])
    }
  }
  return null
}

// Return both blood parent and that parent's spouse
function parentPair(personId, persons) {
  const p = persons.find(x => x.id === personId)
  if (!p?.parentId) return []
  const par = persons.find(x => x.id === p.parentId)
  if (!par) return []
  const pair = [par]
  if (par.spouseId) {
    const sp = persons.find(x => x.id === par.spouseId)
    if (sp) pair.push(sp)
  }
  return pair
}

export function classifyRelationship(focusId, targetId, persons, language = 'english') {
  const lang = (language || 'english').toLowerCase()
  const t = TERMS[lang] || TERMS.english

  const focus = persons.find(p => p.id === focusId)
  const target = persons.find(p => p.id === targetId)
  if (!focus || !target) return null

  if (focusId === targetId) return { key: 'self', ...t.self }

  // Spouse
  if (focus.spouseId === targetId) {
    const key = target.gender === 'F' ? 'wife' : 'husband'
    return { key, ...t[key] }
  }

  // Parents
  const focusParents = parentPair(focusId, persons)
  for (const par of focusParents) {
    if (par.id === targetId) {
      const key = par.gender === 'F' ? 'mother' : 'father'
      return { key, ...t[key] }
    }
  }

  // Children (via focus or focus's spouse)
  const focusSpouse = focus.spouseId ? persons.find(p => p.id === focus.spouseId) : null
  const focusChildren = persons.filter(p =>
    p.parentId === focusId || (focusSpouse && p.parentId === focusSpouse.id)
  )
  for (const ch of focusChildren) {
    if (ch.id === targetId) {
      const key = ch.gender === 'F' ? 'daughter' : 'son'
      return { key, ...t[key] }
    }
  }

  // Grandparents
  for (const par of focusParents) {
    for (const gp of parentPair(par.id, persons)) {
      if (gp.id === targetId) {
        const key = gp.gender === 'F' ? 'grandmother' : 'grandfather'
        return { key, ...t[key] }
      }
    }
  }

  // Grandchildren
  for (const ch of focusChildren) {
    const chSpouse = ch.spouseId ? persons.find(p => p.id === ch.spouseId) : null
    const grandkids = persons.filter(p =>
      p.parentId === ch.id || (chSpouse && p.parentId === chSpouse.id)
    )
    for (const gc of grandkids) {
      if (gc.id === targetId) {
        const key = gc.gender === 'F' ? 'granddaughter' : 'grandson'
        return { key, ...t[key] }
      }
    }
  }

  // Siblings (share a parent with focus)
  for (const par of focusParents) {
    const sibs = persons.filter(p =>
      (p.parentId === par.id || (par.spouseId && p.parentId === par.spouseId)) && p.id !== focusId
    )
    for (const sib of sibs) {
      if (sib.id === targetId) {
        const key = sib.gender === 'F' ? 'sister' : 'brother'
        return { key, ...t[key] }
      }
    }
  }

  // All focus siblings (needed for sibling's spouse and nephew/niece)
  const allSiblings = []
  for (const par of focusParents) {
    persons.forEach(p => {
      if ((p.parentId === par.id || (par.spouseId && p.parentId === par.spouseId)) && p.id !== focusId) {
        if (!allSiblings.find(s => s.id === p.id)) allSiblings.push(p)
      }
    })
  }

  // Sibling's spouse
  for (const sib of allSiblings) {
    if (sib.spouseId === targetId) {
      const key = target.gender === 'F' ? 'sister_in_law' : 'brother_in_law'
      return { key, ...t[key] }
    }
  }

  // Spouse's siblings
  if (focusSpouse) {
    for (const spar of parentPair(focusSpouse.id, persons)) {
      const spouseSibs = persons.filter(p =>
        (p.parentId === spar.id || (spar.spouseId && p.parentId === spar.spouseId)) && p.id !== focusSpouse.id
      )
      for (const ss of spouseSibs) {
        if (ss.id === targetId) {
          const key = target.gender === 'F' ? 'sister_in_law' : 'brother_in_law'
          return { key, ...t[key] }
        }
      }
    }
  }

  // Child's spouse (in-law)
  for (const ch of focusChildren) {
    if (ch.spouseId === targetId) {
      const key = target.gender === 'F' ? 'daughter_in_law' : 'son_in_law'
      return { key, ...t[key] }
    }
  }

  // Spouse's parents (in-laws)
  if (focusSpouse) {
    for (const spar of parentPair(focusSpouse.id, persons)) {
      if (spar.id === targetId) {
        const key = spar.gender === 'F' ? 'mother_in_law' : 'father_in_law'
        return { key, ...t[key] }
      }
    }
  }

  // Uncle / Aunt — focus's parent's sibling
  for (const par of focusParents) {
    const isMaternalSide = par.gender === 'F'
    for (const gp of parentPair(par.id, persons)) {
      const parSibs = persons.filter(p =>
        (p.parentId === gp.id || (gp.spouseId && p.parentId === gp.spouseId)) && p.id !== par.id
      )
      for (const ps of parSibs) {
        if (ps.id === targetId) {
          const key = isMaternalSide
            ? (target.gender === 'F' ? 'maternal_aunt' : 'maternal_uncle')
            : (target.gender === 'F' ? 'paternal_aunt' : 'paternal_uncle')
          return { key, ...t[key] }
        }
        if (ps.spouseId === targetId) {
          const key = isMaternalSide
            ? (target.gender === 'F' ? 'maternal_aunt' : 'maternal_uncle')
            : (target.gender === 'F' ? 'paternal_aunt' : 'paternal_uncle')
          return { key, ...t[key] }
        }
      }
    }
  }

  // Nephew / Niece — sibling's child
  for (const sib of allSiblings) {
    const sibSpouse = sib.spouseId ? persons.find(p => p.id === sib.spouseId) : null
    const sibKids = persons.filter(p =>
      p.parentId === sib.id || (sibSpouse && p.parentId === sibSpouse.id)
    )
    for (const nc of sibKids) {
      if (nc.id === targetId) {
        const key = nc.gender === 'F' ? 'niece' : 'nephew'
        return { key, ...t[key] }
      }
    }
  }

  // Cousin — parent's sibling's child
  for (const par of focusParents) {
    for (const gp of parentPair(par.id, persons)) {
      const parSibs = persons.filter(p =>
        (p.parentId === gp.id || (gp.spouseId && p.parentId === gp.spouseId)) && p.id !== par.id
      )
      for (const ps of parSibs) {
        const psSpouse = ps.spouseId ? persons.find(p => p.id === ps.spouseId) : null
        const cousins = persons.filter(p =>
          p.parentId === ps.id || (psSpouse && p.parentId === psSpouse.id)
        )
        for (const co of cousins) {
          if (co.id === targetId) return { key: 'cousin', ...t.cousin }
        }
      }
    }
  }

  // Generic relative (connected but not classified above)
  const path = findPath(focusId, targetId, persons)
  if (path && path.length > 1) return { key: 'relative', ...t.relative }

  return null
}

export function getAllRelationships(focusId, persons, language = 'english') {
  return persons
    .filter(p => p.id !== focusId)
    .map(p => ({ person: p, rel: classifyRelationship(focusId, p.id, persons, language) }))
    .filter(x => x.rel !== null)
}
