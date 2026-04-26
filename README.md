# ⚖️ POPPER-PROOF COURT

> *"Where every scientific hypothesis goes on trial — and only the bulletproof get funded."*

**Hack-Nation 5th Global AI Hackathon — Challenge 04: The AI Scientist (Powered by Fulcrum Science)**

POPPER-PROOF COURT is a multi-agent **Science Research Court** that takes a scientific question, puts it on trial through a 7-turn courtroom protocol (Prosecutor vs. Defender vs. Judge), checks for prior art ("stare decisis"), and produces a fully operational, procurement-ready experiment plan that a real lab could pick up Monday and start running by Friday.

---

## 🎯 Mission

POPPER-PROOF COURT puts every scientific hypothesis on trial — so labs ship the right experiments in hours, not weeks, and never burn $50K chasing a question that couldn't survive cross-examination.

---

## 🧠 Core Concept

| Stage | Court Metaphor | What Happens |
|---|---|---|
| **0. Brief Drafting** | Counsel Chambers | Chat with AI to sharpen your hypothesis before trial |
| **1. Pretrial Discovery** | Stare Decisis Search | Tavily + Semantic Scholar check for prior art / precedent |
| **2. The Trial** | Live Courtroom | 3 agents argue in 7 turns (Prosecutor / Defender / Judge) |
| **3. The Verdict** | Operational Plan | Protocol + Materials + Budget + Timeline + Validation |
| **4. Appellate Court** | Feedback Loop | Scientist corrections retrain future verdicts (stretch) |

---

## 🏆 Why We Win (Past Hack-Nation Winner DNA)

| Past Winner | Pattern Inherited |
|---|---|
| **SPINE** (4th, 1st OpenAI track) | Knowledge graph reasoning over precedent papers |
| **Jarvis / CortexOne** (4th, 3rd OpenAI) | Contradiction detection + provenance trails |
| **AgentOps Replay** (3rd, 2nd VC Big Bets) | Replayable multi-agent timeline ("Court Transcript") |
| **OmniCall AI** (4th, 3rd ElevenLabs) | Live voice-on-stage demo (3 distinct courtroom voices) |
| **Sonara** (3rd, 3rd SAP) | Evidence-backed confidence scores in every verdict |

---

## ⚙️ Tech Stack

### Frontend
- **Next.js 15** (App Router) + **TypeScript**
- **Tailwind CSS** + **shadcn/ui** (Radix primitives)
- **Framer Motion** (courtroom animations)
- **EventSource** (SSE for live agent streaming)

### Backend
- **Python 3.11** + **FastAPI**
- **LangGraph** (7-turn court state machine)
- **sse-starlette** (Server-Sent Events)
- **Pydantic** (typed schemas)
- **httpx** (async API calls)

### LLM Providers (multi-model = visible "personalities")
| Role | Model | Why |
|---|---|---|
| **Judge** | OpenAI `o3` | Deep reasoning for verdict synthesis |
| **Prosecutor** | Anthropic `claude-sonnet-4-5` | Best adversarial / devil's-advocate reasoning |
| **Defender** | OpenAI `gpt-4o` (or `gpt-5`) | Fast, optimistic, mechanism-focused |
| **Counsel (Drafting)** | OpenAI `gpt-4o` | Friendly chat to sharpen briefs |

### Voice / SFX
- **ElevenLabs Conversational AI** — 3 distinct voices + gavel SFX

### Literature Search
- **Tavily** (sponsor + venue host @ 1350 Broadway, Fl. 24)
- **Semantic Scholar API** (200M+ papers, free)
- **arXiv API** (free preprints)
- **PubMed E-utilities** (free, biomedical)

### Storage
- **ChromaDB** (local vector store for protocols + feedback)
- **SQLite** (case history)

### Deployment
- **Vercel** (frontend) + **Railway / Render** (FastAPI)

---

## 🎨 Visual Design

