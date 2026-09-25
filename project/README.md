# RoadFix AI

**From Citizen Reports to Predictive Road Safety**

RoadFix AI is an AI-assisted civic road-safety platform: citizens report road problems with a photo and a pin, AI suggests what the issue is, duplicate reports are caught before they pile up, priority is scored transparently, authorities manage the incident through a full lifecycle, and citizens verify the repair with a before/after comparison. It also hands each report off to the real-world office that can act on it.

```
Report → Evidence → Verification → Action → Resolution → Community confirmation
```

## Demo mode vs. live mode

RoadFix runs in **two modes**, and always tells you which one is active (top-right badge):

| | **Demo mode** (default) | **Live mode** |
|---|---|---|
| Data | 64 seeded fictional incidents, stored in your browser (`localStorage`) | Real Supabase Postgres, shared by everyone |
| Accounts | No login — pick a persona (citizen / authority / admin) from the header | Real Supabase Auth accounts |
| AI analysis | Deterministic, pixel-statistics analyzer running in the browser — **not** a trained model, and always labelled "Demo analysis" | A Supabase Edge Function you configure with a real vision model |
| Photos | Small illustrated SVGs (not real photos) or your own upload kept as a data URL | Uploaded to Supabase Storage |
| Government routing links | Shown but disabled (fictional incidents shouldn't page a real office) | Live links, calls, and pre-filled complaint text |

The app **never fakes live data** and never claims a demo result is real — every AI or demo artifact carries a "Demo" badge.

To turn on live mode, set three env vars (see below) and the app switches automatically.

## Quick start

```bash
npm install
npm run dev       # demo mode, nothing else required
```

Open the printed local URL. You're signed in as a demo citizen by default; use the account menu (top right) to switch to "Authority officer" or "Admin" — this is how you get through the whole hackathon demo without setting up a database.

### Other scripts

```bash
npm run typecheck   # tsc --noEmit
npm run lint         # eslint
npm run build         # production build to dist/
npm run preview       # serve the production build locally
```

## Enabling live mode

1. Create a Supabase project.
2. Run the SQL migrations in `supabase/migrations/` (via `supabase db push` or the SQL editor) — `20260920120000_roadfix_ai_core.sql` creates the schema, row-level security policies, and all the state-changing RPCs (`rf_confirm`, `rf_set_status`, `rf_add_note`, `rf_add_external_ref`, `rf_admin_set_role`).
3. Deploy the Edge Function: `supabase functions deploy ai-vision`. It returns HTTP 501 with a clear message until you configure a model (step 4) — the app surfaces that message rather than pretending to analyze the photo.
4. To get real AI analysis, set `OPENAI_API_KEY` as a function secret (`supabase secrets set OPENAI_API_KEY=sk-...`) or edit `supabase/functions/ai-vision/index.ts` to call Gemini, a Hugging Face endpoint, or your own model service — the function's job is just to keep the key server-side and return the JSON shape documented in that file.
5. Set these in `.env` (or your deploy platform's env vars):
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=xxxx
   VITE_ROADFIX_MODE=live
   ```
   If `VITE_ROADFIX_MODE=live` is set but Supabase credentials are missing, the app falls back to demo mode and shows why in a banner on the sign-in page — it never crashes or silently pretends to be live.
6. The first person to sign up is a normal citizen. Grant authority/admin access by calling the `rf_admin_set_role` RPC as an existing admin, or directly in the `profiles` table for your first admin.

The **first Supabase migration** (`20260910...create_reports_and_upvotes.sql`) is from the project's original prototype and is left untouched; the core schema is entirely additive.

## Architecture

- **Frontend:** React 18 + TypeScript + Vite + Tailwind, React Router for navigation, Leaflet + OpenStreetMap tiles for maps (no Google Maps key needed).
- **AI abstraction** (`src/lib/ai/`): a single `AIProvider` interface with an `analyzeImage` and `compareResolution` method. `demoProvider.ts` implements it with real (but simple) pixel-level image statistics — no network call, no key. `edgeProvider.ts` implements it by calling the `ai-vision` Supabase Edge Function. Swapping models later means editing one function file, not the app.
- **Data abstraction** (`src/lib/data/`): a `DataService` interface with two implementations — `demoService.ts` (an in-memory + `localStorage` store with the exact same business rules as the backend) and `supabaseService.ts` (thin wrapper over Supabase tables and RPCs). The UI only ever imports `service`/`auth` from `src/lib/data`, and never touches Supabase or `localStorage` directly.
- **Priority scoring** (`src/lib/priority.ts`): explainable, rule-based. Every point on the 0–100 score has a labelled reason (severity, report count, days unresolved, proximity to a school/hospital, repeat-location history, a small per-category hazard bonus). No black box, no learned weights, and it explicitly does *not* score "road importance" because no reliable road-class data is available — that's stated in the UI rather than faked.
- **Duplicate detection** (`src/lib/duplicates.ts`): GPS proximity, category match, a real perceptual image hash (8×8 difference hash, computed via Canvas) for photo similarity, recency, and description overlap. Always shown as a *suggestion* the citizen accepts or dismisses — nothing is auto-merged.
- **Security model:** the demo service enforces roles in JS; the live service relies on Postgres Row Level Security plus `SECURITY DEFINER` RPC functions that check the caller's role and the allowed status transitions server-side, so hiding a button in the UI is never the only protection. Citizens can only insert their own reports in an initial state; all later state changes go through the RPCs.
- **Government routing** (`src/lib/authorities.ts`): see below.

## Government complaint routing — what's real, and what isn't

I looked for a public API to file a road-damage complaint directly with a government system (Bengaluru's BBMP/GBA, and the central **CPGRAMS** portal at pgportal.gov.in). **There isn't one available to third-party apps.** What exists instead:

- **CPGRAMS** is API-integrated with 17 states/UTs and 4 central ministries *at the government's own discretion* (per a 2026 Lok Sabha reply) — there's no public developer registration or open API for outside apps to submit grievances programmatically. It's also explicitly an *appeal/escalation* portal for grievances already raised with a department, not the first stop for a pothole.
- **BBMP / Greater Bengaluru Authority** (Bengaluru's civic body, reorganised in 2026) exposes citizen-facing channels — the `Sahaaya 2.0` app, an e-Helpline web form, a phone helpline, and (for potholes specifically) a dedicated "Fix Pothole" app — but no public submission API either.

So RoadFix does the honest, working version of this: a **routing/hand-off directory** (`src/lib/authorities.ts`), not a fake integration.

**What it does:**
- Matches the report's pin against a small directory of authorities by rough jurisdiction bounding box and issue category (road/traffic problems → BBMP/GBA or Bengaluru Traffic Police; anything → CPGRAMS as a listed escalation option).
- Shows every real channel for that office — web complaint form, phone number, official app, or an X (Twitter) handle some traffic units use for public escalation — and opens it with one tap (`tel:`, a pre-filled X post, or the web form), never a background "silent submit."
- Lets the citizen paste back the reference/ticket number they got from that real office, so the RoadFix record and the government ticket stay linked (`external_refs` — a JSON list on `issues`, and its own `rf_add_external_ref` RPC in live mode so only the reporter, a supporter, or staff can attach one).
- In demo mode, the same panel renders but every link is disabled with a "would open: ..." preview, since demo incidents are fictional and must never actually page a real office or phone line.
- Every entry in the directory records **where the number/link came from** (`confidence: 'official' | 'secondary'`, plus a `source` string and a `checkedOn` date), because these numbers and apps do change — Bengaluru's own civic body was renamed mid-2026. The directory is one file (`src/lib/authorities.ts`) so adding a city or updating a stale number is a small, obvious edit, not a schema migration.

**What I'd suggest if you want to go further after the hackathon:**
1. **CPGRAMS integration is the most credible next step**, but it requires being formally onboarded as an integrating department/portal by DARPG — that's a government relationship, not something to fake in a demo. Worth mentioning in your pitch as the roadmap, not building against blind.
2. A **WhatsApp Business API bot** pointed at BBMP's public WhatsApp number is the closest thing to a real automated hand-off available today, and is scriptable without a formal integration — a good "Phase 2" feature.
3. Keep the directory-based approach for any *other* city: it degrades gracefully (worst case, a Google-search link to "find your municipal corporation") instead of a route that just doesn't work outside one metro area.

## Key features and where to find them

| Feature | File(s) |
|---|---|
| Landing page, "How it works", impact stats | `src/pages/PublicPages.tsx` |
| 4-step report flow (evidence → location → AI analysis → review) | `src/pages/ReportPage.tsx` |
| AI road-damage detection abstraction | `src/lib/ai/` |
| AI-generated grievance draft (3 tones, fully editable) | `src/lib/grievance.ts` |
| Duplicate detection + "support existing report" | `src/lib/duplicates.ts`, inside `ReportPage.tsx` |
| Explainable priority score | `src/lib/priority.ts`, `src/components/WhyPriority.tsx` |
| Sensitive-location detection (school/hospital/transit) | `src/lib/facilities.ts` (OSM Overpass in live mode, fictional set in demo mode) |
| Interactive road-safety map with legend and filters | `src/pages/MapPage.tsx`, `src/components/IncidentMap.tsx` |
| Road segment health | `src/lib/segments.ts` |
| Authority command center, incidents table, queue, assignments | `src/pages/AuthorityPages.tsx` |
| Resolution verification (before/after AI comparison) | `src/components/ResolutionPanel.tsx` |
| Government office hand-off | `src/lib/authorities.ts`, `src/components/RouteToAuthority.tsx` |
| RoadFix Scan (video → frames → per-frame AI flags) | `src/lib/scan.ts`, `src/pages/ScanPage.tsx` |
| Weather + rain risk | `src/lib/weather.ts` (Open-Meteo, no key needed) |
| Experimental road risk forecast | `src/lib/forecast.ts` — explicitly labelled "Experimental risk estimate" everywhere it appears |
| Gamification (badges, anti-spam) | `src/lib/badges.ts`, `src/components/Contribution.tsx` |
| Role-based access | `src/components/Guards.tsx` (UI) + Postgres RLS/RPCs (real enforcement) |
| Voice dictation (10 Indian languages) | `src/lib/voice.ts` |

## Demo mode presentation flow (~3–5 minutes)

1. Landing page → **Report a Road Issue**.
2. Step 1: **Use sample road photo** (demo shortcut button).
3. Step 2: location auto-fills to a fictional Demo Ring Road pin.
4. Step 3: AI detects a possible pothole, high severity — and immediately surfaces **RF-1024**, an existing demo incident with 23 supporters, as a likely duplicate. Click **Support existing report**.
5. On RF-1024: **Why? Priority: HIGH** lists its reasons (severity, report count, near-school, days unresolved) — and a **Send to the responsible office** panel shows which real Bengaluru offices this would go to.
6. Open the road safety map — RF-1024 shows red.
7. Switch persona to **Authority officer** (account menu) → Command center → priority queue shows RF-1024 at the top.
8. Open RF-1024 → Assign → Mark work started → Mark resolved.
9. Switch back to **Citizen** → Notifications shows "Please verify the repair."
10. Open RF-1024 → **Use sample repaired photo** → Compare before and after → Confirm fixed → status becomes "Citizen verified."
11. Visit **Community impact** for the closing numbers.

## Known limits (stated deliberately, not hidden)

- Demo AI is pixel statistics, not a trained road-damage model — labelled everywhere.
- The risk forecast is a transparent heuristic over past incidents, not a predictive model — labelled "Experimental" everywhere it appears.
- Government routing is a hand-off directory to real public channels, not a submission API — no such public API exists today (see above).
- Nearby-facility data in live mode depends on OpenStreetMap coverage; where it's unreliable the UI says "Nearby facility information unavailable" rather than guessing.
