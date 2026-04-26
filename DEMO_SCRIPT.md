# 🎬 POPPER-PROOF COURT — Recording Scripts

> Two videos, **60 seconds each**, per Hack-Nation submission rules.
> One **DEMO** video for the general/scientist judges (sells the story).
> One **TECH** video for the technical/sponsor judges (sells the build).

These scripts are **shot-by-shot, second-by-second**. Don't improvise on tape. Memorize the voiceover beats, run a single dry take, then record.

---

## 🧰 Pre-Recording Checklist (~10 min)

Do these **once** before either recording session:

- [ ] **Both servers up.** Backend on `:8000`, frontend on `:3000`.
- [ ] **Real keys in `.env`.** `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `TAVILY_API_KEY`. (Verify: `curl localhost:8000/trial/engine` → `{"ready": true}`.)
- [ ] **Burn down stale state.** Restart the backend so the in-memory docket is empty. Open `http://localhost:3000`. No stale toasts, no leftover cases.
- [ ] **Dock the browser.** Hide bookmarks bar, use a clean profile, zoom 100%. Window size 1440×900 minimum, 1920×1080 ideal.
- [ ] **Hide noise.** Close other apps, silence notifications, hide the dock/taskbar (`Cmd+Option+D` on macOS).
- [ ] **DevTools ready (TECH video only).** Open DevTools → Network tab, filter to `EventStream`. Pre-position at the top of the right side.
- [ ] **Mic check.** Disable AC if loud. 30-second recording test → playback → fix levels.
- [ ] **The hypothesis is on your clipboard** (see `## Demo Case` below). Don't type it on tape — paste it.

### Demo Case (paste this, don't type it)

> **A nanobody-based CRP biosensor with a graphene-FET readout will detect 0.1 ng/mL CRP in human serum within 5 minutes, beating the current ELISA gold standard by 10×.**

Why this hypothesis: it's grounded in the Fulcrum Science brief (CRP is one of their stated targets), it lands real Tavily + Semantic Scholar hits (graphene biosensors, nanobody affinity, ELISA limit-of-detection), and the Judge tends to rule **REVISE** (~70% confidence) — which makes the *Bench Memorandum* punchline land with maximum impact.

### One-shot rehearsal

Before recording, **run the full flow once on tape-quality settings** — paste hypothesis → file → discovery → trial → verdict → file memorandum → plan regenerates. Just to make sure nothing 503s. If a real call hangs (>10s on any single agent), record over mock-mode (`unset OPENAI_API_KEY` for the recording) — the UI is identical.

---

## 🎥 VIDEO 1 — DEMO (60 seconds, general audience)

**Goal**: A scientist/PM judge watching at 1× speed should walk away with: *"I get what it is, I get why it matters, and I want to try it."*

**Voice tone**: confident, plainspoken, no jargon. Read it like a Bloomberg product trailer, not a YouTube tutorial.

| Time | What's on screen | Voiceover |
|---|---|---|
| **0:00 – 0:07** | Cold open: title card *"POPPER-PROOF COURT"* fades onto a shot of the dark landing page. ⚖ logo pulses once. | *"Researchers waste weeks on hypotheses that have already been disproven. POPPER-PROOF COURT puts your science on trial — before you spend a dime."* |
| **0:07 – 0:18** | Click **File a Case** → cut to `/draft`, hypothesis pastes in (`Cmd+V` — pre-filled clipboard). Click **File the Case →**. Cut to `/case/[id]`: Pretrial Discovery panel populates with 3–5 citation chips. | *"You file your case. Pretrial Discovery pulls real precedent from the open web and Semantic Scholar."* |
| **0:18 – 0:35** | **The trial pane.** Camera pans across the three columns as turns stream in: Prosecutor card (red) appears, citation chip `[1]` highlights, Defender card (blue) replies, Judge card (gold) updates the belief gauge. Speed up if needed. | *"Three AI agents take the bench. The Prosecutor attacks. The Defender defends. The Judge deliberates. Every claim is cited — live, on stage."* |
| **0:35 – 0:45** | Verdict resolves to **REVISE · 72%**. Pan down: the Order of the Court card finishes drafting — budget, timeline, materials, all visible at a glance. | *"The court rules. The Clerk drafts a runnable experiment plan — budget, timeline, methods, every line cited."* |
| **0:45 – 0:55** | The money shot. Click the chip *"Tighten the timeline to 8 weeks."* in the Bench Memorandum card → **File the motion →**. Watch the verdict header gain the **Revised ×1** badge in gold. The plan card flips to *"The Clerk is drafting…"* and resolves with the new timeline. | *"Change a constraint mid-flight. The bench reconsiders. The plan redraws — in seconds."* |
| **0:55 – 1:00** | Cut to logo lockup over dark background. Tagline appears: *"Bulletproof science."* | *"POPPER-PROOF COURT. Bulletproof science."* |