### Brand Identity
- **Headline font**: `Playfair Display` (legal gravitas)
- **Body font**: `Inter` (Linear-style)
- **Background**: `#0A0A0F` (cinematic dark)
- **Prosecutor accent**: `#DC2626` (red-600)
- **Defender accent**: `#2563EB` (blue-600)
- **Judge accent**: `#D97706` (amber-600 / gold gavel)
- **Text**: `#F5F5F4` (neutral-100)

### Pages

| Route | Purpose | Key Components |
|---|---|---|
| `/` | Landing — hero + "File a Case" CTA | Hero, sample case carousel, CTA |
| `/draft` | **Counsel Chambers** — chat to sharpen hypothesis | Chat UI, "Approve Brief" button |
| `/court/[caseId]` | **Live Courtroom** — 3-pane trial in progress | Prosecutor pane, Judge pane, Defender pane, transcript ticker, "Approach the Bench" sidebar |
| `/verdict/[caseId]` | **Verdict** — full experiment plan | Protocol, Materials, Budget, Timeline, Validation, PDF export |
| `/cases` | **Docket** — past cases history | Sortable case list |

### Layout: The Courtroom 3-Pane

```
┌─────────────────────────────────────────────────────────┐
│ HEADER: Case #2026-04-25-001 · "CRP Biosensor v. Status"│
├──────────────┬──────────────────────────┬───────────────┤
│ PROSECUTOR   │        JUDGE             │   DEFENDER    │
│ (red theme)  │   (gold/neutral)         │ (blue theme)  │
│              │                          │               │
│ Evidence     │  Live Belief Gauge       │  Evidence     │
│ Cards ↓      │  Verdict: PENDING        │  Cards ↓      │
│              │  Confidence: 47%         │               │
│ "Objection!" │                          │  "Permitted!" │
│              │  ⚖️ GAVEL                 │               │
├──────────────┴──────────────────────────┴───────────────┤
│ TRIAL TRANSCRIPT (live, scrubbable)                     │
│ [T1] Prosecutor opening...                              │
│ [T2] Defender opening...                                │
└─────────────────────────────────────────────────────────┘
                    [Approach the Bench →]
```

---

## 🚀 KEY FEATURES (Build Priority Order)

### P0 — MUST SHIP (Hours 1–14, core MVP)

1. **Hypothesis input** with 4 sample-prompt chips (CRP biosensor, Lactobacillus, Trehalose, Sporomusa — from Fulcrum brief)
2. **Stare Decisis Search** (Literature QC) — Tavily + Semantic Scholar parallel queries → traffic-light novelty signal
3. **LangGraph 7-turn Court** — Prosecutor/Defender/Judge state machine producing structured turns
4. **3-Pane Courtroom UI** — live SSE-streamed agent cards
5. **Verdict screen** with confidence gauge + reasoning
6. **Experiment Plan generator** — Protocol / Materials / Budget / Timeline / Validation with cited sources

### P1 — DEMO MULTIPLIERS (Hours 14–20)

7. **Counsel Chambers** — pre-trial chat to draft/sharpen brief (from "LabGPT" pivot — kept as a court feature)
8. **Approach the Bench** sidebar — mid-trial Q&A: "Why did Prosecutor cite that paper?"
9. **ElevenLabs voices** for all 3 agents + gavel SFX on verdict
10. **PDF export** of verdict (procurement-ready)
11. **Framer Motion polish** — cards slide in, gauge rotates, gavel strikes

### P2 — STRETCH GOALS (Hours 20–22)

12. **Court Transcript Replay** — scrubbable timeline (AgentOps Replay DNA)
13. **Motion to Reconsider** — chat with Judge to tweak verdict ("lower budget by 30%")
14. **Knowledge Graph view** of precedent papers ↔ hypothesis (SPINE DNA)
15. **Appellate Court** — scientist corrections stored in vector DB → next similar case visibly improves

### P3 — POLISH & SHIP (Hours 22–24)

16. **Demo recording** (2-min MP4 H.264 per Hack-Nation FAQ)
17. **Deploy** to Vercel + Railway with public URLs
18. **Submit** at projects.hack-nation.ai by 9:00 AM ET

---

## 🛠️ STEP-BY-STEP BUILD PLAN

> **Pause-and-review checkpoint after every step.** No skipping. Test, then proceed.

