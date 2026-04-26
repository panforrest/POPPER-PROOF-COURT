# Backend — POPPER-PROOF COURT

FastAPI + LangGraph orchestrator for the multi-agent Science Research Court.

## Quickstart

```bash
# 1. Create virtual env (Python 3.11+)
python3 -m venv .venv
source .venv/bin/activate

# 2. Install deps
pip install -r requirements.txt

# 3. Make sure ../.env exists (copy from ../.env.example)
# 4. Run
uvicorn app.main:app --reload --port 8000
```

Then visit:
- http://localhost:8000/         → identity payload
- http://localhost:8000/health   → liveness probe
- http://localhost:8000/docs     → Swagger UI

## Layout

```
backend/
├── app/
│   ├── main.py            # FastAPI entrypoint + CORS
│   ├── config.py          # Settings loaded from .env
│   ├── schemas.py         # Pydantic types (Case, AgentTurn, ExperimentPlan, ...)
│   ├── agents/            # Prosecutor, Defender, Judge, Counsel
│   ├── graph/             # LangGraph 7-turn court state machine
│   ├── search/            # Tavily, Semantic Scholar, arXiv, PubMed
│   ├── plan/              # Protocol, Materials, Budget, Timeline, Validation
│   └── voice/             # ElevenLabs voice synthesis
├── data/                  # SQLite + Chroma persisted state (git-ignored)
├── requirements.txt
└── .python-version
```
