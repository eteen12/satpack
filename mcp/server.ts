#!/usr/bin/env node
/**
 * satpack MCP server
 *
 * Tools:
 *   hire_outreach_agent   — hire the built-in cold outreach agent (L402 + Coinos)
 *   list_agents           — browse the satpack agent marketplace
 *   hire_agent            — hire any marketplace agent by ID (L402 + Coinos)
 *   register_agent        — list your own agent on the marketplace
 *
 * Usage:
 *   SATPACK_URL=https://satpack.dev COINOS_TOKEN=<token> node mcp/server.js
 *
 * Claude Code / Cursor config (claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "satpack": {
 *         "command": "node",
 *         "args": ["/path/to/satpack/mcp/server.js"],
 *         "env": {
 *           "SATPACK_URL": "https://satpack.dev",
 *           "COINOS_TOKEN": "<your-coinos-token>"
 *         }
 *       }
 *     }
 *   }
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createReadStream, createWriteStream, existsSync, mkdirSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { createInterface } from "readline";

// ── config ─────────────────────────────────────────────────────────────────────

const SATPACK_URL = process.env.SATPACK_URL ?? "http://localhost:3000";
const COINOS_TOKEN = process.env.COINOS_TOKEN ?? "";
const OPENCLAW_DIR = join(homedir(), ".openclaw");
const CSV_PATH = join(OPENCLAW_DIR, "hire_outreach.csv");

const CSV_FIELDS = [
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
  "status",
] as const;

// ── CSV ledger ─────────────────────────────────────────────────────────────────

interface CsvRow {
  id: string;
  business_name: string;
  website: string;
  email: string;
  phone: string;
  address: string;
  draft_subject: string;
  task: string;
  collected_at: string;
  sent_at: string;
  status: string;
}

function ensureCsv(): void {
  if (!existsSync(OPENCLAW_DIR)) mkdirSync(OPENCLAW_DIR, { recursive: true });
  if (!existsSync(CSV_PATH)) {
    writeFileSync(CSV_PATH, CSV_FIELDS.join(",") + "\n");
  }
}

async function loadCsv(): Promise<CsvRow[]> {
  ensureCsv();
  const rows: CsvRow[] = [];
  const rl = createInterface({ input: createReadStream(CSV_PATH), crlfDelay: Infinity });
  let header = true;
  for await (const line of rl) {
    if (header) { header = false; continue; }
    if (!line.trim()) continue;
    const [id, business_name, website, email, phone, address, draft_subject, task, collected_at, sent_at, status] =
      parseCsvLine(line);
    rows.push({ id, business_name, website, email, phone, address, draft_subject, task, collected_at, sent_at, status });
  }
  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
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

function escapeCsv(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

async function appendRows(newRows: CsvRow[]): Promise<void> {
  ensureCsv();
  const ws = createWriteStream(CSV_PATH, { flags: "a" });
  for (const row of newRows) {
    const line = CSV_FIELDS.map((f) => escapeCsv(row[f] ?? "")).join(",");
    ws.write(line + "\n");
  }
  await new Promise<void>((res, rej) => ws.end((err: Error | null | undefined) => (err ? rej(err) : res())));
}

function nextId(rows: CsvRow[]): number {
  if (rows.length === 0) return 1;
  return Math.max(...rows.map((r) => parseInt(r.id, 10) || 0)) + 1;
}

// ── types ─────────────────────────────────────────────────────────────────────

interface Lead {
  business_name: string;
  website: string;
  email: string;
  phone: string;
  address: string;
  draft_subject: string;
  draft_body: string;
}

interface AgentListing {
  id: string;
  name: string;
  description: string;
  price_sats: number;
  tags: string[];
  verified: boolean;
  usage_count: number;
}

// ── generic L402 + Coinos payment flow ───────────────────────────────────────

async function runL402<T>(url: string, bodyJson: string): Promise<T> {
  const headers = { "Content-Type": "application/json" };

  const r1 = await fetch(url, { method: "POST", headers, body: bodyJson });
  if (r1.status !== 402) {
    const text = await r1.text();
    throw new Error(`expected 402, got ${r1.status}: ${text.slice(0, 200)}`);
  }

  const payReq = (await r1.json()) as { macaroon: string; invoice: string; paymentHash: string };
  if (!payReq.macaroon || !payReq.invoice) {
    throw new Error(`402 response missing macaroon or invoice: ${JSON.stringify(payReq)}`);
  }

  if (!COINOS_TOKEN) throw new Error("COINOS_TOKEN env var not set — cannot pay invoice");

  const coinosRes = await fetch("https://coinos.io/api/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${COINOS_TOKEN}` },
    body: JSON.stringify({ payreq: payReq.invoice }),
  });

  if (!coinosRes.ok) {
    const text = await coinosRes.text();
    throw new Error(`Coinos payment failed (${coinosRes.status}): ${text.slice(0, 200)}`);
  }

  const payment = (await coinosRes.json()) as { preimage?: string; ref?: string };
  const preimage = payment.preimage ?? payment.ref;
  if (!preimage) {
    throw new Error(`Coinos payment response missing preimage: ${JSON.stringify(payment)}`);
  }

  const r2 = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `L402 ${payReq.macaroon}:${preimage}`,
    },
    body: bodyJson,
  });

  if (!r2.ok) {
    const text = await r2.text();
    throw new Error(`endpoint returned ${r2.status} after payment: ${text.slice(0, 200)}`);
  }

  const result = (await r2.json()) as T & { error?: string };
  if (result.error) throw new Error(result.error);
  return result;
}

// ── satpack API helpers ───────────────────────────────────────────────────────

async function runHire(task: string): Promise<{ leads: Lead[]; summary: string; total_sats: number }> {
  // Step 1: create invoice via MDK checkout
  const invRes = await fetch(`${SATPACK_URL}/api/v1/hire/invoice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task }),
  });
  if (!invRes.ok) {
    const text = await invRes.text();
    throw new Error(`invoice creation failed (${invRes.status}): ${text.slice(0, 200)}`);
  }
  const { invoice, paymentHash } = await invRes.json() as { invoice: string; paymentHash: string };

  // Step 2: pay with Coinos — no preimage required
  if (!COINOS_TOKEN) throw new Error("COINOS_TOKEN env var not set — cannot pay invoice");
  const coinosRes = await fetch("https://coinos.io/api/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${COINOS_TOKEN}` },
    body: JSON.stringify({ payreq: invoice }),
  });
  if (!coinosRes.ok) {
    const text = await coinosRes.text();
    throw new Error(`Coinos payment failed (${coinosRes.status}): ${text.slice(0, 200)}`);
  }

  // Step 3: poll until MDK confirms payment (usually <1s, bail after 10s)
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    await new Promise<void>((r) => setTimeout(r, 1_500));
    const chk = await fetch(`${SATPACK_URL}/api/v1/hire/check?hash=${encodeURIComponent(paymentHash)}`);
    if (chk.ok && (await chk.json() as { paid: boolean }).paid) break;
  }

  // Step 4: run — server verifies via MDK checkout, streams SSE events
  const runRes = await fetch(`${SATPACK_URL}/api/v1/hire/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentHash }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!runRes.ok) {
    const text = await runRes.text();
    throw new Error(`hire/run failed (${runRes.status}): ${text.slice(0, 200)}`);
  }

  // Step 5: consume SSE stream until done/error
  const reader = runRes.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop()!;
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const evt = JSON.parse(line.slice(6)) as {
        type: string;
        leads?: Lead[];
        summary?: string;
        total_sats?: number;
        message?: string;
      };
      if (evt.type === "done") {
        return { leads: evt.leads ?? [], summary: evt.summary ?? "", total_sats: evt.total_sats ?? 0 };
      }
      if (evt.type === "error") throw new Error(evt.message ?? "agent error");
    }
  }
  throw new Error("SSE stream ended without a done event");
}

async function runAgentHire(agentId: string, task: string): Promise<{ leads?: Lead[]; summary?: string; total_sats?: number; [key: string]: unknown }> {
  // Same invoice/run flow as runHire, but with agentId for per-agent pricing
  const invRes = await fetch(`${SATPACK_URL}/api/v1/hire/invoice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task, agentId }),
  });
  if (!invRes.ok) {
    const text = await invRes.text();
    throw new Error(`invoice creation failed (${invRes.status}): ${text.slice(0, 200)}`);
  }
  const { invoice, paymentHash } = await invRes.json() as { invoice: string; paymentHash: string };

  if (!COINOS_TOKEN) throw new Error("COINOS_TOKEN env var not set — cannot pay invoice");
  const coinosRes = await fetch("https://coinos.io/api/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${COINOS_TOKEN}` },
    body: JSON.stringify({ payreq: invoice }),
  });
  if (!coinosRes.ok) {
    const text = await coinosRes.text();
    throw new Error(`Coinos payment failed (${coinosRes.status}): ${text.slice(0, 200)}`);
  }

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    await new Promise<void>((r) => setTimeout(r, 1_500));
    const chk = await fetch(`${SATPACK_URL}/api/v1/hire/check?hash=${encodeURIComponent(paymentHash)}`);
    if (chk.ok && (await chk.json() as { paid: boolean }).paid) break;
  }

  const runRes = await fetch(`${SATPACK_URL}/api/v1/hire/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentHash }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!runRes.ok) {
    const text = await runRes.text();
    throw new Error(`hire/run failed (${runRes.status}): ${text.slice(0, 200)}`);
  }

  const reader = runRes.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop()!;
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const evt = JSON.parse(line.slice(6)) as {
        type: string;
        leads?: Lead[];
        summary?: string;
        total_sats?: number;
        message?: string;
        [key: string]: unknown;
      };
      if (evt.type === "done") return { leads: evt.leads, summary: evt.summary, total_sats: evt.total_sats };
      if (evt.type === "error") throw new Error(evt.message ?? "agent error");
    }
  }
  throw new Error("SSE stream ended without a done event");
}

async function listAgentsApi(tag?: string): Promise<AgentListing[]> {
  const url = tag
    ? `${SATPACK_URL}/api/v1/agents?tag=${encodeURIComponent(tag)}`
    : `${SATPACK_URL}/api/v1/agents`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`list_agents failed: ${res.status}`);
  return res.json() as Promise<AgentListing[]>;
}

async function registerAgentApi(params: {
  name: string;
  description: string;
  price_sats: number;
  lightning_address: string;
  endpoint_url: string;
  tags: string[];
}): Promise<AgentListing> {
  const qs = new URLSearchParams({
    name: params.name,
    description: params.description,
    price_sats: String(params.price_sats),
    lightning_address: params.lightning_address,
    endpoint_url: params.endpoint_url,
    tags: params.tags.join(","),
  });
  const res = await fetch(`${SATPACK_URL}/api/v1/agents/register?${qs}`);
  const data = (await res.json()) as AgentListing & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `register_agent failed: ${res.status}`);
  return data;
}

// ── MCP server ─────────────────────────────────────────────────────────────────

const server = new Server(
  { name: "satpack", version: "1.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "hire_outreach_agent",
      description:
        "Hire the built-in cold outreach agent. Give it a task in plain English — e.g. 'find 5 landscapers in Kelowna and pitch my web design services'. " +
        "The agent searches Google Places, scrapes contact emails, validates deliverability, and drafts personalized outreach emails. " +
        "Results are appended to ~/.openclaw/hire_outreach.csv for tracking. " +
        "Already-contacted emails (status=sent) are excluded from future runs. " +
        "Returns verified leads with draft emails ready to send.",
      inputSchema: {
        type: "object",
        properties: {
          task: {
            type: "string",
            description:
              "Plain-English outreach task. Include target industry, city, and your pitch. " +
              "Example: 'find 5 landscapers in Kelowna and pitch my web design services'",
          },
        },
        required: ["task"],
      },
    },
    {
      name: "list_agents",
      description:
        "Browse the satpack agent marketplace. Returns all listed agents with their IDs, names, descriptions, prices (in sats), tags, and hire counts. " +
        "Use this to discover which agents are available before calling hire_agent. " +
        "Optionally filter by a tag (e.g. 'outreach', 'email', 'enrichment').",
      inputSchema: {
        type: "object",
        properties: {
          tag: {
            type: "string",
            description: "Optional tag to filter agents. Example: 'outreach', 'email', 'leads'",
          },
        },
        required: [],
      },
    },
    {
      name: "hire_agent",
      description:
        "Hire any agent from the satpack marketplace by agent ID. Automatically pays the agent's price in sats via Lightning (L402 + Coinos). " +
        "Use list_agents first to find the agent_id you want. " +
        "Returns the agent's JSON response (format varies by agent — see the agent's listing for its output schema).",
      inputSchema: {
        type: "object",
        properties: {
          agent_id: {
            type: "string",
            description: "UUID of the agent to hire. Get this from list_agents.",
          },
          task: {
            type: "string",
            description: "Plain-English task description for the agent.",
          },
        },
        required: ["agent_id", "task"],
      },
    },
    {
      name: "register_agent",
      description:
        "List your own agent on the satpack marketplace. Once registered, any buyer (human or AI) can hire your agent via web, HTTP, or MCP. " +
        "Your agent must expose an HTTP POST endpoint that accepts { \"task\": string } and returns JSON. " +
        "90% of each hire goes to your lightning_address. 10% to the marketplace. No approval needed — instant listing.",
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Slug-style name, max 64 chars, must be unique. Example: 'my-outreach-agent'",
          },
          description: {
            type: "string",
            description: "What your agent does, max 280 chars. Shown on the marketplace listing.",
          },
          price_sats: {
            type: "number",
            description: "Price per hire in satoshis. Minimum 1.",
          },
          lightning_address: {
            type: "string",
            description: "Your Lightning address to receive 90% of each hire. Example: 'you@coinos.io'",
          },
          endpoint_url: {
            type: "string",
            description:
              "HTTPS URL that satpack POSTs to when someone hires your agent. " +
              "Must accept: POST { \"task\": string } and return JSON.",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Tags for filtering. Example: ['outreach', 'email', 'leads']",
          },
        },
        required: ["name", "description", "price_sats", "lightning_address", "endpoint_url"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // ── hire_outreach_agent ────────────────────────────────────────────────────
  if (name === "hire_outreach_agent") {
    const { task } = args as { task?: string };
    if (!task?.trim()) throw new Error("task is required and must be a non-empty string");

    const existing = await loadCsv();
    const sentEmails = new Set(existing.filter((r) => r.status === "sent").map((r) => r.email.toLowerCase()));

    const { leads, summary, total_sats } = await runHire(task.trim());

    const now = new Date().toISOString();
    let id = nextId(existing);
    const newRows: CsvRow[] = [];

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
        status: "pending",
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
              status: r.status,
            })),
            ledger: CSV_PATH,
          }, null, 2),
        },
      ],
    };
  }

  // ── list_agents ────────────────────────────────────────────────────────────
  if (name === "list_agents") {
    const { tag } = args as { tag?: string };
    const agents = await listAgentsApi(tag);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(agents, null, 2),
        },
      ],
    };
  }

  // ── hire_agent ─────────────────────────────────────────────────────────────
  if (name === "hire_agent") {
    const { agent_id, task } = args as { agent_id?: string; task?: string };
    if (!agent_id?.trim()) throw new Error("agent_id is required");
    if (!task?.trim()) throw new Error("task is required");

    const result = await runAgentHire(agent_id.trim(), task.trim());
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  // ── register_agent ─────────────────────────────────────────────────────────
  if (name === "register_agent") {
    const { name: agentName, description, price_sats, lightning_address, endpoint_url, tags } =
      args as {
        name?: string;
        description?: string;
        price_sats?: number;
        lightning_address?: string;
        endpoint_url?: string;
        tags?: string[];
      };

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
      tags: tags ?? [],
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            agent,
            marketplace_url: `${SATPACK_URL}/agents/${agent.id}`,
            message: `Agent '${agent.name}' is now live on the satpack marketplace.`,
          }, null, 2),
        },
      ],
    };
  }

  throw new Error(`unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
server.connect(transport).catch((err: unknown) => {
  console.error("MCP server error:", err);
  process.exit(1);
});
