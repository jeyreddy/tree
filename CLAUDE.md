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

## LANGUAGE LABELS
Relationship labels are configurable per family (stored in families.language column).
Available: English, Telugu, Hindi, Tamil, Kannada.
Default: English.
Never hardcode Telugu or any specific language — always read from the family's language setting.

## UI ARCHITECTURE
- Home screen: family selector (create / pick a family)
- Family screen: header + tabs (Tree, Export)
- Tree tab: LEFT = SVG card chart (60%), RIGHT = detail panel (40%)
- Detail panel shows: person info, spouse link, children list, action buttons (add father/mother/son/daughter/spouse)
- Action buttons set gender automatically — "Add Son" creates male, "Add Daughter" creates female

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
    ├── App.jsx (entire app — will be split later)
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

## Component map (all in App.jsx)

| Component / function | Purpose |
|----------------------|---------|
| `db` object | All Supabase queries |
| `App` | Root — screen state machine, shared state, business logic |
| `SVGTree` | SVG card chart with pan/zoom, Fit button, auto-center on select |
| `findRoots` | Root detection — excludes married-in spouses from root list |
| `getCoupleChildren` | Gets deduplicated children from both members of a couple |
| `layoutFamily` | Recursive bottom-up layout algorithm (no external libs) |
| `getClanColor` | Maps clan name → color from CLAN_COLORS palette |
| `HomeScreen` | Family list + create new family |
| `DetailPanel` | Right-panel — selected person details + action buttons |
| `PersonForm` | Add / edit person — 4-tab form (Basic, Identity, Work, Profiles) |
| `PersonToRow` / `RowToPerson` | Map between JS objects and DB rows |
| `makeId` | Slug-style ID generator from name + timestamp |

## Architecture — key decisions
- **Single-file app**: All screens, components, and DB helpers live in `src/App.jsx`. Intentional — splitting adds navigation overhead with no benefit at this size.
- **Screen state machine**: `screen` state drives top-level render (`loading` → `home` → `family`). No router.
- **No client-side caching**: Every navigation reloads from Supabase. Fine for small-data trees.
- **SVG layout**: Custom recursive bottom-up algorithm. No d3, no dagre. Constants: CARD_W=160, CARD_H=70, COUPLE_GAP=20, SIB_GAP=30, GEN_GAP=90.
- **Open access**: Supabase RLS policies allow public read/write. Anyone with the URL can contribute.

## Parked features

### Login (Supabase magic link)
- **Status**: Built and reverted on 2026-06-11. Re-enable after other features are stable.
- **How to restore**: See `.claude/commands/enable-login.md` for the exact code to add back.

## Code conventions
- No comments unless the WHY is non-obvious
- Inline styles throughout (no CSS modules, no Tailwind) — intentional for single-dev project
- `u(key)` helper in `PersonForm` for onChange handlers
- `moveSib` function exists for sibling reordering (not exposed in UI, available for future use)
