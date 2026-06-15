# KULA VRUKSHAM — Project Context

## What this is
A multi-family Indian genealogy platform. Ancestry.com-style visual family tree with Indian family structure support (clans, gotras, maiden names, cross-family marriages). Built for Indian families who lose generational knowledge when elders pass away.

## Tech stack
- Frontend: React + Vite (src/App.jsx is the main file)
- Database: Supabase (Postgres) — see supabase-schema.sql
- Hosting: Vercel (auto-deploys from GitHub on push)
- No auth — open access, anyone with URL can contribute

## Data model (Supabase `persons` table)
Every person is a row. Key fields:
- `id` (text PK), `family_id` (FK to families), `name`, `clan` (intiperu/family name)
- `gender` (M/F), `status` (alive/deceased), `generation` (integer, 0 = root gen)
- `parent_id` (points to ONE parent — the blood parent in this family)
- `spouse_id` (bidirectional — if A.spouse_id = B, then B.spouse_id = A)
- `sort_order` (sibling ordering)
- `location`, `native_place`, `gotra`, `languages` (text[])
- `occupation` (jsonb: {role, company}), `education` (jsonb array)
- `profiles` (jsonb: {linkedin, facebook, instagram, whatsapp})
- `phone`, `address`, `role` (family role text), `notes`, `verified` (boolean)
- `added_by`, `last_edited_by` (text — set from the username prompt on save)

## Data model (Supabase `referrals` table)
The KNA (Knowledge Network Analysis) layer from the spectral paper — an informal knowledge flow network overlaid on the kinship graph. "Ask Kiran about Gopal's village history" or "Swarnalatha has old photos of Balarami Reddy."

- `id` (text PK), `family_id` (FK to families)
- `source_person_id` — who KNOWS (who to contact)
- `target_person_id` — who they know ABOUT
- `note` — what they know ("has old photos", "knows village history", "has phone number")
- `added_by` — username of whoever created this referral
- `created_at` (timestamp)

A referral reads as: "To find out about [target], ask [source]."
Referrals are crowd-sourced and informal — family members add them as they discover who knows what.
In LocalGraph, referral edges render as thin dashed blue arrows pointing from source → target.

## CRITICAL DATA RULES — NEVER VIOLATE
1. A married-in spouse (e.g. wife who married into this family) has NO parentId in this family — her parentId belongs in HER family's tree
2. spouse_id is ALWAYS bidirectional. If you set A.spouse_id = B, you MUST also set B.spouse_id = A
3. Children point to ONE parent via parent_id (typically the blood-family parent). Children should appear under the COUPLE (both parent and their spouse), not just one parent
4. Deceased persons are full nodes — never hide or skip them
5. `clan` on a person is their BIRTH clan (maiden name). It does NOT change when they marry. Sulochana's clan stays "Gandavarapu" even after marrying Srinivasulu Reddy (Yeturu)

## TREE RENDERING RULES — THE MOST IMPORTANT SECTION
The tree is the core UI. These rules are non-negotiable:

### Root detection
A root is a person who:
- Has no parent_id, AND
- Is NOT solely a married-in spouse (i.e., they are not someone whose only role is being another person's spouse without their own parent_id in this family)

To find true roots:
1. Get all persons with no parent_id
2. Among those, if person A has spouse_id = B, and B HAS a parent_id, then A is a married-in spouse — NOT a root. A appears inline with B.
3. If BOTH A and B have no parent_id and are spouses, pick ONE as root (the male, or the one added first). The other is inline.
4. Single persons with no parent_id and no spouse whose parent is in the tree = root

### Couple rendering
- A couple is ONE visual unit: two cards side by side with ♥ connector
- The card with parent_id is the PRIMARY card (positioned by the layout algorithm)
- The spouse card sits to the right of the primary
- If no primary (both are roots), male goes left

### Child rendering
- Children of a couple = all persons whose parent_id matches EITHER the primary person OR their spouse
- DEDUPLICATE: a child appears exactly ONCE, under the couple
- Sort by sort_order

### Generation alignment
- All couples/persons in the same generation sit on the same horizontal row
- generation 0 = top row, generation 1 = next row down, etc.

### Connector lines
- Vertical line from bottom-center of couple → drops down
- Horizontal line spans from first child to last child
- Vertical line from horizontal → top-center of each child card
- Lines are straight, not curved. Color: #ccc, width: 1.5px

### Card design
- 160x70px, rounded corners, white bg (living) or #f5f5f5 (deceased)
- Left edge: 4px bar colored by clan
- Line 1: NAME (bold), ✝ prefix if deceased
- Line 2: Clan name (colored)
- Line 3: Location (gray, small)
- Deceased: dashed border, strikethrough name
- Selected: blue border/glow

## CONCENTRIC RINGS RENDERING (NetworkView)

The active graph view. Selected person sits at center; family radiates outward by social distance.

### Ring assignments
- **Ring 0** (center): the focus person
- **Ring 1** (r=130): spouse, parents, children
- **Ring 2** (r=260): siblings + their spouses/children, grandparents, grandchildren, children's spouses
- **Ring 3** (r=380): in-law parents, spouse's siblings, children's in-law parents
- **Ring 4** (r=490): everyone else in the family data

### Node sizing by ring
- Ring 0: r=30, Ring 1 parents: r=24, Ring 1 spouse: r=26, Ring 1 children: r=22
- Ring 2: r=18, Ring 3: r=15, Ring 4: r=12

### Navigation
- Left-click any node → that person becomes the new Ring 0 focus (rings re-computed)
- Breadcrumb trail (top-left overlay) shows navigation history; click any crumb to go back
- External `sel` change (from search results) also moves focus

### Visual conventions
- Deceased: transparent fill, dashed stroke, × mark
- Female: inner circle indicator
- Unverified: yellow dot at top-right of node
- Focus: pulsing outer glow ring (SMIL animate)
- Ring boundaries: dashed circles with label at top-right arc

## LANGUAGE LABELS
Relationship labels are configurable per family (stored in families.language column).
Available: English, Telugu, Hindi, Tamil, Kannada.
Default: English.
Never hardcode Telugu or any specific language — always read from the family's language setting.

## UI ARCHITECTURE
- Home screen: family selector (create / pick a family)
- Family screen: header (with username display) + tabs (Tree, Export)
- Tree tab: floating search bar + Graph/Map toggle; defaults to `NetworkView` (concentric rings)
- Left-click a node → re-centers the rings around that person (navigateTo)
- Right-click a node → `DetailPopup` floating card appears near the cursor
- DetailPopup shows: person info, spouse card, occupation, profiles, notes, verified badge, add-family buttons, referral section ("WHO KNOWS ABOUT X?"), attribution line
- Action buttons in popup set gender automatically — Father/Mother/Son/Daughter/Spouse
- `PersonForm` (add/edit) opens as a centered modal overlay (`position: fixed, inset: 0, zIndex 200`)
- Username prompt bar shows at the top of the family screen until user sets their name (stored in localStorage)

## FILE STRUCTURE
```
C:\Tree
├── index.html
├── package.json
├── vite.config.js
├── supabase-schema.sql
├── .env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
├── CLAUDE.md (this file — read every time)
└── src/
    ├── main.jsx (entry point)
    ├── App.jsx (screens, state, db helpers, PersonForm, DetailPopup, AddReferralInline)
    ├── NetworkView.jsx (concentric rings view — active Graph view)
    ├── LocalGraph.jsx (radial hop graph — parked, not rendered)
    ├── SVGTree.jsx (SVG card tree — exports getDisplayClan; SVGTree itself is parked)
    ├── style.css (global styles)
    └── supabase.js (client config)
```

## GUARDRAILS — CHECK BEFORE EVERY CHANGE
1. Run `npm run build` after every change — must have zero errors
2. Never remove existing features while adding new ones
3. Never change Supabase schema without also providing ALTER TABLE SQL
4. Never hardcode family-specific data (no "Yeturu" references in code)
5. Always test: create a family, add a person, add spouse, add child, add parent above — all 4 flows must work after any change
6. Keep App.jsx under 800 lines — if it grows beyond, split into components in separate files
7. The detail panel and action buttons must ALWAYS work — they're how users add data

## ORIGIN
Based on the paper "Spectral Analysis of Multi-Dimensional Social Identity Networks" (Reddy, 2026). The data model is designed so each field maps to an identity layer for future graph analysis. This is a decade-long project, not a POC.

## GIT WORKFLOW
After every successful change:
```
git add .
git commit -m "description of change"
git push
```
Vercel auto-deploys from main branch.

## Component map

### src/App.jsx
| Component / function | Purpose |
|----------------------|---------|
| `db` object | All Supabase queries — persons, families, referrals |
| `App` | Root — screen state machine, shared state, business logic |
| `HomeScreen` | Family list + create new family |
| `DetailPopup` | Right-click floating card — person info, referrals, action buttons |
| `AddReferralInline` | Inline form inside DetailPopup to add a knowledge referral |
| `PersonForm` | Add / edit person — 4-tab form (Basic, Identity, Work, Profiles) |
| `PersonToRow` / `RowToPerson` | Map between JS objects and DB rows |
| `makeId` | Slug-style ID generator from name + timestamp |

### src/NetworkView.jsx (active Graph view — concentric rings)
| Component / function | Purpose |
|----------------------|---------|
| `NetworkView` | Concentric rings centered on selected person; click navigates focus |
| `assignRings` | Classifies every person into rings 0–4 based on social distance from focus |
| `positionNodes` | Places ring-0 at center, ring-1 structured (parents top/spouse right/children bottom), rings 2–4 anchored near closest inner-ring relative |
| `getClanColor` | Maps clan → CLAN_COLORS palette (same palette as MapView) |
| `hash01` | Deterministic pseudo-random 0–1 for stable layout without Math.random() |

### src/LocalGraph.jsx (parked — radial hop graph)
| Component / function | Purpose |
|----------------------|---------|
| `LocalGraph` | N-hop BFS radial graph around focus node (not rendered; available to restore) |

### src/SVGTree.jsx (parked — exports getDisplayClan)
| Export | Purpose |
|--------|---------|
| `getDisplayClan` | Used in App.jsx for clan display logic |
| `SVGTree` | Full SVG card tree — not currently rendered, available for restoration |

## Architecture — key decisions
- **File split**: App.jsx holds state/logic/forms; NetworkView.jsx holds the active graph; MapView.jsx holds the map. LocalGraph.jsx and SVGTree.jsx are parked.
- **Screen state machine**: `screen` state drives top-level render (`loading` → `home` → `family`). No router.
- **No client-side caching**: Every navigation reloads from Supabase. Fine for small-data trees.
- **NetworkView layout**: Concentric rings, deterministic (no force simulation). Ring radii: 0=center, 130, 260, 380, 490. Focus person at center; rings computed fresh on each focusId change.
- **Two graph layers**: kinship edges (parent/spouse) are permanent structure; referral edges (dashed blue arrows) are the KNA overlay. Both rendered in NetworkView and LocalGraph.
- **View toggle**: `view` state in App ('graph' | 'map'). Graph = NetworkView, Map = MapView. Both share the same floating search bar and DetailPopup.
- **Open access**: Supabase RLS policies allow public read/write. Anyone with the URL can contribute.

## Parked features

### Login (Supabase magic link)
- **Status**: Built and reverted on 2026-06-11. Re-enable after other features are stable.
- **How to restore**: See `.claude/commands/enable-login.md` for the exact code to add back.

### LocalGraph (radial hop graph)
- **Status**: Replaced by NetworkView (concentric rings) on 2026-06-15. File preserved at src/LocalGraph.jsx.
- **How to restore**: In App.jsx, import `{ LocalGraph }` and swap NetworkView for LocalGraph in the tree tab. Pass `clans`, `REL`, `referrals`, `onContextMenu` props.

## Code conventions
- No comments unless the WHY is non-obvious
- Inline styles throughout (no CSS modules, no Tailwind) — intentional for single-dev project
- `u(key)` helper in `PersonForm` for onChange handlers
- `moveSib` function exists for sibling reordering (not exposed in UI, available for future use)