### Phase 0 — Foundation (1 hour)

- [ ] **Step 1**: Monorepo scaffold (`/frontend` Next.js + `/backend` FastAPI) ⭐
- [ ] **Step 2**: `.env`, `.gitignore`, README, install deps both sides
- [ ] **Step 3**: Frontend dev server runs on `:3000`, backend on `:8000`, CORS wired, `/health` endpoint pings

### Phase 1 — Landing & Input (1.5 hours)

- [ ] **Step 4**: Landing page (`/`) — hero with "POPPER-PROOF COURT" + "File a Case" CTA + brand colors/fonts
- [ ] **Step 5**: "File a Case" form (`/draft`) — textarea + 4 sample-prompt chips (CRP biosensor, etc.)
- [ ] **Step 6**: Backend `POST /api/cases` accepts hypothesis, returns `case_id`, persists to SQLite

### Phase 2 — Stare Decisis (Literature QC) (2 hours)

- [ ] **Step 7**: Backend Tavily integration — query for related work
- [ ] **Step 8**: Backend Semantic Scholar integration — fetch top papers
- [ ] **Step 9**: Backend novelty classifier (LLM ranks 3 candidates, returns `not_found | similar | exact_match`)
- [ ] **Step 10**: Frontend "Pretrial Discovery" panel — traffic light + 3 evidence cards with citations

### Phase 3 — Multi-Agent Court (4 hours) ⭐ The big one

- [ ] **Step 11**: Backend LangGraph state machine — 7-turn protocol scaffold (no LLM yet, mock turns)
- [ ] **Step 12**: Wire Prosecutor agent (Claude Sonnet 4.5) — opening + rebuttal + closing
- [ ] **Step 13**: Wire Defender agent (GPT-4o) — opening + rebuttal + closing
- [ ] **Step 14**: Wire Judge agent (o3) — belief updates + final verdict (with confidence %)
- [ ] **Step 15**: SSE endpoint `/api/court/{case_id}/stream` — yields each turn as it completes
- [ ] **Step 16**: Frontend 3-pane Courtroom UI shell at `/court/[caseId]`
- [ ] **Step 17**: Frontend SSE consumer — render Prosecutor/Defender cards on left/right, Judge belief gauge updating
- [ ] **Step 18**: Live transcript ticker at bottom, color-coded by speaker

### Phase 4 — Verdict & Experiment Plan (3 hours)

- [ ] **Step 19**: Backend Verdict generator — when Judge rules PROCEED, kick off plan synthesis
- [ ] **Step 20**: Plan generator: Protocol section (grounded in protocols.io scrape/RAG)
- [ ] **Step 21**: Plan generator: Materials section (Sigma/Thermo catalog lookup with SKUs + prices)
- [ ] **Step 22**: Plan generator: Budget (line items in waterfall) + Timeline (Gantt) + Validation
- [ ] **Step 23**: Frontend Verdict screen `/verdict/[caseId]` — tabbed view of all 5 sections with citations
- [ ] **Step 24**: Frontend "Send to Lab" PDF export

### Phase 5 — Demo Multipliers (3 hours)

- [ ] **Step 25**: Counsel Chambers chat (`/draft` upgraded) — GPT-4o helps user sharpen hypothesis before filing
- [ ] **Step 26**: "Approach the Bench" sidebar — user can ask Q's mid-trial, agent responds without breaking flow
- [ ] **Step 27**: ElevenLabs voices — 3 distinct voices stream alongside text per turn
- [ ] **Step 28**: Gavel SFX on verdict reveal + Framer Motion polish (cards slide, gauge animates)

### Phase 6 — Stretch (Only if on track) (2 hours)

- [ ] **Step 29**: Replayable Trial Transcript timeline (scrub through turns)
- [ ] **Step 30**: "Motion to Reconsider" — chat lets Judge revise verdict (lower budget, etc.)
- [ ] **Step 31**: Appellate Court feedback loop — corrections → ChromaDB → few-shot in next similar case

### Phase 7 — Ship (1.5 hours)

