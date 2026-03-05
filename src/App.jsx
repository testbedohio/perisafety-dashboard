// =============================================================
// PERIOPERATIVE SAFETY PROGRAM — DEPLOYMENT DASHBOARD  v2
// Research Software Only · Not for Clinical Use · No PHI
// =============================================================

import { useState, useEffect, useCallback } from "react";

// ── Configuration ─────────────────────────────────────────────
const SPREADSHEET_ID = "1otqhLeWFt5W-hUGOE3KbZiGFqCHL6rDAIyJ2DxJBcDc";
const N8N_MCP_URL    = "https://testbed999.app.n8n.cloud/mcp-server/http";
const WARNING_DAYS   = 7;
const STAGE_LABELS   = ["Stage 1","Stage 2","Stage 3","Stage 4","Stage 5"];

// Maps "Stage_1", "stage 3", "Stage3", "3" → integer 1–5 (or 0 if unknown)
function parseStageNum(val) {
  if (!val) return 0;
  const m = String(val).toLowerCase().match(/(\d)/);
  if (!m) return 0;
  const n = parseInt(m[1]);
  return (n >= 1 && n <= 5) ? n : 0;
}

// ── Color Palette ─────────────────────────────────────────────
const C = {
  bg:          "#06080f",
  surface:     "#0b0f1c",
  card:        "#101626",
  border:      "#1a2540",
  borderBright:"#263660",
  accent:      "#00d4b4",
  text:        "#c4d6ef",
  textDim:     "#4f6a8a",
  textMid:     "#8099b8",
  warning:     "#f59e0b",
  danger:      "#ef4444",
  success:     "#22c55e",
  input:       "#0d1424",
  stages:      ["#38bdf8","#818cf8","#34d399","#fb923c","#f472b6"],
};

// ── Utilities ─────────────────────────────────────────────────
function daysUntil(ds) {
  if (!ds) return null;
  const due = new Date(ds); if (isNaN(due)) return null;
  const now = new Date(); now.setHours(0,0,0,0); due.setHours(0,0,0,0);
  return Math.round((due - now) / 86400000);
}
function fmtDate(ds) {
  if (!ds) return "—";
  const d = new Date(ds); if (isNaN(d)) return String(ds);
  return d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
}
function todayISO() { return new Date().toISOString().split("T")[0]; }
function genId() { return "TASK-" + Date.now().toString(36).toUpperCase().slice(-6); }

// ── API layer ─────────────────────────────────────────────────
async function callClaude(system, userMsg) {
  const res = await fetch("/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      system,
      messages: [{ role:"user", content: userMsg }],
      mcp_servers: [{ type:"url", url: N8N_MCP_URL, name:"n8n" }],
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message||"API error");
  return data;
}

async function fetchSheetData(sheetName) {
  const data = await callClaude(
    `You are a silent data retrieval agent. Use Google Sheets tools to read spreadsheet ID: ${SPREADSHEET_ID}. ` +
    `CRITICAL: Your response must contain ONLY a JSON array — no words before or after it, no markdown code fences, no explanation. ` +
    `Start your response with [ and end with ]. Example: [{"Col":"Val"},{"Col":"Val2"}]`,
    `Read every row from the "${sheetName}" sheet and return as a JSON array. Remember: output the raw JSON array only.`
  );

  const raw = (data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("");
  return extractJSON(raw, sheetName);
}

function extractJSON(raw, label="data") {
  let s = raw.replace(/```json\s*/gi,"").replace(/```\s*/g,"").trim();
  try { return JSON.parse(s); } catch(_) {}
  let best = null;
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== "[") continue;
    let depth = 0, inStr = false, escape = false;
    for (let j = i; j < s.length; j++) {
      const ch = s[j];
      if (escape)          { escape = false; continue; }
      if (ch === "\\" && inStr) { escape = true; continue; }
      if (ch === '"')      { inStr = !inStr; continue; }
      if (inStr)           continue;
      if (ch === "[" || ch === "{") depth++;
      if (ch === "]" || ch === "}") depth--;
      if (depth === 0) {
        const candidate = s.slice(i, j+1);
        try {
          const parsed = JSON.parse(candidate);
          if (Array.isArray(parsed)) best = parsed;
        } catch(_) {}
        break;
      }
    }
    if (best) break;
  }
  if (best) return best;
  console.warn(`[${label}] Could not extract JSON from response:`, raw.slice(0,300));
  return [];
}

