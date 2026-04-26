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
import { createReadStream, createWriteStream, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { createInterface } from "readline";

// ── config ─────────────────────────────────────────────────────────────────────

const SATPACK_URL = process.env.SATPACK_URL ?? "http://localhost:3000";
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
    createWriteStream(CSV_PATH).end(CSV_FIELDS.join(",") + "\n");
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

// ── call satpack hire endpoint ─────────────────────────────────────────────────

async function runHire(task: string): Promise<{ leads: Lead[]; summary: string; total_sats: number }> {
  const res = await fetch(`${SATPACK_URL}/api/v1/dev/agent/hire`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`hire endpoint returned HTTP ${res.status}`);
  }

  const reader = (res.body as unknown as AsyncIterable<Uint8Array>)[Symbol.asyncIterator]
    ? (res.body as unknown as AsyncIterable<Uint8Array>)
    : (() => { throw new Error("streaming not supported in this environment"); })();

  const dec = new TextDecoder();
  let buf = "";

  for await (const chunk of reader as AsyncIterable<Uint8Array>) {
    buf += dec.decode(chunk, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      let ev: AgentEvent;
      try { ev = JSON.parse(line.slice(5).trim()) as AgentEvent; } catch { continue; }
      if (ev.type === "done") return { leads: ev.leads, summary: ev.summary, total_sats: ev.total_sats };
      if (ev.type === "error") throw new Error(ev.message);
    }
  }

  throw new Error("stream ended without a done event");
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
await server.connect(transport);
