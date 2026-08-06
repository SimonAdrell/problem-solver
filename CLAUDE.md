# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Practice project for the AI-103 (Azure AI) certification. Monorepo with a Next.js frontend and a Flask backend, currently focused on session-based auth. `backend/research_agent` and `infra/` are empty placeholders for an AI agent component and IaC that don't exist yet — don't assume code lives there.

## Commands

### Frontend (`frontend/problem-solver-frontend`)
```
npm install
npm run dev      # next dev
npm run build
npm run start
npm run lint      # eslint
```
No test suite is configured yet.

### Backend (`backend/problem-solver-backend`)
```
python -m venv .venv
.venv/Scripts/activate     # or .venv/bin/activate on non-Windows
pip install -r requirements.txt
flask --app app run
```
There's no `wsgi.py`/`manage.py`/`Procfile` — run via `flask --app app run` (or set `FLASK_APP=app`). No test suite is configured yet. Requires a `.env` in this directory with `SECRET_KEY`, `SECURITY_PASSWORD_SALT`, `DATABASE_URL`, `FLASK_ENV` (see existing `.env` for placeholder values — dev DB is SQLite at `instance/app.db`).

## Architecture

**Two independent apps wired together only through a dev-time proxy**, not a shared package/workspace:

- `frontend/problem-solver-frontend` — Next.js 16 (App Router, React 19, Tailwind 4, TypeScript, `@/*` path alias to project root).
- `backend/problem-solver-backend` — single-file Flask app (`app.py`) using Flask-SQLAlchemy + Flask-Security-Too for auth, Flask-WTF for CSRF.

### Same-origin proxying
`next.config.ts` rewrites `/api/:path*` to `${FLASK_URL}/api/:path*` (frontend `.env` sets `FLASK_URL=http://localhost:5000`). This makes the Flask API appear same-origin to the browser, which is what makes Flask-Security's session-cookie + CSRF-cookie auth work without CORS.

### Auth flow
- Flask-Security is configured SPA-style: `SECURITY_URL_PREFIX="/api/accounts"`, `SECURITY_REDIRECT_BEHAVIOR="spa"`, `SECURITY_RETURN_GENERIC_RESPONSES=True`. Session cookies only (`auth_required("session")`), not tokens. `SECURITY_RECOVERABLE=True` registers `/accounts/reset/<token>`; the "forgot password" *request* step (which emails the token) still needs mail configured — nothing in the frontend triggers it yet.
- CSRF: `WTF_CSRF_CHECK_DEFAULT=False` combined with `SECURITY_CSRF_PROTECT_MECHANISMS=["session", "basic"]` — Flask-Security enforces CSRF itself via the `XSRF-TOKEN` cookie / `X-XSRF-Token` header pair, independent of global Flask-WTF checks.
- `lib/api.ts`'s `api()` helper is the single fetch wrapper: reads `XSRF-TOKEN` from `document.cookie` and sends it as `X-XSRF-Token` on every non-GET request; unwraps Flask-Security's `{response: ...}` envelope; throws `ApiError` (with `errors` / `fieldErrors`) on non-2xx.
- `lib/auth-context.tsx`'s `AuthProvider` (mounted once, in the real root layout `app/layout.tsx`, so it wraps every route including `(auth)`) bootstraps by calling `GET /api/accounts/login` (seeds the CSRF cookie even when logged out) then `GET /api/me` to resolve the session. `user` state is a three-way flag: `undefined` = still checking, `null` = logged out, `User` = logged in. Any page reads it via `useAuth()`, which also exposes `login()`, `logout()`, and `refresh()` (re-fetches `/api/me` — used after `register` since Flask-Security auto-logs-in on signup when `SECURITY_CONFIRMABLE=False`).
- `GET /api/me` (in `app.py`) is the only custom API route so far; everything else under `/api/accounts/*` is Flask-Security's built-in views.

### Route protection
`proxy.ts` (Next.js 16 renamed the `middleware.ts` convention to `proxy.ts` — see `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`) gates every route except `/login`, `/register`, `/reset-password`, and `/api/*`. Because the session cookie is opaque (signed server-side by Flask, not verifiable in the proxy), it works by calling `GET /api/me` through the same rewrite the browser uses and redirecting to `/login` on a non-2xx before the page ever renders — deliberately *not* client-side gating (no `useEffect` redirect, no flash of protected content, no shipping a protected page's JS to a logged-out visitor). Pages themselves don't need to know about auth state to be "protected"; only use `useAuth()` in a page when it needs to read/display the user.

### Frontend routing
Route groups split protected vs. public pages: `app/(app)/*` (currently just the home page) vs `app/(auth)/*` (`login`, `register`, `reset-password`). Both groups share the single root layout at `app/layout.tsx` — don't add a `layout.tsx` inside either group with its own `<html>`/`<body>`, Next.js will silently treat it as a second, group-scoped root layout and everything outside that group loses the wrapping (this previously left `(auth)` pages calling `useAuth()` with no `AuthProvider` above them, which only surfaces as a prerender crash at build time, not in dev).

### Editing Next.js code
`AGENTS.md` in the frontend directory (auto-generated by `next dev`, re-added on every dev run — commit it rather than fighting it) points at `node_modules/next/dist/docs/` for this Next.js version's docs before writing code, since APIs/conventions may differ from training data. Read the relevant guide there for anything non-trivial (routing, data fetching, etc.) — the `proxy.ts` rename above is exactly the kind of thing that bites you without it.