- [ ] **Step 32**: Sample-case smoke tests (all 4 Fulcrum hypotheses produce plans end-to-end)
- [ ] **Step 33**: Deploy frontend to Vercel + backend to Railway, smoke-test prod URLs
- [ ] **Step 34**: Record 2-min demo video (MP4 H.264) — follow winner pitch formula
- [ ] **Step 35**: Submit to `projects.hack-nation.ai` by 9:00 AM ET ✅

---

## 📅 24-Hour Timeline

| Time (ET) | Phase | Goal |
|---|---|---|
| 1:00 PM Sat | Phase 0–1 | Scaffold + landing + input working |
| 3:00 PM | Phase 2 | Literature QC end-to-end |
| 6:00 PM | Phase 3 (start) | LangGraph 7-turn produces text verdicts |
| 9:00 PM | Phase 3 (end) | Live court UI with SSE streaming |
| 11:00 PM | Phase 4 | Experiment plan generated |
| 1:00 AM Sun | Phase 5 (start) | Counsel Chambers + Approach the Bench |
| 3:00 AM | Phase 5 (end) | ElevenLabs voices + animations |
| 5:00 AM | Phase 6 | Replay + Appellate (if time) |
| 7:00 AM | Phase 7 | Smoke tests + deploy + record demo |
| **9:00 AM** | **SUBMIT** | ✅ |

---

## 🎤 Pitch Skeleton (2 min)

1. **Hook (15s)**: "Going from a hypothesis to a runnable experiment costs labs $50K and 3 weeks. We replaced the CRO with a courtroom."
2. **Live demo (75s)**: Type CRP biosensor hypothesis → Stare Decisis search → 3 voiced agents argue 30s → gavel + verdict + plan with $12K budget, 6-week timeline, ready to send to Sigma.
3. **Tech depth (15s)**: GPT-5/o3 + Claude Sonnet 4.5 + ElevenLabs + Tavily + LangGraph 7-turn protocol from a Jan 2026 arXiv paper.
4. **Provenance (10s)**: Hover any verdict line → cited paper appears.
5. **Close (5s)**: "POPPER-PROOF COURT — because if your hypothesis can't survive cross-examination, it shouldn't survive the lab."

---

## 🔐 Setup

```bash
# 1. Clone & enter
cd "POPPER-PROOF COURT"

# 2. Copy env template (NEVER commit .env)
cp .env.example .env
# Then edit .env with your real keys

# 3. Frontend (Next.js 16 + React 19 + Tailwind 4)
cd frontend
npm install
npm run dev   # → http://localhost:3000

# 4. Backend (separate terminal)
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000   # → http://localhost:8000
```

---

## 📂 Repo Structure (target)

```
POPPER-PROOF COURT/
├── .env.example
├── .gitignore
├── README.md
├── frontend/                  # Next.js 15
│   ├── app/
│   │   ├── page.tsx           # Landing
│   │   ├── draft/page.tsx     # Counsel Chambers
│   │   ├── court/[id]/page.tsx
│   │   ├── verdict/[id]/page.tsx
│   │   └── cases/page.tsx
│   ├── components/
│   │   ├── courtroom/
│   │   ├── evidence-card.tsx
│   │   └── verdict-gauge.tsx
│   ├── lib/
│   └── package.json
└── backend/                   # FastAPI + LangGraph
    ├── app/
    │   ├── main.py
    │   ├── agents/
    │   │   ├── prosecutor.py
    │   │   ├── defender.py
    │   │   └── judge.py
    │   ├── graph/
    │   │   └── court.py       # LangGraph 7-turn state machine
    │   ├── search/
    │   │   ├── tavily.py
    │   │   └── semantic_scholar.py
    │   ├── plan/
    │   │   ├── protocol.py
    │   │   ├── materials.py
    │   │   ├── budget.py
    │   │   └── timeline.py
    │   ├── voice/
    │   │   └── elevenlabs.py
    │   └── schemas.py
    └── requirements.txt
```

---

## 📜 License

MIT — Hack-Nation 2026. Built in 24 hours by a team that believes science deserves better operations.

**Made with ⚖️ at the Tavily NYC hub — 1350 Broadway, Floor 24.**
