// =============================================================
// PERISAFETY DASHBOARD — PROXY SERVER
// Sits between the browser and Anthropic API.
// Keeps your API key off the browser where it could be stolen.
// =============================================================

import express from 'express';
import cors    from 'cors';
import dotenv  from 'dotenv';
import path    from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app     = express();
const PORT    = process.env.PORT || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use(express.static(path.join(__dirname, 'dist')));

app.post('/api/messages', async (req, res) => {
  const apiKey   = process.env.ANTHROPIC_API_KEY;
  const mcpToken = process.env.N8N_MCP_TOKEN;

  if (!apiKey) {
    return res.status(500).json({ error: { message: 'ANTHROPIC_API_KEY is not set.' } });
  }

  // Inject the MCP auth token server-side so it never touches the browser
  const body = { ...req.body };
  if (mcpToken && Array.isArray(body.mcp_servers)) {
    body.mcp_servers = body.mcp_servers.map(server => ({
      ...server,
      authorization_token: mcpToken,
    }));
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'mcp-client-2025-04-04',
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(500).json({ error: { message: err.message } });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`
霈  PeriSafety proxy running → http://localhost:${PORT}`);
  console.log(`   React dev server         → http://localhost:3000
`);
});
