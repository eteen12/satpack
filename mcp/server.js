#!/usr/bin/env node
"use strict";

// mcp/server.ts
var import_server = require("@modelcontextprotocol/sdk/server/index.js");
var import_stdio = require("@modelcontextprotocol/sdk/server/stdio.js");
var import_types = require("@modelcontextprotocol/sdk/types.js");
var import_fs = require("fs");
var import_os = require("os");
var import_path = require("path");
var import_readline = require("readline");
var SATPACK_URL = process.env.SATPACK_URL ?? "http://localhost:3000";
var COINOS_TOKEN = process.env.COINOS_TOKEN ?? "";
var OPENCLAW_DIR = (0, import_path.join)((0, import_os.homedir)(), ".openclaw");
var CSV_PATH = (0, import_path.join)(OPENCLAW_DIR, "hire_outreach.csv");
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
  if (!(0, import_fs.existsSync)(OPENCLAW_DIR)) (0, import_fs.mkdirSync)(OPENCLAW_DIR, { recursive: true });
  if (!(0, import_fs.existsSync)(CSV_PATH)) {
    (0, import_fs.writeFileSync)(CSV_PATH, CSV_FIELDS.join(",") + "\n");
  }
}
async function loadCsv() {
  ensureCsv();
  const rows = [];
  const rl = (0, import_readline.createInterface)({ input: (0, import_fs.createReadStream)(CSV_PATH), crlfDelay: Infinity });
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
  const ws = (0, import_fs.createWriteStream)(CSV_PATH, { flags: "a" });
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
async function runL402(url, bodyJson) {
  const headers = { "Content-Type": "application/json" };
  const r1 = await fetch(url, { method: "POST", headers, body: bodyJson });
  if (r1.status !== 402) {
    const text = await r1.text();
    throw new Error(`expected 402, got ${r1.status}: ${text.slice(0, 200)}`);
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
  const r2 = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `L402 ${payReq.macaroon}:${preimage}`
    },
    body: bodyJson
  });
  if (!r2.ok) {
    const text = await r2.text();
    throw new Error(`endpoint returned ${r2.status} after payment: ${text.slice(0, 200)}`);
  }
  const result = await r2.json();
  if (result.error) throw new Error(result.error);
  return result;
}
async function runHire(task) {
  const invRes = await fetch(`${SATPACK_URL}/api/v1/hire/invoice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task })
  });
  if (!invRes.ok) {
    const text = await invRes.text();
    throw new Error(`invoice creation failed (${invRes.status}): ${text.slice(0, 200)}`);
  }
  const { invoice, paymentHash } = await invRes.json();
  if (!COINOS_TOKEN) throw new Error("COINOS_TOKEN env var not set — cannot pay invoice");
  const coinosRes = await fetch("https://coinos.io/api/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${COINOS_TOKEN}` },
    body: JSON.stringify({ payreq: invoice })
  });
  if (!coinosRes.ok) {
    const text = await coinosRes.text();
    throw new Error(`Coinos payment failed (${coinosRes.status}): ${text.slice(0, 200)}`);
  }
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    const chk = await fetch(`${SATPACK_URL}/api/v1/hire/check?hash=${encodeURIComponent(paymentHash)}`);
    if (chk.ok && (await chk.json()).paid) break;
  }
  const runRes = await fetch(`${SATPACK_URL}/api/v1/hire/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentHash }),
    signal: AbortSignal.timeout(90_000)
  });
  if (!runRes.ok) {
    const text = await runRes.text();
    throw new Error(`hire/run failed (${runRes.status}): ${text.slice(0, 200)}`);
  }
  const reader = runRes.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const evt = JSON.parse(line.slice(6));
      if (evt.type === "done") return { leads: evt.leads ?? [], summary: evt.summary ?? "", total_sats: evt.total_sats ?? 0 };
      if (evt.type === "error") throw new Error(evt.message ?? "agent error");
    }
  }
  throw new Error("SSE stream ended without a done event");
}
async function runAgentHire(agentId, task) {
  const invRes = await fetch(`${SATPACK_URL}/api/v1/hire/invoice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task, agentId })
  });
  if (!invRes.ok) {
    const text = await invRes.text();
    throw new Error(`invoice creation failed (${invRes.status}): ${text.slice(0, 200)}`);
  }
  const { invoice, paymentHash } = await invRes.json();
  if (!COINOS_TOKEN) throw new Error("COINOS_TOKEN env var not set — cannot pay invoice");
  const coinosRes = await fetch("https://coinos.io/api/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${COINOS_TOKEN}` },
    body: JSON.stringify({ payreq: invoice })
  });
  if (!coinosRes.ok) {
    const text = await coinosRes.text();
    throw new Error(`Coinos payment failed (${coinosRes.status}): ${text.slice(0, 200)}`);
  }
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    const chk = await fetch(`${SATPACK_URL}/api/v1/hire/check?hash=${encodeURIComponent(paymentHash)}`);
    if (chk.ok && (await chk.json()).paid) break;
  }
  const runRes = await fetch(`${SATPACK_URL}/api/v1/hire/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentHash }),
    signal: AbortSignal.timeout(90_000)
  });
  if (!runRes.ok) {
    const text = await runRes.text();
    throw new Error(`hire/run failed (${runRes.status}): ${text.slice(0, 200)}`);
  }
  const reader = runRes.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const evt = JSON.parse(line.slice(6));
      if (evt.type === "done") return { leads: evt.leads, summary: evt.summary, total_sats: evt.total_sats };
      if (evt.type === "error") throw new Error(evt.message ?? "agent error");
    }
  }
  throw new Error("SSE stream ended without a done event");
}
async function listAgentsApi(tag) {
  const url = tag ? `${SATPACK_URL}/api/v1/agents?tag=${encodeURIComponent(tag)}` : `${SATPACK_URL}/api/v1/agents`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`list_agents failed: ${res.status}`);
  return res.json();
}
async function registerAgentApi(params) {
  const qs = new URLSearchParams({
    name: params.name,
    description: params.description,
    price_sats: String(params.price_sats),
    lightning_address: params.lightning_address,
    endpoint_url: params.endpoint_url,
    tags: params.tags.join(",")
  });
  const res = await fetch(`${SATPACK_URL}/api/v1/agents/register?${qs}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `register_agent failed: ${res.status}`);
  return data;
}
var server = new import_server.Server(
  { name: "satpack", version: "1.1.0" },
  { capabilities: { tools: {} } }
);
server.setRequestHandler(import_types.ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "hire_outreach_agent",
      description: "Hire the built-in cold outreach agent. Give it a task in plain English \u2014 e.g. 'find 5 landscapers in Kelowna and pitch my web design services'. The agent searches Google Places, scrapes contact emails, validates deliverability, and drafts personalized outreach emails. Results are appended to ~/.openclaw/hire_outreach.csv for tracking. Already-contacted emails (status=sent) are excluded from future runs. Returns verified leads with draft emails ready to send.",
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
    },
    {
      name: "list_agents",
      description: "Browse the satpack agent marketplace. Returns all listed agents with their IDs, names, descriptions, prices (in sats), tags, and hire counts. Use this to discover which agents are available before calling hire_agent. Optionally filter by a tag (e.g. 'outreach', 'email', 'enrichment').",
      inputSchema: {
        type: "object",
        properties: {
          tag: {
            type: "string",
            description: "Optional tag to filter agents. Example: 'outreach', 'email', 'leads'"
          }
        },
        required: []
      }
    },
    {
      name: "hire_agent",
      description: "Hire any agent from the satpack marketplace by agent ID. Automatically pays the agent's price in sats via Lightning (L402 + Coinos). Use list_agents first to find the agent_id you want. Returns the agent's JSON response (format varies by agent \u2014 see the agent's listing for its output schema).",
      inputSchema: {
        type: "object",
        properties: {
          agent_id: {
            type: "string",
            description: "UUID of the agent to hire. Get this from list_agents."
          },
          task: {
            type: "string",
            description: "Plain-English task description for the agent."
          }
        },
        required: ["agent_id", "task"]
      }
    },
    {
      name: "register_agent",
      description: 'List your own agent on the satpack marketplace. Once registered, any buyer (human or AI) can hire your agent via web, HTTP, or MCP. Your agent must expose an HTTP POST endpoint that accepts { "task": string } and returns JSON. 90% of each hire goes to your lightning_address. 10% to the marketplace. No approval needed \u2014 instant listing.',
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Slug-style name, max 64 chars, must be unique. Example: 'my-outreach-agent'"
          },
          description: {
            type: "string",
            description: "What your agent does, max 280 chars. Shown on the marketplace listing."
          },
          price_sats: {
            type: "number",
            description: "Price per hire in satoshis. Minimum 1."
          },
          lightning_address: {
            type: "string",
            description: "Your Lightning address to receive 90% of each hire. Example: 'you@coinos.io'"
          },
          endpoint_url: {
            type: "string",
            description: 'HTTPS URL that satpack POSTs to when someone hires your agent. Must accept: POST { "task": string } and return JSON.'
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Tags for filtering. Example: ['outreach', 'email', 'leads']"
          }
        },
        required: ["name", "description", "price_sats", "lightning_address", "endpoint_url"]
      }
    }
  ]
}));
server.setRequestHandler(import_types.CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  if (name === "hire_outreach_agent") {
    const { task } = args;
    if (!task?.trim()) throw new Error("task is required and must be a non-empty string");
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
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
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
          }, null, 2)
        }
      ]
    };
  }
  if (name === "list_agents") {
    const { tag } = args;
    const agents = await listAgentsApi(tag);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(agents, null, 2)
        }
      ]
    };
  }
  if (name === "hire_agent") {
    const { agent_id, task } = args;
    if (!agent_id?.trim()) throw new Error("agent_id is required");
    if (!task?.trim()) throw new Error("task is required");
    const result = await runAgentHire(agent_id.trim(), task.trim());
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
  if (name === "register_agent") {
    const { name: agentName, description, price_sats, lightning_address, endpoint_url, tags } = args;
    if (!agentName?.trim()) throw new Error("name is required");
    if (!description?.trim()) throw new Error("description is required");
    if (!price_sats || price_sats < 1) throw new Error("price_sats must be >= 1");
    if (!lightning_address?.trim()) throw new Error("lightning_address is required");
    if (!endpoint_url?.trim()) throw new Error("endpoint_url is required");
    const agent = await registerAgentApi({
      name: agentName.trim(),
      description: description.trim(),
      price_sats,
      lightning_address: lightning_address.trim(),
      endpoint_url: endpoint_url.trim(),
      tags: tags ?? []
    });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            agent,
            marketplace_url: `${SATPACK_URL}/agents/${agent.id}`,
            message: `Agent '${agent.name}' is now live on the satpack marketplace.`
          }, null, 2)
        }
      ]
    };
  }
  throw new Error(`unknown tool: ${name}`);
});
var transport = new import_stdio.StdioServerTransport();
server.connect(transport).catch((err) => {
  console.error("MCP server error:", err);
  process.exit(1);
});
