<!-- .github/copilot-instructions.md for Personal-Healthcare-Assistant -->

# Quick guide for AI coding agents

This file gives focused, actionable context so an AI coding agent can be productive immediately in this repo.

- **Project type:** React (Vite) frontend + small Python FastAPI backend (single `server/server.py`).
- **Dev servers:** Frontend uses Vite (`npm run dev`). Backend runs with Uvicorn via `python server/server.py` (or `uvicorn server.server:app --reload`).

Key locations
- `server/server.py`: single-file FastAPI backend — CSV merging logic, AI summary + image analysis (Gemini). Important functions: `get_csv_files_for_date`, `merge_csv_files`, `parse_timestamp_from_filename`, `calculate_study_duration_per_file`. Endpoints: `/api/logs/water/{date}`, `/api/logs/study/{date}`, `/api/analyze`, `/api/summary`.
- `src/shared/services/`: OpenAI helpers used by the frontend: `openaiClient.js`, `openaiHydration.js`, `openaiVision.js`. The frontend calls OpenAI directly from the browser (see `dangerouslyAllowBrowser: true` in `openaiClient.js`).
- `src/features/` and `src/shared/components/`: UI components and hooks that consume the services and backend endpoints (e.g., hydration/chat, study, water components).

Important project-specific details
- Backend is stateful with local CSV files: `server.SERVER` expects logs under `LOGS_DIR` (default in `server.py`: `C:\Users\gaeun\Desktop\logs`) and captures under `CAPTURES_DIR`. These paths are hard-coded in `server/server.py` — update with environment variables before committing changes.
- `server/server.py` currently contains a hard-coded `GOOGLE_API_KEY` and Desktop-based `DATA_DIR`. Treat these as sensitive: do not commit real keys; prefer using `os.environ` (env vars) for local dev.
- CSV filename patterns supported are enumerated in `get_csv_files_for_date`; follow those patterns when adding sample data for tests.
- Frontend uses a Vite env var `VITE_OPENAI_API_KEY` (see `src/shared/services/openaiClient.js`). The client code expects an API key that begins with `sk-` and will throw if missing.
- The frontend uses the `chat.completions.create` call pattern with `SMALL_MODEL='gpt-4o-mini'` (see `openaiClient.js`). Keep API usage consistent with the existing message format.

Recommended developer workflows (commands)
- Install frontend deps and run dev server:
  - `npm install`
  - `npm run dev`
- Run backend locally (Windows PowerShell):
  - Install Python deps (example): `pip install fastapi uvicorn pandas google-generativeai`
  - Start server: `python server/server.py`
    - Or with reload for development: `uvicorn server.server:app --reload --host 0.0.0.0 --port 8000`
- Set environment variables for local dev (PowerShell):
  - ` $env:VITE_OPENAI_API_KEY='sk-...' ; npm run dev `
  - For backend, set `GOOGLE_API_KEY` in the environment and update `server.py` to read `os.environ.get('GOOGLE_API_KEY')` before running.

Patterns & conventions to follow when editing
- Prefer small, focused changes. The repo mixes frontend and a minimal backend — avoid large architectural rewrites without owner sign-off.
- When adding or changing AI usage:
  - In frontend, use `src/shared/services/*` helpers and follow existing `messages` structure used in `openaiHydration.js`/`openaiVision.js`.
  - Avoid leaking API keys. Use `import.meta.env.VITE_OPENAI_API_KEY` for client keys and environment variables for server keys.
- CSV handling: Add new parsing logic to `server/server.py` and keep backwards compatibility with the filename patterns listed in `get_csv_files_for_date`.
- When adding tests or fixtures: provide sample CSVs that match supported filename patterns and place them beneath a `test-data/` or local `logs/` folder and document their location in PRs.

Integration & cross-component notes
- Frontend ↔ Backend: frontend fetches data from `http://localhost:8000/api/...` when running locally. Images (captures) are served from `/captures` if `CAPTURES_DIR` exists and is mounted in `server.py`.
- Backend AI: `server/server.py` calls Google Generative AI (`google.generativeai`) for image analysis and summary. Frontend uses OpenAI (via `openai` package) directly for chat/hydration features.

Quick examples (do these first when making changes)
- Verify backend endpoints:
  - `curl http://localhost:8000/api/logs/water/2025-12-04`
- Verify frontend/OpenAI integration:
  - Set `VITE_OPENAI_API_KEY` then `npm run dev` and exercise the UI features that call `openaiHydration` or `openaiVision`.

When in doubt, inspect these files first
- `server/server.py`
- `src/shared/services/openaiClient.js`
- `src/shared/services/openaiHydration.js`
- `src/shared/services/openaiVision.js`
- `package.json` (dev scripts and dependency versions)

If you plan to commit changes that touch secrets or data paths
- Replace hard-coded secrets and paths with env lookups and document the required env vars in a short `server/README.md` or `.env.example`.

If anything is unclear or you want the file expanded with examples (env templates, sample CSV), tell me which section to expand and I will iterate.
