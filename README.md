# ScoreLab Analytics

ScoreLab is a football analysis and bankroll management app with:

- React + Vite frontend (auth and per-user data on Supabase)
- FastAPI backend serving the statistical analysis engine (/analyze)
- local-first cache in the browser, synced to Supabase per account

This guide is written for the practical use case: `run the app on another computer`.

## What you need on the other computer

Install these 3 things first:

1. `Node.js`
   Install the `LTS` version from [nodejs.org](https://nodejs.org/)

2. `Python`
   Install Python `3.11` or `3.12` from [python.org](https://www.python.org/downloads/)
   During installation, enable `Add Python to PATH`

3. `VS Code`
   Install normally from [code.visualstudio.com](https://code.visualstudio.com/)

## Copy the project

Copy the whole folder `scorelab-analytics` to the other computer and open it in VS Code.

Example path:

```powershell
C:\Projects\scorelab-analytics
```

## Frontend setup

Open a terminal in the project root and run:

```powershell
cd "C:\Projects\scorelab-analytics"
npm install
```

Create a `.env` file in the project root based on `.env.example`.

Example `.env`:

```env
VITE_API_URL=http://localhost:8000
```

Start the frontend:

```powershell
npm run dev -- --host
```

Frontend URL:

```text
http://localhost:8080
```

## Backend setup

Open a second terminal in VS Code and run:

```powershell
cd "C:\Projects\scorelab-analytics\backend"
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

If PowerShell blocks the virtual environment activation, run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\venv\Scripts\Activate.ps1
```

Create a `backend\.env` file based on `backend\.env.example`.

Example `backend\.env`:

```env
SCORELAB_ALLOWED_ORIGINS=http://localhost:8080
```

Start the backend:

```powershell
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend URL:

```text
http://localhost:8000
```

## How to open the app

After both terminals are running:

1. open the browser
2. go to:

```text
http://localhost:8080
```

The backend health check is:

```text
http://localhost:8000
```

If the backend is running correctly, it should return:

```text
ScoreLab API is running
```

## Vercel frontend deployment

The repository includes a `vercel.json` for deploying the React/Vite frontend to Vercel:

```json
{
  "framework": "vite",
  "installCommand": "npm ci",
  "buildCommand": "npm run build",
  "outputDirectory": "dist"
}
```

In Vercel, import this repository and use the project root as the root directory.

Set this frontend environment variable in Vercel:

```env
VITE_API_URL=https://your-scorelab-api.example.com
```

Do not use `http://localhost:8000` in production. In a deployed browser, `localhost` means the user's own computer, not the ScoreLab backend.

The current recommended production shape is:

```text
Vercel frontend
  -> VITE_API_URL
  -> FastAPI backend hosted separately
  -> managed database
```

The FastAPI backend is intentionally excluded from the Vercel frontend deploy through `.vercelignore`. Host it separately on a Python-friendly service, or migrate it later to a Vercel-compatible API structure.

For the backend production environment, set:

```env
SCORELAB_ALLOWED_ORIGINS=https://your-vercel-domain.vercel.app
```

User data (analyses, multiples, bankroll and roadmap settings) is stored per account in Supabase with Row Level Security. The backend no longer persists user data.

## Quick checklist

Use this order:

1. install Node.js
2. install Python
3. open the project in VS Code
4. run `npm install`
5. create root `.env`
6. create backend venv
7. run `pip install -r requirements.txt`
8. create `backend\.env`
9. start backend
10. start frontend
11. open `http://localhost:8080`

## Common problems

### Frontend opens but backend calls fail

Check:

- backend terminal is running
- `VITE_API_URL` points to `http://localhost:8000`
- `SCORELAB_ALLOWED_ORIGINS` includes `http://localhost:8080`

### PowerShell blocks the venv

Use:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\venv\Scripts\Activate.ps1
```

### Build or tests fail with `spawn EPERM`

This can happen in restricted Windows/OneDrive environments with `esbuild`.
In that case:

- development mode can still work
- lint and TypeScript checks can still pass
- moving the project outside a restricted OneDrive folder may help

## Useful commands

Frontend:

```powershell
cd "C:\Projects\scorelab-analytics"
npm install
npm run dev -- --host
```

Backend:

```powershell
cd "C:\Projects\scorelab-analytics\backend"
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
