---
description: Run the application in development mode with hot reloading
---

# Development Workflow (Hot Reloading)

To avoid rebuilding the frontend after every change, run the backend and frontend in separate terminals.

### Terminal 1: Backend (API)
This runs the Python FastAPI server on port 8000.
```powershell
python api.py
```
*Wait for "Neural Core ready" message.*

### Terminal 2: Frontend (UI)
This runs the Vite development server on port 5173 with **instant updates**.
```powershell
cd frontend
npm run dev
```

### Access the App
Open your browser to: **http://localhost:5173**
(Do not use localhost:8000 for the UI in this mode)