**Word count**: ~120. Comfortable VO at 130 wpm leaves room for breathing on the cuts.

### If you're 5 seconds over

- Tighten the trial pan from 17s → 12s. The agents stream fast enough that 5 seconds of B-roll still reads.
- Drop *"in seconds"* from the reconsideration line.
- Shorten the cold open from 7s to 4s — the title card alone with no voice is fine.

---

## 🎥 VIDEO 2 — TECH (60 seconds, technical audience)

**Goal**: A sponsor engineer or technical judge should walk away with: *"They actually built this. The architecture is sound. The provenance story is real."*

**Voice tone**: precise, factual, faster cadence. Like an engineering changelog reading.

| Time | What's on screen | Voiceover |
|---|---|---|
| **0:00 – 0:10** | Open on `README.md` → scroll to the architecture mermaid diagram. Highlight the four-pillar pipeline. | *"POPPER-PROOF COURT is a multi-agent debate system. Next.js 16 frontend, FastAPI backend, three LLMs in the courtroom — streamed end to end over Server-Sent Events."* |
| **0:10 – 0:25** | Cut to `backend/app/agents/clients.py` with the model constants highlighted. Then a quick split-screen: `tavily_client.py` and `scholar_client.py`. | *"The Prosecutor runs Claude Sonnet 4.5. The Defender and Judge run GPT-4o. Pretrial Discovery hits Tavily for the open web and Semantic Scholar for peer-reviewed papers — in parallel, with a novelty classifier on top."* |
| **0:25 – 0:40** | Cut to a live trial running. Open DevTools → Network → click an `EventStream` row to show the SSE event log scrolling: `thinking` → `turn` → `verdict` → `complete`. | *"Everything streams over SSE — the trial, the Court Reporter chat, even the Judge's reconsideration. Tokens hit the browser the instant the model emits them."* |
| **0:40 – 0:55** | Cut to a verdict card. Hover a `[1]` citation chip → it expands to a paper card. Click → opens the arXiv / Semantic Scholar URL in a new tab. | *"Citations carry bracket-N markers from discovery, through the debate, into the experiment plan, and all the way to the post-verdict chat. Provenance you can audit, end to end."* |
| **0:55 – 1:00** | Cut to GitHub repo URL on screen + sponsor logos (Anthropic · OpenAI · Tavily · Semantic Scholar). | *"Open source on GitHub. Built on Anthropic, OpenAI, and Tavily."* |

**Word count**: ~120. Faster cadence (~140 wpm) is appropriate for a tech audience.

### If you're 5 seconds over

- Drop *"in parallel, with a novelty classifier on top"* from the Discovery line.
- Drop the closing *"Built on Anthropic, OpenAI, and Tavily"* — the sponsor logos on screen do the work.
- Cut the architecture pan from 10s → 6s — judges already understand the diagram.

---

## 🎙️ Voice & Recording Notes

- **Pacing**: don't rush. 60 seconds feels long when you're recording it. The B-roll carries the silence between sentences.
- **One take rule**: aim for one clean take per script. If you flub, restart from the top of the *current line*, not the whole take — modern editors splice cleanly on natural pauses.
- **Music**: optional 30%-volume cinematic underscore. If used, fade out at 0:55 so the tagline lands in silence.
- **Captions**: hard-burn captions on both videos. Most judges screen the videos muted in a noisy room.
- **Export settings**: 1080p, H.264, ≤30 MB. Hack-Nation's submission portal accepts MP4 directly.

## 🚦 Backup: if the demo breaks during recording

If a real LLM call hangs or returns 503 mid-take, **abort the take and switch to mock mode** for that recording session:

```bash
# in the backend terminal — comment out the keys in .env, then:
uvicorn app.main:app --reload --port 8000
# /trial/engine will report ready: false, and the trial stream will use the
# canned mock turns. The UI is pixel-identical, the streaming feels real,
# and the Bench Memorandum / Reporter still work in mock fallback.
```

The judges aren't going to inspect the network tab on the DEMO video. The TECH video should be recorded with **real keys** so the SSE event log shows `event: turn` from a live model — that's the moment that proves it's not faked.

---

## ✅ Submission Checklist

- [ ] DEMO video uploaded (≤60s, ≤30 MB, 1080p MP4)
- [ ] TECH video uploaded (≤60s, ≤30 MB, 1080p MP4)
- [ ] Both URLs pasted into `README.md` Submission table
- [ ] GitHub repo public · README + DEMO_SCRIPT visible
- [ ] `.env` **NOT** in the commit (`git ls-files | grep .env` → only `.env.example`)
- [ ] Submitted at `projects.hack-nation.ai` before **9:00 AM ET**
