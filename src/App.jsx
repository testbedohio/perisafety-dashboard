// =============================================================
// PERIOPERATIVE SAFETY PROGRAM — DEPLOYMENT DASHBOARD  v2
// Research Software Only · Not for Clinical Use · No PHI
// =============================================================

import { useState, useEffect, useCallback } from "react";

// ── Configuration ──────────────────────────────────────────────────
constSPREADSHEET_ID = "1otqhLeWFt5W-hUGOE3KbZiGFqCHL6rDAIyJ2DxJBcDc";
const N8N_MCP_URL    = "https://testbed999.app.n8n.cloud/mcp-server/http";
const WARNING_DAYS   = 7;
const STAGE_LABELS   = ["Stage 1","Stage 2","Stage 3","Stage 4","Stage 5"];