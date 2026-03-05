# PeriSafety Dashboard

Deployment tracking dashboard for a perioperative safety research program.

> ⚠️ Research Software Only · Not for Clinical Use · No PHI

## Live App

https://gsv-status-tracker.onrender.com

## Architecture

```
Browser (React/Vite)
  → /api/messages (Express proxy, server.js)
  → https://api.anthropic.com/v1/messages (Anthropic API)
  → n8n MCP server (testbed999.app.n8n.cloud/mcp-server/http)
  → Google Sheets (Spreadsheet ID: 1otqhLeWFt5W-hUGOE3KbZiGFqCHL6rDAIyJ2DxJBcDc)
```

The Express proxy in `server.js` sits between the browser and Anthropic. This is necessary for two reasons:
1. It keeps the `ANTHROPIC_API_KEY` off the browser (security)
2. It injects the `N8N_MCP_TOKEN` into every request server-side (the Anthropic API requires this as `authorization_token` on the `mcp_servers` object)

## Environment Variables

All three variables must be set in Render's Environment dashboard:

| Variable | Description | Where to find it |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key | console.anthropic.com → API Keys |
| `N8N_MCP_TOKEN` | Auth token for the n8n MCP server | n8n Settings → MCP, or the Header Auth credential used by your workflows |
| `PORT` | Server port (Render sets this automatically) | Set to `10000` on Render |

For local development, copy `.env.example` to `.env` and fill in your values.

## Render Deployment

- **Build command:** `npm install --include=dev && npm run build`
- **Start command:** `npm start`
- **Port:** 10000

## Local Development

```bash
npm install
cp .env.example .env
# fill in .env
npm run dev      # Vite dev server on :3000
npm start        # Express proxy on :3001
```

## Key Files

| File | Purpose |
|---|---|
| `src/App.jsx` | Entire React frontend (~32KB, single file) |
| `server.js` | Express proxy — forwards `/api/messages` to Anthropic, injects MCP token |
| `vite.config.js` | Vite build config |
| `package.json` | Scripts: `build` (vite build), `start` (node server.js) |

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| CORS error | App calling Anthropic directly from browser | Ensure `callClaude()` in App.jsx uses `/api/messages`, not the full Anthropic URL |
| HTTP 401 | Invalid or missing `ANTHROPIC_API_KEY` | Update the key in Render → Environment |
| HTTP 400 `mcp_servers.0.authorization_token` | Wrong or missing MCP token | Update `N8N_MCP_TOKEN` in Render → Environment |
| Authentication error from MCP server | Wrong token value | Use the JWT token from n8n Settings → MCP (not the n8n REST API key) |
