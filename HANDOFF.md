# Kula Vruksham — Handoff Note

**Date:** June 16, 2026
**Project owner:** Jagan Mohan Reddy (JY Reddy)
**GitHub:** https://github.com/jeyreddy/tree
**Local dev:** C:\Tree → `npm run dev` → http://localhost:5173
**Live:** Deployed on Vercel (auto-deploys from main branch)
**Database:** Supabase (Postgres) — credentials in `.env`
**GitHub account for this project:** jeyreddy (NOT YJMREDDY — that's a separate project)

---

## What This Is

A multi-family Indian genealogy platform — think Ancestry.com but built natively for Indian family structures (clans/intiperu, gotras, maiden names, cross-family marriages, joint family complexity). Currently being dogfooded with the Yeturu family as the initial dataset.

This is a decade-long product, not a proof of concept. The goal is to become the family network platform for Indian families — starting with genealogy, expanding to a social identity graph.

## The Research Foundation

The product is grounded in a working paper: "Spectral Analysis of Multi-Dimensional Social Identity Networks" (Reddy, 2026). The paper models Indian society as a multi-layer graph where each person sits at the intersection of overlapping identity circles (jaati, region, language, profession, kinship). Each layer oscillates at a characteristic frequency — caste/gotra is near-DC (centuries-stable), profession changes yearly, technology adoption changes monthly.

The data model was designed so every field on a person node maps directly to a layer in the multi-layer graph Laplacian from the paper. This isn't academic decoration — it means the platform can eventually compute eigenvalues, Fiedler values, and community detection on real family data.

Key paper concepts implemented in the product:
- **Multi-layer identity:** clan, gotra, languages, location, profession, profiles = separate analyzable layers
- **Concentric identity circles:** the graph UI literally shows rings around a focus person (Ring 1 = immediate family, Ring 2 = extended, Ring 3 = in-laws, Ring 4 = wider network)
- **Proxy nodes:** the WhatsApp pipeline concept addresses digitally invisible elders
- **Broker nodes / KNA:** the referral system ("ask X about Y") is the knowledge network from the paper
- **Trust as neural computation:** the trust engine implements consensus verification through overlapping witnesses

## Tech Stack

```
Frontend:  React + Vite
Database:  Supabase (Postgres, free tier)
Hosting:   Vercel (auto-deploy from GitHub)
Auth:      None currently — open access, anyone with URL can contribute
Git:       github.com/jeyreddy/tree (use jeyreddy account, NOT YJMREDDY)
IDE:       VS Code with Claude Code extension
```

## File Structure

```
C:\Tree/
├── index.html
├── package.json
├── vite.config.js
├── supabase-schema.sql      ← full schema + migration comments
├── .env                     ← VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
├── .gitignore
├── CLAUDE.md                ← Claude Code memory file (READ THIS FIRST)
├── README.md                ← deploy instructions
└── src/
    ├── main.jsx             ← entry point
    ├── App.jsx              ← ~310 lines, main app shell, routing, db helpers
    ├── NetworkView.jsx      ← concentric rings graph (Obsidian-style local graph)
    ├── MapView.jsx          ← Leaflet map with location clusters
    ├── PersonForm.jsx       ← responsive tabbed form (Basic/Identity/Work/Profiles)
    ├── TrustIndicator.jsx   ← traffic light badge component
    ├── SVGTree.jsx          ← card-based chart view (backup, may not be active)
    ├── supabase.js          ← client config
    └── style.css            ← global styles + mobile breakpoints
```

## Database Schema (Supabase)

### families table
```
id              text PK
name            text
language        text DEFAULT 'english'    ← for relationship labels (Telugu/Hindi/Tamil/Kannada/English)
historian       text DEFAULT ''           ← username of family maintainer
historian_name  text DEFAULT ''
created_at      timestamptz
```

### persons table
```
id              text PK
family_id       text FK → families
name            text
clan            text         ← intiperu/family name (BIRTH clan, never changes on marriage)
gender          text (M/F)
status          text (alive/deceased)
generation      integer      ← relative, auto-shifts when ancestors added
parent_id       text         ← points to ONE parent (blood parent in this family)
spouse_id       text         ← bidirectional (if A→B then B→A)
sort_order      integer      ← sibling ordering
location        text         ← current city
native_place    text         ← ancestral village
gotra           text         ← exogamy identifier (distinct from clan)
languages       text[]       ← array
occupation      jsonb        ← {role, company}
education       jsonb        ← [{institution, year, degree}]
profiles        jsonb        ← {linkedin, facebook, instagram, whatsapp}
phone           text
address         text
role            text         ← family role description
notes           text
verified        boolean
birth_year      integer
death_year      integer
added_by        text         ← who created this record
last_edited_by  text         ← who last modified
created_at      timestamptz
updated_at      timestamptz
```

### referrals table (knowledge network overlay)
```
id                  text PK
family_id           text FK → families
source_person_id    text     ← who KNOWS (who to ask)
target_person_id    text     ← who they know ABOUT
note                text     ← what they know ("has photos", "knows village history")
added_by            text
created_at          timestamptz
```

### person_views table (trust engine)
```
id          text PK
family_id   text FK → families
person_id   text
viewed_by   text     ← username of viewer
viewed_at   timestamptz
```

### disputes table (trust engine)
```
id              text PK
family_id       text FK → families
person_id       text
field_name      text     ← which field is disputed
current_value   text
suggested_value text
reason          text
raised_by       text
status          text (open/resolved)
resolved_by     text
resolution_note text
created_at      timestamptz
resolved_at     timestamptz
```

## Critical Data Rules (NEVER VIOLATE)

1. **Spouse links are bidirectional.** If A.spouse_id = B, then B.spouse_id = A. Always.
2. **Clan is birth clan.** A married woman keeps her maiden clan. Sulochana's clan = "Veepuru" even after marrying Srinivasulu (Yeturu). Display as "VEEPURU → YETURU" on cards.
3. **Children inherit father's clan.** When adding a child from mother's card, default clan = father's clan, parent_id = father's id.
4. **Every person is a full node.** No text-only spouses. Married-in people are complete records.
5. **Deceased are full nodes.** Never hide or skip them. Show with ✝, dashed borders, strikethrough.
6. **Generation is relative.** Auto-shifts when ancestors are added above gen 0.

## Features Built

### Graph View (default) — Concentric Rings
- Focus person at center, family radiates outward in 4 rings
- Ring 1: spouse, parents, children
- Ring 2: siblings, grandparents, grandchildren, children's spouses
- Ring 3: in-law family (spouse's parents/siblings)
- Ring 4: wider connected network
- Left-click node = navigate (recenter on that person)
- Right-click node = detail popup
- Drag nodes to reposition (visual only, no data change)
- Pan + zoom
- Breadcrumb trail for navigation history
- Trust rings on nodes (green = trusted, red pulsing = disputed)

### Map View
- Leaflet/OpenStreetMap
- Location clusters with family members
- Migration lines (parent → child at different locations)
- Spouse lines across cities
- Click cluster popup → see members → right-click for detail

### Detail Popup (right-click)
- Floating card near click position
- Shows: name, clan, location, status, generation, age, spouse link, occupation, profiles, notes
- Trust indicators (traffic light badges) on each field
- Trust summary: viewer count, open disputes, resolved disputes
- "Flag it" inline form for raising disputes
- Action buttons: Add Father/Mother/Son/Daughter/Spouse, Edit, Delete
- Attribution line: "Added by X, Edited by Y"

### Person Form (modal)
- 4 tabs: Basic, Identity, Work, Profiles
- Responsive (flex-wrap, works on mobile)
- Birth year + death year + auto-calculated age
- Gender auto-set by button (Add Son = male, Add Daughter = female)
- Sticky Save/Cancel buttons

### Trust Engine
- Auto-records views when someone opens a person's detail
- Trust badges: gray (unseen) → gold (1-2 viewers) → green (3+ viewers) → red (disputed)
- Dispute flow: flag a field → suggest correction → historian resolves
- Visual: pulsing red rings on disputed graph nodes, green rings on trusted ones

### Stats Dashboard
- Completeness score (0-100%) with color-coded progress bar
- Missing data breakdown (location, birth year, phone, etc.)
- Contributor leaderboard with gold/silver/bronze ranks
- Historian badge
- Branch coverage per clan
- Recent activity feed
- Data trust overview (trusted/seen/disputed counts)
- "Copy for WhatsApp" button with formatted share text

### Knowledge Referrals
- "Ask X about Y" — informal referral network
- Stored in referrals table
- Shown in detail popup under "Who knows about [person]?"
- Rendered as blue dashed edges in graph view

### Export
- JSON backup download (full fidelity)
- GEDCOM export was in the artifact version, may need to be re-added to deployed version

### Multi-Family
- Home screen: create or select a family
- Each family has isolated data (namespaced by family_id)
- Language selector per family (English/Telugu/Hindi/Tamil/Kannada)
- Cross-family links planned but not yet implemented

## Key Design Decisions Made

1. **Right-click popup instead of permanent side panel** — graph gets 100% width, detail appears on demand
2. **Concentric rings instead of flat tree** — scales to any family size, implements the spectral paper's identity circles
3. **No auth** — deliberate for now. Reduces friction for family members. Will need Google/phone OTP at 10+ families
4. **Every spouse is a node** — rejected the text-label approach early. Essential for showing cross-family marriages
5. **Maiden name always visible** — "PALLAMREDDY → YETURU" format shows marriage bridges at a glance
6. **CLAUDE.md as memory** — Claude Code reads this at the start of every session for full context
7. **Trust through structure, not blockchain** — overlapping witnesses + structural constraints make false data unstable

## The Yeturu Family (Test Data)

Jagan's family — the dogfooding dataset:
- Root: Srinivasulu Reddy (Yeturu) ♥ Sulochana (Veepuru)
- Jagan's generation: Jagan ♥ Swarnalatha (Pallamreddy), Kiran ♥ Devi (Chintakindi), Gayathri ✝ (Yeturu) ♥ Venkateswarlu (Allareddy)
- In-law parents: Balarami Reddy (Pallamreddy) — Swarnalatha's father, Gopal Reddy (Chintakindi) — Devi's father
- Gen 3: Sai Pranav, Krishna Kaushal, Prahas (Yeturu), Vijay Bharat, Anivarth (Allareddy)
- Gayathri (Jagan's sister) is deceased — this was a key reason full spouse nodes were needed
- ~19 members currently entered

## What's NOT Built Yet (Priority Order)

1. **Photos** — profile photos + old family photos tagged to people. Biggest engagement driver.
2. **Events calendar** — auto-generate birthdays, anniversaries, death anniversaries from existing data
3. **Cross-family bridge detection** — auto-link when two families share a marriage
4. **WhatsApp bot** — "send a name, get back how you're related"
5. **Wedding QR code** — printable family tree for weddings (growth mechanic)
6. **Auth** — Google/phone OTP when multi-family usage grows
7. **GEDCOM export** — was in the artifact, needs to be re-added to the deployed app
8. **Mobile optimization** — PWA or React Native
9. **Spectral analysis dashboard** — compute eigenvalues on the actual family graph data

## How Jagan Works

- NOT a deeply technical developer — prefers concise, actionable instructions
- Uses THIS Claude.ai chat for design thinking and prompt writing (richer context)
- Pastes prompts into Claude Code in VS Code for code execution
- Two GitHub accounts: jeyreddy (this project), YJMREDDY (separate project, separate VS Code instance)
- Git config per project folder to avoid account confusion
- Workflow: design in chat → prompt for Claude Code → test locally → git push → Vercel auto-deploys

## PRD Location

A full PRD exists: was generated as `kula_vruksham_prd.md` during this session. It covers:
- Problem statement, competitive landscape
- Data model design rationale
- Feature roadmap (4 phases over 24+ months)
- Technical architecture (current + target)
- Revenue model
- Privacy & ethics considerations
- Connection to spectral analysis paper
- Dogfooding log

## Files Generated This Session

- `kulavruksham_prd.md` — grand PRD
- `kulavruksham.jsx` — artifact versions (deprecated, superseded by deployed app)
- `kulavruksham-project.tar.gz` — initial project scaffold
- `App.jsx` — multiple iterations

## To Resume Work

1. Open VS Code at C:\Tree
2. `npm run dev` → http://localhost:5173
3. Open Claude Code in VS Code
4. First instruction to Claude Code: "Read CLAUDE.md first"
5. Describe what you want → Claude Code edits files
6. Test locally → `git add . && git commit -m "description" && git push`
7. Vercel auto-deploys

For design thinking and complex prompts, use Claude.ai (this chat has the full product context). For code execution, use Claude Code (it has CLAUDE.md for project context).
