# PeriSafety Dashboard

**Perioperative Safety Intervention Program — Deployment Dashboard**

> ⚠️ **RESEARCH SOFTWARE ONLY** — Not for clinical use. Not HIPAA certified. PHI must not be stored on this system.

---

## What this is

A web-based dashboard for tracking the deployment of a perioperative safety intervention program across 20 participating clinic sites. It reads and writes data from a Google Sheets database via an n8n automation workflow.

---

## Features

- **Disclaimer modal** on every page load (required)
- **Task alert dialogs** for overdue tasks and tasks due within 7 days
- **Gantt-style deployment chart** showing all 20 clinics and their progress through 5 stages
- **Task Tracker** — view, search, filter, create, and edit tasks with live Google Sheets sync
- Color-coded status indicators and priority flags

---

## Tech stack

| Layer | Technology |
|---|---|
| UI framework | React 18 + Vite |
| Data source | Google Sheets (`Main_DB`) |
| Integration | Anthropic API → n8n MCP → Google Sheets |
| Language | JavaScript (JSX) |
| IDE recommended | WebStorm |

---

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- A package manager: `npm` (comes with Node) or `yarn`

### Install & run

```bash
# 1. Clone the repo
git clone https://github.com/testbedohio/perisafety-dashboard.git
cd perisafety-dashboard

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

The app will open automatically at `http://localhost:3000`.

---

## Project structure

```
perisafety-dashboard/
├── index.html          # HTML entry point
├── vite.config.js      # Vite bundler config
├── package.json        # Project dependencies
├── .gitignore
└── src/
    ├── main.jsx        # React bootstrap (do not edit)
    └── App.jsx         # ← All application code lives here
```

All application logic — components, API calls, styling — lives in **`src/App.jsx`**. As the project grows, individual components will be split into separate files under `src/`.

---

## Google Sheets structure

**Spreadsheet:** `Main_DB`
**ID:** `1otqhLeWFt5W-hUGOE3KbZiGFqCHL6rDAIyJ2DxJBcDc`

| Sheet | Purpose |
|---|---|
| `Clinics` | 20 participating sites, deployment stage, dates |
| `Clinicians` | Clinician research participants |
| `Patients` | Patient-participants (research IDs only, no PHI) |
| `Measures&Metrics` | Program monitoring data |
| `TaskTracker` | Task management with due dates and assignments |
| `Log_One/Two/Three` | Reserved |

### TaskTracker columns

`Task_ID`, `Task_Description`, `Task_Creation`, `Task_Modified`, `Created_By`, `Modified_By`, `Due_Date`, `Assigned_To`, `Status`, `Priority`, `Clinic_Ref`, `Notes`

> **Add columns G–K manually** if not already present: `Due_Date`, `Assigned_To`, `Status`, `Priority`, `Clinic_Ref`

### Clinics — Deployment_Stage values

Use the format `Stage_1` through `Stage_5` in the `Deployment_Stage` column.

---

## Data security notice

- This application contains **no PHI** and is not designed to store any
- No authentication is implemented — intended for trusted internal research team use only
- The Anthropic API key is managed externally by the Claude.ai environment
- All data is stored in Google Sheets under the research team's Google account

---

## Development notes

- The app uses the **Anthropic Messages API** (`claude-sonnet-4-20250514`) with an MCP server to talk to Google Sheets via n8n
- No direct Google Sheets API credentials are embedded in this codebase
- The n8n workflow URL: `https://testbed999.app.n8n.cloud/mcp-server/http`