async function appendTask(task) {
  await callClaude(
    `You are a silent write agent. Append one row to the TaskTracker sheet of spreadsheet ID: ${SPREADSHEET_ID}. Reply only "ok".`,
    `Append this row: ${JSON.stringify(task)}`
  );
}

async function updateTask(task) {
  await callClaude(
    `You are a silent write agent. In spreadsheet ID: ${SPREADSHEET_ID}, update the TaskTracker row where Task_ID = "${task.Task_ID}". Reply only "ok".`,
    `Update with these values: ${JSON.stringify(task)}`
  );
}

function DisclaimerModal({ onAccept }) {
  return (
    <Overlay zIndex={2000}>
      <ModalBox border={C.danger} glow={C.danger} maxWidth={540}>
        <div style={{background:C.danger,padding:"10px 24px",display:"flex",gap:10,alignItems:"center"}}>
          <span style={{fontSize:18}}>⚠️</span>
          <Mono style={{color:"#fff",fontWeight:800,fontSize:13,letterSpacing:"0.15em"}}>IMPORTANT NOTICE</Mono>
        </div>
        <div style={{padding:"28px 28px 0"}}>
          <h2 style={{color:"#fff",fontSize:21,fontWeight:800,margin:"0 0 6px"}}>Research Software Only</h2>
          <p style={{color:C.textMid,fontSize:13,margin:"0 0 20px",lineHeight:1.5}}>Please read and acknowledge before continuing.</p>
          {[["⚕️","RESEARCH USE ONLY","This application is for research administration only. It must not support, inform, or replace clinical decisions or direct patient care."],["🔒","NOT HIPAA CERTIFIED","This software has not been evaluated or certified for HIPAA-protected data."],["🚫","NO PHI PERMITTED","Protected Health Information must not be entered, stored, or transmitted on this system."]].map(([icon,title,body])=>(
            <div key={title} style={{background:C.card,borderRadius:8,padding:"12px 16px",marginBottom:10,borderLeft:`3px solid ${C.danger}`,display:"flex",gap:12}}>
              <span style={{fontSize:18,flexShrink:0,marginTop:1}}>{icon}</span>
              <div><Mono style={{color:C.danger,fontSize:10,fontWeight:800,letterSpacing:"0.14em",marginBottom:4}}>{title}</Mono><div style={{color:C.text,fontSize:13,lineHeight:1.55}}>{body}</div></div>
            </div>
          ))}
        </div>
        <div style={{padding:28}}><Btn onClick={onAccept} color={C.accent} textColor="#000" style={{width:"100%",padding:"14px",fontSize:13}}>I UNDERSTAND — ENTER APPLICATION</Btn></div>
      </ModalBox>
    </Overlay>
  );
}

function TaskAlertModal({ tasks, onClose }) {
  const overdue=tasks.filter(t=>{const d=daysUntil(t.Due_Date);return d!==null&&d<0;});
  const upcoming=tasks.filter(t=>{const d=daysUntil(t.Due_Date);return d!==null&&d>=0&&d<=WARNING_DAYS;});
  const col=overdue.length?C.danger:C.warning;
  return (
    <Overlay zIndex={1500}>
      <ModalBox border={col} glow={col} maxWidth={580} maxHeight="80vh">
        <div style={{padding:"18px 22px",borderBottom:`1px solid ${C.border}`,background:C.card,borderRadius:"12px 12px 0 0",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:26}}>{overdue.length?"🚨":"⏰"}</span>
            <div><div style={{color:"#fff",fontWeight:700,fontSize:16}}>Task Alerts</div><div style={{color:C.textDim,fontSize:12,marginTop:2}}>{overdue.length} overdue · {upcoming.length} due within {WARNING_DAYS} days</div></div>
          </div>
          <CloseBtn onClick={onClose}/>
        </div>
        <div style={{padding:"18px 22px",overflowY:"auto",flex:1}}>
          {overdue.length>0&&<><SectionLabel color={C.danger}>OVERDUE TASKS</SectionLabel>{overdue.map((t,i)=><AlertCard key={i} task={t} isOverdue/>)}</>}
          {upcoming.length>0&&<><SectionLabel color={C.warning} mt={overdue.length?18:0}>APPROACHING DUE DATE</SectionLabel>{upcoming.map((t,i)=><AlertCard key={i} task={t}/>)}</>}
        </div>
        <div style={{padding:"16px 22px",borderTop:`1px solid ${C.border}`,flexShrink:0}}><Btn onClick={onClose} style={{width:"100%",padding:"12px"}}>DISMISS ALERTS</Btn></div>
      </ModalBox>
    </Overlay>
  );
}

