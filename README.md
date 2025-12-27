# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
---

## Deployment notes (Vercel + Render)

1. Backend (Render)
   - Update the Start Command in Render to: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Set env vars in Render: `MONGO_URI`, `SECRET_KEY`, and `FRONTEND_URL` (your Vercel URL: e.g., `https://myapp.vercel.app`).
   - Health check path: `/health`

2. Frontend (Vercel)
   - Set the following environment variables in the Vercel dashboard (Project → Settings → Environment Variables) BEFORE building:
     - `VITE_API_URL` = `https://your-render-service.onrender.com`
     - `VITE_WS_URL` = `wss://your-render-service.onrender.com`
   - Redeploy the frontend after updating these vars so the built app embeds the correct API endpoints.

3. CORS
   - The backend now reads `FRONTEND_URL` from env and allows `http://localhost:5173` for local dev. Set `FRONTEND_URL` to your Vercel URL on Render for production.

4. Local dev
   - You can still run the backend locally and the frontend will default to `http://127.0.0.1:8000` and `ws://127.0.0.1:8000` when `VITE_API_URL`/`VITE_WS_URL` are not set.