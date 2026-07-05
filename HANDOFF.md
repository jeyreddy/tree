# Kula Vruksham — Handoff Note

**Date:** July 5, 2026
**Project owner:** Jagan Mohan Reddy (JY Reddy)
**GitHub:** https://github.com/jeyreddy/tree
**Local dev:** `C:\Tree` → `npm run dev` → http://localhost:5173
**Live:** Vercel, auto-deploys from `main` on every push
**Database:** Supabase (Postgres) — credentials in `.env`
**Current HEAD:** `db21993` (delete family from HomeScreen)

> Phase 0, 1, and 2 are COMPLETE. All 10 build tasks done. Ready for POC recruitment.

---

## Current state

All features for the POC are built and deployed:

### Schema (5 tables)
- **families** — id, name, historian, historian_name, language, created_at
- **persons** — core fields + photo_url, birth_family_unit_id (new), parent_id (deprecated), spouse_id (deprecated)
- **family_units** — the GEDCOM-style couple unit (partner_a_id, partner_b_id, marriage_year, status). Children point here via birth_family_unit_id. This is the source of truth for all relationships.
- **referrals** — KNA overlay (source_person_id, target_person_id, topic, note, added_by). 0 rows in production.
- **person_views** + **disputes** — trust engine
- **Supabase Storage** — photos bucket (public, 2MB, jpg/png/webp)

### Key architectural decision
**Projection layer:** `src/familyGraph.js` has `enrichPersons(persons, familyUnits)` which computes parentId, spouseId, parents[], fatherId, motherId, spouseIds[], children from family_units at load time. All 8 views consume the enriched array. No view touches family_units directly. All writes go through family_units. parent_id and spouse_id columns are retained but no longer written to.

### File structure (post all phases)
src/
├── App.jsx (~620 lines) — screens, state, handlers
├── db.js — all Supabase queries including familyUnit CRUD
├── familyGraph.js — enrichPersons() projection layer (NEW)
├── supabase.js — client config
├── OnboardingFlow.jsx — 3-screen new family flow
├── PersonForm.jsx — add/edit modal with photo upload
├── DetailPopup.jsx — right-click floating card + Add Father/Mother/Spouse/Child
├── ReferralSection.jsx — KNA referral add/list in DetailPopup
├── RelationshipPath.jsx — "How am I related?" result card
├── NetworkView.jsx — concentric rings graph + referral arrows + two-pick mode
├── SVGTree.jsx — ancestry card tree
├── ExplorerView.jsx — Obsidian-style outline + backlinks + drag-drop relink
├── TimelineView.jsx — auto-generated events timeline
├── MapView.jsx — Leaflet location clusters + migration lines
├── StatsTab.jsx — historian dashboard (gaps, referral stats, weekly pulse)
├── TrustIndicator.jsx — traffic-light trust badges
├── RelationshipEngine.js — kinship path + classification
├── style.css — global styles
scripts/
├── migrate-family-units.mjs — one-time migration (already run)

### Completed build tasks
| # | Task | Commit |
|---|------|--------|
| 0 | Family unit refactor (schema + migration + projection layer) | 5384ee3 |
| 1 | Schema: language, photo_url, topic columns | fefa729 |
| 2 | Split App.jsx (DetailPopup, db.js extracted) | (split) |
| 3 | Onboarding flow (3 screens + first couple) | 7916d5a |
| 4 | WhatsApp invite + deep link | f1ea601 |
| 5 | Photo upload + display (Supabase Storage) | cbc2e46 |
| 6 | Referrals KNA layer (add flow, graph arrows, explorer backlinks) | 0326b74 |
| 7 | "How am I related?" two-pick path | dd898be |
| 8 | Events timeline | 8278457 |
| 9 | Historian dashboard (gap nudges, referral stats, weekly pulse) | 4c66a66 |
| — | Phase 2 complete marker | a6ac64c |
| — | Delete family from HomeScreen | db21993 |

### Live data
- Yeturu family: 24 persons, 8 family_units, 0 referrals, 0 photos
- No other families in production

### Known issues (not blockers)
- DetailPopup can clip left edge on very narrow mobile screens (cosmetic, one-line clamp fix)
- HEIC photos from iPhones may not select in file picker (browsers usually convert, fix if reported)
- findPath caps at ~9 hops — returns null beyond that. Fine for POC-sized families.
- Completeness weekly delta is approximated, not a true point-in-time snapshot
- Explorer drag-drop relink was code-reviewed but not live-tested after family_units refactor — worth a manual check
- parent_id/spouse_id columns still exist (deprecated, not written to). Drop in a future commit.

### What's next (Phase 3 — conditional on POC data)
| # | Task | Condition |
|---|------|-----------|
| 10 | Cross-family clan matching + bridge | H1 holds (7/10 families reach 20 people) |
| 11 | Identity heatmap overlay | H5 holds (>60% fill rate on clan/native_place) |
| 12 | Graph metrics (density, cut points, referral in-degree) | H3 holds (30+ referrals) |

### POC recruitment plan
- Week 1: Seed 10 referrals in Yeturu family. Jagan adds manually.
- Week 2: Recruit 3 families via WhatsApp invite.
- Week 3-4: 3-5 more families.
- Week 5-6: Observe organic growth.
- Week 7-8: Pull metrics against hypothesis table. Build Phase 3 or write up failure.

### Reference documents (in project folder)
- kula_vruksham_poc_spec_v3.docx — full POC feature spec, all tasks marked DONE
- poc_spec_v3_addendum.docx — family_units refactor spec, marked DONE
- spectral_social_networks_paper.docx — the academic paper grounding the product

### How Jagan works
- Designs in Claude.ai chat (this is the anchor for context and product thinking)
- Executes via Claude Code in VS Code
- Prefers concise, actionable steps
- Git workflow: edit → npm run build (zero errors) → git add/commit/push → Vercel auto-deploys
