#!/usr/bin/env node
/**
 * satpack MCP server
 *
 * Exposes one tool: hire_outreach_agent
 * Proxies to the satpack /hire SSE endpoint, waits for completion,
 * appends results to ~/.openclaw/hire_outreach.csv (mirrors the
 * chatbot-outreach ledger pattern), and returns leads as JSON.
 *
 * Usage:
 *   SATPACK_URL=https://your-satpack.vercel.app node mcp/server.js
 *
 * Claude Code / Cursor config (claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "satpack": {
 *         "command": "node",
 *         "args": ["/path/to/satpack/mcp/server.js"],
 *         "env": { "SATPACK_URL": "http://localhost:3000" }
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

// ── agent types (mirrors hire-agent.ts) ───────────────────────────────────────

interface Lead {
  business_name: string;
  website: string;
  email: string;
  phone: string;
  address: string;
  draft_subject: string;
  draft_body: string;
}

type AgentEvent =
  | { type: "thinking"; message: string }
  | { type: "tool_start"; tool: string; label: string; sats: number }
  | { type: "tool_done"; tool: string; label: string; sats: number; ok: boolean; summary: string }
  | { type: "done"; leads: Lead[]; summary: string; total_sats: number }
  | { type: "error"; message: string };

// ── call satpack hire endpoint (L402 + Coinos payment) ────────────────────────

async function runHire(task: string): Promise<{ leads: Lead[]; summary: string; total_sats: number }> {
  const body = JSON.stringify({ task });
  const headers = { "Content-Type": "application/json" };

  // Step 1: request the resource — expect 402
  const r1 = await fetch(`${SATPACK_URL}/api/v1/hire`, { method: "POST", headers, body });

  if (r1.status !== 402) {
    const text = await r1.text();
    throw new Error(`expected 402 from hire endpoint, got ${r1.status}: ${text.slice(0, 200)}`);
  }

  const payReq = (await r1.json()) as { macaroon: string; invoice: string; paymentHash: string };
  if (!payReq.macaroon || !payReq.invoice) {
    throw new Error(`402 response missing macaroon or invoice: ${JSON.stringify(payReq)}`);
  }

  // Step 2: pay the Lightning invoice via Coinos
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

  const payment = (await coinosRes.json()) as { preimage?: string; ref?: string; id?: string };
  const preimage = payment.preimage ?? payment.ref;
  if (!preimage) {
    throw new Error(`Coinos payment response missing preimage: ${JSON.stringify(payment)}`);
  }

  // Step 3: retry with L402 credential
  const r2 = await fetch(`${SATPACK_URL}/api/v1/hire`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `L402 ${payReq.macaroon}:${preimage}`,
    },
    body,
  });

  if (!r2.ok) {
    const text = await r2.text();
    throw new Error(`hire endpoint returned ${r2.status} after payment: ${text.slice(0, 200)}`);
  }

  const result = (await r2.json()) as { leads?: Lead[]; summary?: string; total_sats?: number; error?: string };
  if (result.error) throw new Error(result.error);

  return {
    leads: result.leads ?? [],
    summary: result.summary ?? "",
    total_sats: result.total_sats ?? 0,
  };
}

// ── MCP server ─────────────────────────────────────────────────────────────────

const server = new Server(
  { name: "satpack", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "hire_outreach_agent",
      description:
        "Hire a cold outreach agent. Give it a task in plain English — e.g. 'find 5 landscapers in Kelowna and pitch my web design services'. " +
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
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "hire_outreach_agent") {
    throw new Error(`unknown tool: ${request.params.name}`);
  }

  const { task } = request.params.arguments as { task?: string };
  if (!task?.trim()) {
    throw new Error("task is required and must be a non-empty string");
  }

  // load existing ledger to skip already-sent emails
  const existing = await loadCsv();
  const sentEmails = new Set(existing.filter((r) => r.status === "sent").map((r) => r.email.toLowerCase()));

  // run the agent
  const { leads, summary, total_sats } = await runHire(task.trim());

  // filter and write new leads to CSV
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
      status: r.status,
    })),
    ledger: CSV_PATH,
  };

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
});

const transport = new StdioServerTransport();
server.connect(transport).catch((err: unknown) => {
  console.error("MCP server error:", err);
  process.exit(1);
});
