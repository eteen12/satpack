#!/usr/bin/env node

// mcp/server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createReadStream, createWriteStream, existsSync, mkdirSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { createInterface } from "readline";
var SATPACK_URL = process.env.SATPACK_URL ?? "http://localhost:3000";
var COINOS_TOKEN = process.env.COINOS_TOKEN ?? "";
var OPENCLAW_DIR = join(homedir(), ".openclaw");
var CSV_PATH = join(OPENCLAW_DIR, "hire_outreach.csv");
var CSV_FIELDS = [
  "id",
  "business_name",
  "website",
  "email",
  "phone",
  "address",
  "draft_subject",
  "task",
  "collected_at",
  "sent_at",
  "status"
];
function ensureCsv() {
  if (!existsSync(OPENCLAW_DIR)) mkdirSync(OPENCLAW_DIR, { recursive: true });
  if (!existsSync(CSV_PATH)) {
    writeFileSync(CSV_PATH, CSV_FIELDS.join(",") + "\n");
  }
}
async function loadCsv() {
  ensureCsv();
  const rows = [];
  const rl = createInterface({ input: createReadStream(CSV_PATH), crlfDelay: Infinity });
  let header = true;
  for await (const line of rl) {
    if (header) {
      header = false;
      continue;
    }
    if (!line.trim()) continue;
    const [id, business_name, website, email, phone, address, draft_subject, task, collected_at, sent_at, status] = parseCsvLine(line);
    rows.push({ id, business_name, website, email, phone, address, draft_subject, task, collected_at, sent_at, status });
  }
  return rows;
}
function parseCsvLine(line) {
  const result = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuote = !inQuote;
    } else if (ch === "," && !inQuote) {
      result.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}
function escapeCsv(v) {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
async function appendRows(newRows) {
  ensureCsv();
  const ws = createWriteStream(CSV_PATH, { flags: "a" });
  for (const row of newRows) {
    const line = CSV_FIELDS.map((f) => escapeCsv(row[f] ?? "")).join(",");
    ws.write(line + "\n");
  }
  await new Promise((res, rej) => ws.end((err) => err ? rej(err) : res()));
}
function nextId(rows) {
  if (rows.length === 0) return 1;
  return Math.max(...rows.map((r) => parseInt(r.id, 10) || 0)) + 1;
}
async function runHire(task) {
  const body = JSON.stringify({ task });
  const headers = { "Content-Type": "application/json" };
  const r1 = await fetch(`${SATPACK_URL}/api/v1/hire`, { method: "POST", headers, body });
  if (r1.status !== 402) {
    const text = await r1.text();
    throw new Error(`expected 402 from hire endpoint, got ${r1.status}: ${text.slice(0, 200)}`);
  }
  const payReq = await r1.json();
  if (!payReq.macaroon || !payReq.invoice) {
    throw new Error(`402 response missing macaroon or invoice: ${JSON.stringify(payReq)}`);
  }
  if (!COINOS_TOKEN) throw new Error("COINOS_TOKEN env var not set \u2014 cannot pay invoice");
  const coinosRes = await fetch("https://coinos.io/api/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${COINOS_TOKEN}` },
    body: JSON.stringify({ payreq: payReq.invoice })
  });
  if (!coinosRes.ok) {
    const text = await coinosRes.text();
    throw new Error(`Coinos payment failed (${coinosRes.status}): ${text.slice(0, 200)}`);
  }
  const payment = await coinosRes.json();
  const preimage = payment.preimage ?? payment.ref;
  if (!preimage) {
    throw new Error(`Coinos payment response missing preimage: ${JSON.stringify(payment)}`);
  }
  const r2 = await fetch(`${SATPACK_URL}/api/v1/hire`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `L402 ${payReq.macaroon}:${preimage}`
    },
    body
  });
  if (!r2.ok) {
    const text = await r2.text();
    throw new Error(`hire endpoint returned ${r2.status} after payment: ${text.slice(0, 200)}`);
  }
  const result = await r2.json();
  if (result.error) throw new Error(result.error);
  return {
    leads: result.leads ?? [],
    summary: result.summary ?? "",
    total_sats: result.total_sats ?? 0
  };
}
var server = new Server(
  { name: "satpack", version: "1.0.0" },
  { capabilities: { tools: {} } }
);
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "hire_outreach_agent",
      description: "Hire a cold outreach agent. Give it a task in plain English \u2014 e.g. 'find 5 landscapers in Kelowna and pitch my web design services'. The agent searches Google Places, scrapes contact emails, validates deliverability, and drafts personalized outreach emails. Results are appended to ~/.openclaw/hire_outreach.csv for tracking. Already-contacted emails (status=sent) are excluded from future runs. Returns verified leads with draft emails ready to send.",
      inputSchema: {
        type: "object",
        properties: {
          task: {
            type: "string",
            description: "Plain-English outreach task. Include target industry, city, and your pitch. Example: 'find 5 landscapers in Kelowna and pitch my web design services'"
          }
        },
        required: ["task"]
      }
    }
  ]
}));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "hire_outreach_agent") {
    throw new Error(`unknown tool: ${request.params.name}`);
  }
  const { task } = request.params.arguments;
  if (!task?.trim()) {
    throw new Error("task is required and must be a non-empty string");
  }
  const existing = await loadCsv();
  const sentEmails = new Set(existing.filter((r) => r.status === "sent").map((r) => r.email.toLowerCase()));
  const { leads, summary, total_sats } = await runHire(task.trim());
  const now = (/* @__PURE__ */ new Date()).toISOString();
  let id = nextId(existing);
  const newRows = [];
  for (const lead of leads) {
    if (lead.email && sentEmails.has(lead.email.toLowerCase())) continue;
    newRows.push({
      id: String(id++),
      business_name: lead.business_name,
      website: lead.website,
      email: lead.email,
      phone: lead.phone,
      address: lead.address,
      draft_subject: lead.draft_subject,
      task: task.trim(),
      collected_at: now,
      sent_at: "",
      status: "pending"
    });
  }
  if (newRows.length > 0) await appendRows(newRows);
  const result = {
    summary,
    total_sats,
    leads_found: leads.length,
    new_leads_added: newRows.length,
    skipped_already_contacted: leads.length - newRows.length,
    leads: newRows.map((r) => ({
      id: r.id,
      business_name: r.business_name,
      website: r.website,
      email: r.email,
      phone: r.phone,
      address: r.address,
      draft_subject: r.draft_subject,
      draft_body: leads.find((l) => l.email === r.email)?.draft_body ?? "",
      status: r.status
    })),
    ledger: CSV_PATH
  };
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2)
      }
    ]
  };
});
var transport = new StdioServerTransport();
server.connect(transport).catch((err) => {
  console.error("MCP server error:", err);
  process.exit(1);
});