function AlertCard({ task, isOverdue }) {
  const days=daysUntil(task.Due_Date); const col=isOverdue?C.danger:C.warning;
  return (<div style={{background:C.card,borderRadius:8,padding:"12px 16px",marginBottom:8,borderLeft:`3px solid ${col}`}}><div style={{display:"flex",justifyContent:"space-between",gap:12}}><div style={{flex:1}}><div style={{color:"#fff",fontSize:14,marginBottom:5,lineHeight:1.4}}>{task.Task_Description||task.Task_ID||"Unnamed Task"}</div><div style={{display:"flex",gap:14,flexWrap:"wrap"}}>{task.Assigned_To&&<Meta>👤 {task.Assigned_To}</Meta>}{task.Clinic_Ref&&<Meta>🏥 {task.Clinic_Ref}</Meta>}{task.Priority&&<Meta>⚑ {task.Priority}</Meta>}</div></div><div style={{textAlign:"right",flexShrink:0}}><div style={{color:col,fontWeight:700,fontSize:14,fontFamily:"monospace"}}>{isOverdue?`${Math.abs(days)}d overdue`:days===0?"Due today":`${days}d left`}</div><div style={{color:C.textDim,fontSize:11,marginTop:2}}>{fmtDate(task.Due_Date)}</div></div></div></div>);
}

const BLANK={Task_ID:"",Task_Description:"",Due_Date:"",Assigned_To:"",Status:"Pending",Priority:"Medium",Clinic_Ref:"",Notes:""};

