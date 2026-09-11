# problem-solver

Describe a vague problem, get three buildable Azure AI app ideas – and for the one you pick, an architecture blueprint and a generated concept screenshot.

Built as a hands-on project for the Azure AI certification track. It exercises the full loop: provisioning agents in **Azure AI Foundry**, chaining them into a small pipeline, calling an image model, and deploying the infrastructure with **Bicep**.

## What it does

1. **Define** – a `define-agent` sharpens the raw problem statement into a structured brief: core problem, persona, available inputs, success criteria. It never proposes a solution.
2. **Solve** – a `solve-agent` reads the brief and proposes exactly three concrete AI applications, each with a different primary AI technique and a distinct set of Azure services, plus a first prototype step you could do this week.
3. **Blueprint** – for the idea you choose, a `blueprint-agent` produces an architecture description, a build estimate, risks and unknowns, and an image prompt.
4. **Image** – the prompt is rendered into a concept screenshot with an image model deployed in the same Foundry account.

All agents are prompt-defined and versioned in Foundry. On startup the backend upserts them, writing a new version only when the instructions have changed.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind 4 |
| Backend | Python 3, Flask, Flask-Security-Too (session auth, CSRF), Flask-Limiter |
| AI | Azure AI Foundry agents via `azure-ai-projects` (Responses API), Azure OpenAI image generation via the `openai` SDK |
| Infra | Bicep – Foundry account, project, capability hosts, chat and image model deployments |
| Tests | `pytest` – rate limits and payload caps (offline), define agent (live) |

## Repository layout

```
frontend/problem-solver-frontend/   Next.js app; /api/* is proxied to Flask so the browser sees one origin
backend/problem-solver-backend/     Flask app (app.py), agents/, tests/, openapi.yaml
infra/                              main.bicep + dev.bicepparam
```

## API

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/solve` | public | Problem statement → brief + three ideas |
| `POST /api/blueprint` | public | Brief + chosen idea → blueprint |
| `POST /api/image` | public | Image prompt → concept screenshot |
| `GET /api/me` | session | Current user |
| `/api/accounts/*` | – | Flask-Security register / login / logout / reset |

The full contract is in `backend/problem-solver-backend/openapi.yaml`.

The three AI endpoints spend real model credits without a login in front of them, so they are capped: 20 requests per hour per client IP per endpoint, 64 KB request bodies, and 2 000 characters on free-text fields.

## Running locally

**Infrastructure**

```bash
az deployment group create -g <resource-group> -f infra/main.bicep -p infra/dev.bicepparam
```

Creates the Foundry account and project and deploys a chat model and an image model (names are parameters in `main.bicep`).

**Backend**

```bash
cd backend/problem-solver-backend
python -m venv .venv && .venv/Scripts/activate   # .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
flask --app app run
```

Needs a `.env` with `SECRET_KEY`, `SECURITY_PASSWORD_SALT`, `DATABASE_URL`, `FLASK_ENV`, `PROJECT_ENDPOINT`, `MODEL_DEPLOYMENT_NAME` and `IMAGE_MODEL_DEPLOYMENT_NAME`. Azure access uses `DefaultAzureCredential`, so `az login` is enough for local development.

**Frontend**

```bash
cd frontend/problem-solver-frontend
npm install
npm run dev
```

Set `FLASK_URL=http://localhost:5000` in the frontend `.env`; `next.config.ts` rewrites `/api/*` to it.

## Design notes

- **Same-origin proxying.** The Flask API is only reached through the Next.js rewrite, which is what lets Flask-Security's cookie + CSRF-header auth work without CORS. `ProxyFix` trusts `X-Forwarded-For` so rate limiting keys on the real client, not the Next server.
- **Route protection is server-side.** `proxy.ts` gates protected routes by calling `/api/me` before the page renders – no client-side redirect, no flash of protected content.
- **Agents return JSON only.** Each agent's instructions demand a bare JSON object; the backend parses it and fails loudly on anything else.

## Status

The solve → blueprint → image flow is implemented against a live Foundry project. No frontend test suite yet; rate-limit storage is in-memory (single process).