# Kula Vruksham — Handoff Note

**Date:** July 3, 2026
**Project owner:** Jagan Mohan Reddy (JY Reddy)
**GitHub:** https://github.com/jeyreddy/tree (use the **jeyreddy** account, NOT YJMREDDY — that's a separate project)
**Local dev:** `C:\Tree` → `npm run dev` → http://localhost:5173
**Live:** Vercel, auto-deploys from `main` on every push
**Database:** Supabase (Postgres) — credentials in `.env`
**Current HEAD:** `3f2d0f1` (Expand Explorer fully by default; dedupe married-in branches)

> This note supersedes the June 16 version. It was verified against the live database and current code on July 3, 2026. Read `CLAUDE.md` first — it is the source of truth for rendering rules and data invariants; this note is the orientation layer on top of it.

---

## What This Is

A multi-family Indian genealogy platform — Ancestry.com but built natively for Indian family structures (clans/intiperu, gotras, maiden names, cross-family marriages, joint-family complexity). Dogfooded on the **Yeturu family** (Jagan's own, ~23 people).

Decade-long product, not a POC. Grounded in the working paper *"Spectral Analysis of Multi-Dimensional Social Identity Networks"* (Reddy, 2026): every field on a person maps to a layer in a multi-layer identity graph, so the platform can eventually run spectral/community analysis on real family data. The concentric-rings UI, the referral ("who knows about X") layer, and the trust engine are all direct implementations of paper concepts.

## Tech Stack

```
Frontend:  React 18 + Vite 6
Database:  Supabase (Postgres, free tier), accessed via @supabase/supabase-js
Hosting:   Vercel (auto-deploy from GitHub main)
Auth:      NONE — open access, anyone with the URL can read/write (RLS allows public all)
IDE:       VS Code + Claude Code extension
```

## How to Run

```bash
cd C:\Tree
npm install          # first time only
npm run dev          # → http://localhost:5173
npm run build        # production build — MUST be zero-error before every commit
```

`.env` must contain `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (copy shape from `.env.example`). No other services needed to run locally — it talks directly to the shared Supabase project.

**Deploy:** just `git push` to `main`. Vercel builds and deploys automatically.

## Login / Auth Status

There is **no login**. Access is open by design (reduces friction for elderly family members; anyone with the URL can contribute). Attribution is handled by a lightweight "Who are you?" name prompt stored in `localStorage` (`kv-username`) — used to populate `added_by` / `last_edited_by`, not real auth.

A Supabase **magic-link login was built and parked** (reverted 2026-06-11). To restore it, see `.claude/commands/enable-login.md` (or run the `/enable-login` skill). Re-enable only once multi-family usage grows past a handful of families.

## File Structure (with current line counts)

```
C:\Tree/
├── CLAUDE.md              ← READ FIRST — rendering rules + data invariants (authoritative)
├── HANDOFF.md             ← this file
├── README.md              ← deploy instructions
├── supabase-schema.sql    ← base schema + migration comments (see schema-drift warning below)
├── .env / .env.example    ← Supabase credentials
└── src/
    ├── main.jsx           (11)   entry point
    ├── App.jsx            (932)  ⚠ over the 800-line guardrail — see below
    ├── supabase.js        (8)    client config
    ├── NetworkView.jsx    (646)  Graph view — concentric rings (DEFAULT view)
    ├── SVGTree.jsx        (472)  Tree view — ancestry-style card chart + shared tree helpers
    ├── ExplorerView.jsx   (314)  Explorer view — Obsidian-style outline + linked notes
    ├── MapView.jsx        (299)  Map view — Leaflet location clusters + migration lines
    ├── PersonForm.jsx     (216)  add/edit modal — 4 tabs (Basic/Identity/Work/Profiles)
    ├── StatsTab.jsx       (286)  completeness score, contributor leaderboard, branch coverage
    ├── TrustIndicator.jsx (163)  traffic-light trust badges + flag/dispute forms
    ├── RelationshipEngine.js (395) classifyRelationship + findPath (kinship term computation)
    ├── LocalGraph.jsx     (542)  PARKED — radial hop graph, not rendered
    └── style.css                 global styles + mobile breakpoints
```

### ⚠ App.jsx is over the size guardrail
CLAUDE.md mandates App.jsx stay under 800 lines; it is currently **932**. Next time it's touched substantially, extract components (the biggest candidates: `DetailPopup`, `AddReferralInline`, and the `db` object) into their own files. `SVGTree.jsx` exports `findRoots`, `getCoupleChildren`, and `getDisplayClan` for reuse — follow that pattern.

## Database Schema (verified against live DB, July 3, 2026)

### families
```
id              text PK
name            text
historian       text DEFAULT ''      username of family maintainer
historian_name  text DEFAULT ''      display name shown in header + leaderboard badge
created_at      timestamptz
```
> ⚠ **SCHEMA DRIFT — real latent bug.** The code reads `fam.language` and the header has a language dropdown that calls `db.updateFamily(id, { language })`, but the **`language` column does not exist on the live `families` table.** Reads silently fall back to `'english'`, but *changing* the language now throws a Postgres error — and since error-surfacing was added (commit `9239d2d`), that shows the user an alert. **Fix:** run `ALTER TABLE families ADD COLUMN language text DEFAULT 'english';` in the Supabase SQL Editor. (This is exactly the class of bug that bit us with `added_by` — the migration lives only as a comment in `supabase-schema.sql` and was never applied.)

### persons  (the core table — every person is one row)
```
id              text PK              slug-style, from name + timestamp
family_id       text FK → families
name            text
clan            text                BIRTH clan (intiperu) — NEVER changes on marriage
gender          text                'M' / 'F'
status          text                'alive' / 'deceased'
generation      integer             relative; auto-shifts when ancestors added above
parent_id       text                ONE parent (the blood parent in this family)
spouse_id       text                BIDIRECTIONAL (if A→B then B→A, always)
sort_order      integer             sibling ordering
location        text                current city
native_place    text                ancestral village
gotra           text                exogamy identifier (distinct from clan)
languages       text[]
occupation      jsonb               {role, company}
education        jsonb              [{institution, year, degree}]
profiles        jsonb               {linkedin, facebook, instagram, whatsapp}
phone           text
address         text
role            text                free-text family role
notes           text
verified        boolean
birth_year      integer
death_year      integer
added_by        text                who created the record
last_edited_by  text                who last modified it
created_at      timestamptz
updated_at      timestamptz
```

### referrals  (KNA / knowledge-network overlay — "ask X about Y")
```
id                text PK
family_id         text FK → families
source_person_id  text        who KNOWS (who to ask)
target_person_id  text        who they know ABOUT
note              text        what they know ("has old photos", "knows village history")
added_by          text
created_at        timestamptz
```
Reads as: "to find out about [target], ask [source]." Rendered as dashed blue arrows in Graph view and as a "Linked from" backlinks section in Explorer. Currently 0 rows in production.

### person_views  (trust engine — who has seen a record)
```
id          text PK
family_id   text FK → families
person_id   text
viewed_by   text          username of viewer
viewed_at   timestamptz
```

### disputes  (trust engine — flagged fields)
```
id, family_id, person_id, field_name, current_value, suggested_value,
reason, raised_by, status ('open'/'resolved'), resolved_by,
resolution_note, created_at, resolved_at
```

All tables have RLS enabled with public read/write policies. Full DDL + migration history is in `supabase-schema.sql`.

## Critical Data Rules (NEVER VIOLATE — full list in CLAUDE.md)

1. **`spouse_id` is bidirectional.** Set both sides, always.
2. **`clan` is the birth clan.** A married-in woman keeps her maiden clan (Sulochana stays "Veepuru" after marrying into Yeturu). Display bridges as "VEEPURU → YETURU".
3. **A married-in spouse has NO `parent_id` in this family** — their parent belongs in their own family's tree. (Violating this is what caused the July 2 corruption — a drag set Malachamma's parent_id to her own husband, creating an infinite render loop.)
4. **Children point to ONE parent** but appear under the couple (either parent's id matches).
5. **Deceased are full nodes** — never hidden. Shown with ✝, dashed border, strikethrough.
6. **Generation is relative** and auto-shifts when ancestors are added above gen 0.

## Key Features (current state)

### Four views, one shared data + edit pipeline
The tree tab toggles between four renderers of the same `persons` array. **All four write through the same handlers in App.jsx** (`openEdit`, `openAdd`, `deletePerson`, `toggleVerified`, `relinkPersons`) — there is exactly one save path; a 5th view would wire into the same set.

- **Graph** (default, `NetworkView.jsx`) — concentric rings around a focus person. Ring 1 = spouse/parents/children, Ring 2 = siblings/grandparents/grandchildren, Ring 3 = in-laws, Ring 4 = wider network. Left-click recenters; right-click opens DetailPopup; breadcrumb history; trust rings on nodes.
- **Tree** (`SVGTree.jsx`) — ancestry-style card chart, generations stacked top-to-bottom with connector lines. Drag cards to reposition (visual only). Restored from parked on 2026-07-02; in-law-overlap and cycle guards added.
- **Explorer** (`ExplorerView.jsx`) — Obsidian-style. Left pane = collapsible folder-tree (expands fully by default); right pane = a text "note" per person with properties, auto-tags (from clan/gotra/location/languages — click to filter), `[[wiki-links]]` to relatives, a **backlinks** section from the referrals table, and an inline **ADD FAMILY** action row. **Drag-and-drop relinking:** drag a person's row onto another — drop near the top links them as spouses, near the bottom makes the dragged person a child. Confirmed + cycle-guarded.
- **Map** (`MapView.jsx`) — Leaflet clusters by location, migration lines (parent→child across cities), spouse lines.

### DetailPopup (right-click, all views)
Person info + trust badges per field, spouse card, occupation, profiles, notes, verified state, referral section, attribution line, and the Add Father/Mother/Spouse/Son/Daughter + Edit/Delete/Force-Delete actions. Father/Mother buttons hide once a parent exists (adding a grandparent = open the parent's own record).

### Trust Engine
Auto-records a view when a record is opened; badges go gray → gold → green with witness count, red when disputed. Flag-a-field → suggest correction → historian resolves. Consensus-through-overlapping-witnesses, per the paper.

### Stats tab
Completeness score (0–100, color-coded), missing-data breakdown, contributor leaderboard (with Historian badge), per-clan branch coverage, recent activity, "Copy for WhatsApp" share text.

### Export
JSON backup download. (GEDCOM export is on the roadmap, not yet in the deployed app.)

## Recent Work (last 8 commits, newest first)

- `3f2d0f1` Explorer expands fully by default; dedupe married-in branches (Devi was rendering twice)
- `fe417f7` Fix drag-drop data corruption + add cycle guards to Explorer & Tree renderers
- `b05a2ae` Drag-and-drop relinking in Explorer; hide Father/Mother once a parent exists
- `eb0addf` Inline add/edit/delete actions in Explorer notes
- `11082af` Add Explorer view
- `75a629b` Fix in-law card overlap in Tree view
- `a10a2e3` Restore card-Tree view as 3rd toggle
- `9239d2d` **Surface Supabase errors instead of failing silently** (the `db` object now alerts on any failed write — this is why the missing `language` column now shows an error)

## Known Issues / Next Steps

1. **Apply the `families.language` migration** (see schema-drift warning above) — highest-value quick fix.
2. **Split App.jsx** — it's at 932 lines, over the 800 guardrail.
3. **Roadmap (unbuilt, priority order):** photos (biggest engagement driver) → events calendar (auto birthdays/anniversaries) → cross-family bridge detection → WhatsApp "how am I related" bot → wedding QR-code tree → auth (when multi-family grows) → GEDCOM export → mobile/PWA → spectral-analysis dashboard on real graph data.

## How Jagan Works

- Not a deeply technical developer — prefers concise, actionable steps over option-surveys.
- Designs/thinks in the Claude.ai chat (richer product context), executes via Claude Code in VS Code.
- Two GitHub accounts: **jeyreddy** (this project) and YJMREDDY (separate). Git config is per-folder to avoid mixups.
- Workflow: design in chat → prompt Claude Code → `npm run build` (zero errors) → test locally → `git add/commit/push` → Vercel auto-deploys.
- Values verification: changes are tested by actually running the app (Playwright drive scripts against `localhost:5173`) before shipping, and DB-mutating features are tested against real data with cleanup verified via direct Supabase queries.

## To Resume Work

1. Open VS Code at `C:\Tree`, `npm run dev`.
2. In Claude Code, first instruction: **"Read CLAUDE.md first."**
3. Describe the change → Claude Code edits → `npm run build` must pass → test locally → `git push` → Vercel deploys.