function TaskFormModal({ initial, clinics, onSave, onClose, saving }) {
  const isNew=!initial?.Task_ID;
  const [form,setForm]=useState(()=>({...BLANK,...(initial||{}),Task_ID:initial?.Task_ID||genId(),Task_Creation:initial?.Task_Creation||todayISO()}));
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const iSx={width:"100%",background:C.input,border:`1px solid ${C.border}`,borderRadius:6,padding:"9px 12px",color:C.text,fontSize:13,fontFamily:"'DM Sans',system-ui,sans-serif",outline:"none"};
  const lSx={display:"block",color:C.textMid,fontSize:11,letterSpacing:"0.1em",marginBottom:5,fontFamily:"monospace"};
  const clinicOptions=clinics.map(c=>c.Clinic_Ref||c.Clinic_Name).filter(Boolean);
  const canSave=form.Task_Description.trim().length>0;
  return (
    <Overlay zIndex={1800}>
      <ModalBox border={C.borderBright} glow="rgba(0,212,180,0.1)" maxWidth={540} maxHeight="90vh">
        <div style={{padding:"18px 22px",borderBottom:`1px solid ${C.border}`,background:C.card,borderRadius:"12px 12px 0 0",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div><div style={{color:"#fff",fontWeight:700,fontSize:16}}>{isNew?"➕  New Task":"✏️  Edit Task"}</div><Mono style={{color:C.textDim,fontSize:11,marginTop:2}}>ID: {form.Task_ID}</Mono></div>
          <CloseBtn onClick={onClose}/>
        </div>
        <div style={{padding:22,overflowY:"auto",flex:1,display:"flex",flexDirection:"column",gap:16}}>
          <div><label style={lSx}>TASK DESCRIPTION *</label><textarea value={form.Task_Description} onChange={e=>set("Task_Description",e.target.value)} rows={3} placeholder="Describe the task…" style={{...iSx,resize:"vertical",lineHeight:1.5}}/></div>
          <TwoCol><div><label style={lSx}>DUE DATE</label><input type="date" value={form.Due_Date} onChange={e=>set("Due_Date",e.target.value)} style={{...iSx,colorScheme:"dark"}}/></div><div><label style={lSx}>PRIORITY</label><select value={form.Priority} onChange={e=>set("Priority",e.target.value)} style={{...iSx,cursor:"pointer"}}>{["Low","Medium","High","Critical"].map(p=><option key={p}>{p}</option>)}</select></div></TwoCol>
          <TwoCol><div><label style={lSx}>ASSIGNED TO</label><input type="text" value={form.Assigned_To} onChange={e=>set("Assigned_To",e.target.value)} placeholder="Name or role…" style={iSx}/></div><div><label style={lSx}>STATUS</label><select value={form.Status} onChange={e=>set("Status",e.target.value)} style={{...iSx,cursor:"pointer"}}>{["Pending","In Progress","Blocked","Complete"].map(s=><option key={s}>{s}</option>)}</select></div></TwoCol>
          <div><label style={lSx}>LINKED CLINIC (optional)</label><select value={form.Clinic_Ref} onChange={e=>set("Clinic_Ref",e.target.value)} style={{...iSx,cursor:"pointer"}}><option value="">— Not linked to a specific clinic —</option>{clinicOptions.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          <div><label style={lSx}>NOTES (optional)</label><textarea value={form.Notes||""} onChange={e=>set("Notes",e.target.value)} rows={2} placeholder="Any additional context…" style={{...iSx,resize:"vertical",lineHeight:1.5}}/></div>
          <div style={{background:"#1a0808",border:`1px solid ${C.danger}33`,borderRadius:6,padding:"8px 12px",color:C.danger,fontSize:11,lineHeight:1.5,fontFamily:"monospace"}}>⚠ Do not enter Protected Health Information. Research IDs only.</div>
        </div>
        <div style={{padding:"16px 22px",borderTop:`1px solid ${C.border}`,display:"flex",gap:10,justifyContent:"flex-end",flexShrink:0}}>
          <Btn onClick={onClose} disabled={saving} style={{padding:"10px 20px"}}>Cancel</Btn>
          <Btn onClick={()=>onSave({...form,Task_Modified:todayISO()})} disabled={saving||!canSave} color={canSave&&!saving?C.accent:C.card} textColor={canSave&&!saving?"#000":C.textDim} glow={canSave&&!saving} style={{padding:"10px 22px",fontWeight:700,fontSize:13}}>{saving?"SAVING…":isNew?"CREATE TASK":"SAVE CHANGES"}</Btn>
        </div>
      </ModalBox>
    </Overlay>
  );
}

function GanttChart({ clinics }) {
  if (!clinics||!clinics.length) return <div style={{textAlign:"center",padding:"48px 24px",color:C.textDim,fontSize:14}}>No clinic data found. Check your Google Sheet and refresh.</div>;
  return (
    <div style={{overflowX:"auto"}}>
      <div style={{display:"grid",gridTemplateColumns:"210px repeat(5,1fr)",gap:6,marginBottom:10,padding:"0 2px"}}>
        <Mono style={{color:C.textDim,fontSize:10,letterSpacing:"0.14em",paddingLeft:4}}>SITE</Mono>
        {STAGE_LABELS.map((l,i)=>(<Mono key={i} style={{textAlign:"center",fontSize:10,letterSpacing:"0.1em",color:C.stages[i],fontWeight:700}}>{l.toUpperCase()}</Mono>))}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:5}}>
        {clinics.map((clinic,idx)=>{
          const stageNum=parseStageNum(clinic.Deployment_Stage);
          const name=clinic.Clinic_Name||clinic.Clinic_Ref||`Clinic ${idx+1}`;
          return (<div key={idx} style={{display:"grid",gridTemplateColumns:"210px repeat(5,1fr)",gap:6,alignItems:"center"}}>
            <div title={name} style={{color:stageNum?C.text:C.textDim,fontSize:13,fontFamily:"monospace",paddingLeft:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",paddingRight:8}}>{name}</div>
            {[1,2,3,4,5].map(s=>{
              const i=s-1; const status=!stageNum?"idle":s<stageNum?"complete":s===stageNum?"active":"pending"; const base=C.stages[i];
              return (<div key={s} style={{height:34,borderRadius:5,transition:"all 0.2s",background:status==="complete"?base+"55":status==="active"?base+"22":C.card,border:`1px solid ${status==="complete"?base+"90":status==="active"?base:C.border}`,boxShadow:status==="active"?`0 0 14px ${base}60,inset 0 0 6px ${base}30`:"none",display:"flex",alignItems:"center",justifyContent:"center"}}>
                {status==="complete"&&<span style={{color:base,fontSize:14,fontWeight:700}}>✓</span>}
                {status==="active"&&<Mono style={{color:base,fontSize:10,fontWeight:800,letterSpacing:"0.12em"}}>ACTIVE</Mono>}
                {status==="pending"&&<span style={{color:C.border,fontSize:10}}>·</span>}
              </div>);
            })}
          </div>);
        })}
      </div>
    </div>
  );
}

const STATUS_OPTIONS=["All","Pending","In Progress","Blocked","Complete"];
const PRIORITY_COLORS={Low:C.textDim,Medium:C.warning,High:C.danger,Critical:"#e040fb"};
const STATUS_STYLES={"Pending":{bg:"#1a2540",color:C.textMid,border:C.border},"In Progress":{bg:"#0f1e35",color:"#38bdf8",border:"#38bdf880"},"Blocked":{bg:"#1a0f0f",color:C.danger,border:C.danger+"80"},"Complete":{bg:"#0a1a0f",color:C.success,border:C.success+"80"}};

function TaskList({ tasks, clinics, onNew, onEdit }) {
  const [filter,setFilter]=useState("All"); const [search,setSearch]=useState("");
  const shown=tasks.filter(t=>filter==="All"||t.Status===filter).filter(t=>{if(!search)return true;const q=search.toLowerCase();return[t.Task_Description,t.Assigned_To,t.Clinic_Ref,t.Task_ID].some(v=>(v||"").toLowerCase().includes(q));}).sort((a,b)=>(daysUntil(a.Due_Date)??9999)-(daysUntil(b.Due_Date)??9999));
  if(!tasks.length) return (<div style={{textAlign:"center",padding:"48px 24px"}}><div style={{fontSize:36,marginBottom:12}}>📋</div><div style={{color:"#fff",fontSize:15,fontWeight:600,marginBottom:8}}>No tasks yet</div><div style={{color:C.textDim,fontSize:13,marginBottom:24,lineHeight:1.6}}>Create your first task using the button above.<br/>It will be saved directly to your Google Sheet.</div><Btn onClick={onNew} color={C.accent} textColor="#000" glow style={{padding:"12px 28px",fontSize:13}}>➕  CREATE FIRST TASK</Btn></div>);
  return (
    <div>
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tasks…" style={{flex:1,minWidth:160,background:C.input,border:`1px solid ${C.border}`,borderRadius:6,padding:"8px 12px",color:C.text,fontSize:13,outline:"none",fontFamily:"inherit"}}/>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{STATUS_OPTIONS.map(f=>(<button key={f} onClick={()=>setFilter(f)} style={{padding:"6px 12px",borderRadius:6,fontSize:11,fontFamily:"monospace",fontWeight:700,cursor:"pointer",transition:"all 0.15s",border:`1px solid ${filter===f?C.accent:C.border}`,background:filter===f?"rgba(0,212,180,0.12)":C.card,color:filter===f?C.accent:C.textDim}}>{f.toUpperCase()}</button>))}</div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {shown.length===0?<div style={{textAlign:"center",padding:"32px 0",color:C.textDim,fontSize:13}}>No tasks match your filter.</div>:shown.map((task,i)=>{
          const days=daysUntil(task.Due_Date); const isDone=task.Status==="Complete"; const isOverdue=!isDone&&days!==null&&days<0; const isWarn=!isDone&&days!==null&&days>=0&&days<=WARNING_DAYS; const edgeColor=isDone?C.success:isOverdue?C.danger:isWarn?C.warning:C.border; const ss=STATUS_STYLES[task.Status]||STATUS_STYLES["Pending"];
          return (<div key={task.Task_ID||i} style={{background:C.card,borderRadius:8,padding:"12px 16px",border:`1px solid ${edgeColor}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,opacity:isDone?0.65:1,transition:"all 0.15s"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>{task.Priority&&<span style={{color:PRIORITY_COLORS[task.Priority]||C.textDim,fontSize:12}} title={task.Priority}>⚑</span>}<span style={{color:isDone?C.textMid:"#fff",fontSize:14,lineHeight:1.4,textDecoration:isDone?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.Task_Description||"Unnamed Task"}</span></div>
              <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>{task.Task_ID&&<Mono style={{color:C.textDim,fontSize:11}}>#{task.Task_ID}</Mono>}{task.Assigned_To&&<Meta>👤 {task.Assigned_To}</Meta>}{task.Clinic_Ref&&<Meta>🏥 {task.Clinic_Ref}</Meta>}<span style={{background:ss.bg,color:ss.color,border:`1px solid ${ss.border}`,borderRadius:4,padding:"2px 8px",fontSize:10,fontFamily:"monospace",fontWeight:700,letterSpacing:"0.1em"}}>{(task.Status||"PENDING").toUpperCase()}</span></div>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}}>
              {task.Due_Date&&<div style={{textAlign:"right"}}><Mono style={{color:isDone?C.textDim:edgeColor,fontSize:12}}>{fmtDate(task.Due_Date)}</Mono>{days!==null&&!isDone&&<Mono style={{color:edgeColor,fontSize:10,marginTop:2}}>{isOverdue?`${Math.abs(days)}d overdue`:days===0?"Due today":`${days}d left`}</Mono>}</div>}
              <button onClick={()=>onEdit(task)} style={{padding:"5px 12px",background:"transparent",border:`1px solid ${C.border}`,color:C.textMid,borderRadius:5,cursor:"pointer",fontSize:11,fontFamily:"monospace",letterSpacing:"0.06em",transition:"all 0.15s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.color=C.accent;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.textMid;}}>EDIT</button>
            </div>
          </div>);
        })}
      </div>
    </div>
  );
}

function Toast({ message, type, onDone }) {
  useEffect(()=>{const t=setTimeout(onDone,3500);return()=>clearTimeout(t);},[onDone]);
  const col=type==="error"?C.danger:C.success;
  return (<div style={{position:"fixed",bottom:28,right:28,zIndex:3000,background:C.card,border:`1px solid ${col}`,borderRadius:10,padding:"12px 20px",color:col,fontSize:13,fontFamily:"monospace",boxShadow:`0 0 20px ${col}40,0 8px 30px rgba(0,0,0,0.5)`,maxWidth:340,lineHeight:1.5,animation:"fadeIn 0.2s ease"}}>{type==="error"?"⚠ ":"✓ "}{message}</div>);
}

function Overlay({children,zIndex}){return(<div style={{position:"fixed",inset:0,zIndex,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(5px)"}}>{children}</div>);}
function ModalBox({children,border,glow,maxWidth=540,maxHeight="92vh"}){return(<div style={{background:C.surface,border:`1.5px solid ${border}`,borderRadius:14,maxWidth,width:"94%",maxHeight,display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:`0 0 50px ${glow},0 32px 80px rgba(0,0,0,0.7)`}}>{children}</div>);}
function Btn({children,onClick,disabled,color,textColor="#fff",glow,style={}}){const base={padding:"9px 16px",background:disabled?"transparent":(color||"transparent"),color:disabled?C.textDim:textColor,border:disabled?`1px solid ${C.border}`:`1px solid ${color||C.border}`,borderRadius:8,cursor:disabled?"not-allowed":"pointer",fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:700,letterSpacing:"0.06em",transition:"all 0.2s",boxShadow:(!disabled&&glow&&color)?`0 0 14px ${color}50`:"none",...style};return <button onClick={!disabled?onClick:undefined} style={base}>{children}</button>;}
function Mono({children,style={}}){return<span style={{fontFamily:"'JetBrains Mono',monospace",...style}}>{children}</span>;}
function Meta({children}){return<span style={{color:C.textMid,fontSize:12}}>{children}</span>;}
function SectionLabel({children,color,mt=0}){return<Mono style={{color,fontSize:10,fontWeight:800,letterSpacing:"0.14em",marginBottom:8,marginTop:mt,display:"block"}}>{children}</Mono>;}
function CloseBtn({onClick}){return<button onClick={onClick} style={{background:"transparent",border:"none",color:C.textDim,cursor:"pointer",fontSize:22,padding:"4px 8px",lineHeight:1}}>✕</button>;}
function TwoCol({children}){return<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>{children}</div>;}
function StatCard({value,label,color}){return(<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 18px",textAlign:"center",minWidth:70}}><div style={{color,fontSize:22,fontWeight:800,fontFamily:"monospace"}}>{value}</div><div style={{color:C.textDim,fontSize:10,letterSpacing:"0.12em",marginTop:2}}>{label}</div></div>);}

export default function App() {
  const [clinics,setClinics]=useState([]); const [tasks,setTasks]=useState([]); const [loading,setLoading]=useState(true); const [error,setError]=useState(null); const [showDisclaimer,setShowDisclaimer]=useState(true); const [showAlerts,setShowAlerts]=useState(false); const [alertTasks,setAlertTasks]=useState([]); const [lastRefresh,setLastRefresh]=useState(null); const [activeTab,setActiveTab]=useState("gantt"); const [taskForm,setTaskForm]=useState(null); const [saving,setSaving]=useState(false); const [toast,setToast]=useState(null);

  useEffect(()=>{const s=document.createElement("style");s.textContent=`@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap');*{box-sizing:border-box;margin:0;padding:0;}body{background:${C.bg};}::-webkit-scrollbar{width:6px;height:6px;}::-webkit-scrollbar-track{background:${C.surface};}::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px;}input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.5);}@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`;document.head.appendChild(s);return()=>document.head.removeChild(s);},[]);

  const loadData=useCallback(async()=>{setLoading(true);setError(null);try{const[cd,td]=await Promise.all([fetchSheetData("Clinics"),fetchSheetData("TaskTracker")]);setClinics(cd||[]);setTasks(td||[]);setLastRefresh(new Date());const alerts=(td||[]).filter(t=>{if(!t.Due_Date||t.Status==="Complete")return false;const d=daysUntil(t.Due_Date);return d!==null&&d<=WARNING_DAYS;});setAlertTasks(alerts);if(alerts.length)setShowAlerts(true);}catch(err){setError(err.message);}finally{setLoading(false);}},[]);
  useEffect(()=>{loadData();},[loadData]);

  const handleSave=useCallback(async(formData)=>{setSaving(true);const isNew=!tasks.some(t=>t.Task_ID===formData.Task_ID);try{if(isNew){await appendTask(formData);setTasks(p=>[...p,formData]);setToast({message:"Task created and saved to Google Sheets.",type:"success"});}else{await updateTask(formData);setTasks(p=>p.map(t=>t.Task_ID===formData.Task_ID?formData:t));setToast({message:"Task updated in Google Sheets.",type:"success"});}setTaskForm(null);}catch(err){setToast({message:"Save failed: "+err.message,type:"error"});}finally{setSaving(false);}},[tasks]);

  const totalSites=clinics.length; const activeSites=clinics.filter(c=>{const s=parseStageNum(c.Deployment_Stage);return s>0&&s<5;}).length; const completeSites=clinics.filter(c=>parseStageNum(c.Deployment_Stage)===5).length; const pendingCount=tasks.filter(t=>t.Status!=="Complete").length;

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'DM Sans',system-ui,sans-serif",padding:"24px",maxWidth:1100,margin:"0 auto"}}>
      {showDisclaimer&&<DisclaimerModal onAccept={()=>{setShowDisclaimer(false);if(alertTasks.length)setShowAlerts(true);}}/>}
      {showAlerts&&!showDisclaimer&&<TaskAlertModal tasks={alertTasks} onClose={()=>setShowAlerts(false)}/>}
      {taskForm!==null&&<TaskFormModal initial={taskForm===true?null:taskForm} clinics={clinics} onSave={handleSave} onClose={()=>setTaskForm(null)} saving={saving}/>}
      {toast&&<Toast message={toast.message} type={toast.type} onDone={()=>setToast(null)}/>}
      <div style={{marginBottom:28}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:16,marginBottom:20}}>
          <div><Mono style={{fontSize:10,letterSpacing:"0.2em",color:C.accent,fontWeight:700,marginBottom:8,display:"block"}}>PERIOPERATIVE SAFETY INTERVENTION PROGRAM</Mono><h1 style={{fontSize:26,fontWeight:700,color:"#fff",letterSpacing:"-0.03em",marginBottom:4}}>Deployment Dashboard</h1><Mono style={{color:C.textDim,fontSize:12}}>{lastRefresh?`↻ refreshed ${lastRefresh.toLocaleTimeString()}`:"loading data…"}</Mono></div>
          <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
            <StatCard value={totalSites} label="SITES" color={C.text}/><StatCard value={activeSites} label="ACTIVE" color={C.accent}/><StatCard value={completeSites} label="COMPLETE" color={C.success}/><StatCard value={pendingCount} label="TASKS" color={alertTasks.length?C.danger:C.textMid}/>
            {alertTasks.length>0&&<Btn onClick={()=>setShowAlerts(true)} color={C.danger} textColor={C.danger} style={{padding:"10px 14px"}}>🚨 {alertTasks.length} ALERT{alertTasks.length!==1?"S":""}</Btn>}
            <Btn onClick={loadData} disabled={loading} color={C.accent} textColor="#000" glow={!loading} style={{padding:"10px 20px"}}>{loading?"LOADING…":"↻ REFRESH"}</Btn>
          </div>
        </div>
        <div style={{display:"flex",gap:4,borderBottom:`1px solid ${C.border}`}}>{[{id:"gantt",label:"📊  Deployment Gantt"},{id:"tasks",label:"📋  Task Tracker"}].map(tab=>(<button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{padding:"8px 18px",background:"transparent",border:"none",cursor:"pointer",fontSize:13,fontWeight:600,color:activeTab===tab.id?C.accent:C.textDim,borderBottom:activeTab===tab.id?`2px solid ${C.accent}`:"2px solid transparent",marginBottom:"-1px",transition:"all 0.15s"}}>{tab.label}</button>))}</div>
      </div>
      {error&&<div style={{background:"#1a0808",border:`1px solid ${C.danger}`,borderRadius:8,padding:"12px 16px",marginBottom:20,color:C.danger,fontSize:13,fontFamily:"monospace"}}>⚠ {error}<button onClick={loadData} style={{marginLeft:16,background:"transparent",border:`1px solid ${C.danger}`,color:C.danger,borderRadius:4,padding:"2px 10px",cursor:"pointer",fontSize:12}}>Retry</button></div>}
      <div style={{background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,overflow:"hidden"}}>
        <div style={{padding:"16px 24px",borderBottom:`1px solid ${C.border}`,background:C.card,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
          {activeTab==="gantt"?(<><div><div style={{color:"#fff",fontWeight:700,fontSize:15,marginBottom:3}}>Clinic Deployment Progress</div><div style={{color:C.textDim,fontSize:12}}>{totalSites} participating sites · 5 deployment stages</div></div><div style={{display:"flex",gap:16,flexWrap:"wrap"}}>{[["Complete",C.stages[0]+"55",C.stages[0]+"90"],["Active",C.stages[1]+"22",C.stages[1]],["Pending",C.card,C.border]].map(([l,bg,b])=>(<div key={l} style={{display:"flex",alignItems:"center",gap:7}}><div style={{width:18,height:14,borderRadius:3,background:bg,border:`1px solid ${b}`}}/><span style={{color:C.textMid,fontSize:12}}>{l}</span></div>))}</div></>):(<><div><div style={{color:"#fff",fontWeight:700,fontSize:15,marginBottom:3}}>Task Tracker</div><div style={{color:C.textDim,fontSize:12}}>{tasks.length} total · {pendingCount} pending{alertTasks.length>0&&<span style={{color:C.danger,marginLeft:8}}>· {alertTasks.length} need attention</span>}</div></div><Btn onClick={()=>setTaskForm(true)} color={C.accent} textColor="#000" glow style={{padding:"9px 18px",fontSize:12}}>➕  NEW TASK</Btn></>)}
        </div>
        <div style={{padding:24}}>{loading?(<div style={{textAlign:"center",padding:"56px 24px",color:C.textDim}}><Mono style={{fontSize:28,marginBottom:12,display:"block"}}>◌</Mono><div style={{fontSize:13}}>Fetching data from Google Sheets…</div></div>):activeTab==="gantt"?(<GanttChart clinics={clinics}/>):(<TaskList tasks={tasks} clinics={clinics} onNew={()=>setTaskForm(true)} onEdit={t=>setTaskForm(t)}/>)}</div>
      </div>
      <div style={{marginTop:20,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}><Mono style={{color:C.textDim,fontSize:10,letterSpacing:"0.1em"}}>⚠ RESEARCH SOFTWARE ONLY · NOT FOR CLINICAL USE · NO PHI</Mono><Mono style={{color:C.textDim,fontSize:10}}>DB: Main_DB · {new Date().toLocaleDateString()}</Mono></div>
    </div>
  );
}
